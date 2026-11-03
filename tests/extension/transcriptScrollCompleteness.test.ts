import assert from "node:assert/strict";
import test from "node:test";
import {
  collectTranscriptRowsByScroll,
  computeTranscriptScrollBudgetMs,
  estimateTranscriptScrollSteps,
  type CollectTranscriptRowsByScrollOptions,
} from "../../extension/lib/player-response.js";

// Regression coverage for the Codex blocking review item: the transcript DOM
// scroll pass used to stop on a fixed 10s budget and hand back whatever it had
// collected, which silently truncated long/virtualized transcripts. A simulated
// 2,000-row x 50px list in a 400px viewport needs ~11s of viewport stepping, so
// the old implementation returned ~1,204 rows as "success".
//
// These tests drive the pure, dependency-injected scroll helper with a
// deterministic virtual clock, so they pin both completeness and the
// no-skip-ahead stepping rule without a real browser.

interface SimRow {
  id: number;
  startMs: number;
  text: string;
}

interface SimulatedListOptions {
  rowCount?: number;
  rowHeightPx?: number;
  clientHeight?: number;
  fullyRendered?: boolean;
  hydrateLagReads?: number;
  stuck?: boolean;
  initialScrollTop?: number;
  renderLagMs?: number;
  hideLastRowAtBottom?: boolean;
}

function makeRows(rowCount: number): SimRow[] {
  return Array.from({ length: rowCount }, (_unused, index) => ({
    id: index,
    startMs: index * 1_000,
    text: `row ${index}`,
  }));
}

class SimulatedTranscriptList {
  readonly rows: SimRow[];
  readonly rowHeightPx: number;
  readonly clientHeight: number;
  readonly fullyRendered: boolean;
  readonly hydrateLagReads: number;
  readonly renderLagMs: number;
  readonly hideLastRowAtBottom: boolean;
  readonly setCalls: number[] = [];
  nowFn: () => number = () => 0;
  stuck: boolean;
  scrollTop: number;
  readCount = 0;
  private pendingTop: number | null = null;
  private renderTop = 0;
  private lastScrollAt = 0;

  constructor(options: SimulatedListOptions = {}) {
    this.rows = makeRows(options.rowCount ?? 2_000);
    this.rowHeightPx = options.rowHeightPx ?? 50;
    this.clientHeight = options.clientHeight ?? 400;
    this.fullyRendered = options.fullyRendered ?? false;
    this.hydrateLagReads = options.hydrateLagReads ?? 0;
    this.renderLagMs = options.renderLagMs ?? 0;
    this.hideLastRowAtBottom = options.hideLastRowAtBottom ?? false;
    this.stuck = options.stuck ?? false;
    this.scrollTop = options.initialScrollTop ?? 0;
    this.renderTop = this.scrollTop;
  }

  get scrollHeight(): number {
    return this.rows.length * this.rowHeightPx;
  }

  get maxScrollTop(): number {
    return Math.max(0, this.scrollHeight - this.clientHeight);
  }

  setScrollTop(value: number): void {
    this.setCalls.push(value);
    if (this.stuck) return;
    this.scrollTop = Math.min(Math.max(0, value), this.maxScrollTop);
    this.lastScrollAt = this.nowFn();
  }

  /** Advances the simulated DOM render clock based on renderLagMs. */
  private syncRenderTop(): void {
    if (this.renderLagMs <= 0) {
      this.renderTop = this.scrollTop;
      return;
    }
    if (this.nowFn() - this.lastScrollAt >= this.renderLagMs) {
      this.renderTop = this.scrollTop;
    }
  }

  readSnapshot() {
    // hydrateLagReads: simulate a virtualized list whose newly exposed rows only
    // render one snapshot later. renderLagMs: the DOM catches up after a wall
    // clock delay (e.g. 120ms), which used to make the sweep read stale rows.
    this.syncRenderTop();
    const effectiveTop =
      this.hydrateLagReads > 0 && this.readCount > 0
        ? (this.pendingTop ?? this.renderTop)
        : this.renderTop;
    this.pendingTop = this.scrollTop;
    this.readCount += 1;

    const windowRows = this.rowsInWindow(effectiveTop);
    const visibleRows =
      this.hideLastRowAtBottom && effectiveTop >= this.maxScrollTop - 1
        ? windowRows.filter((row) => row.id !== this.rows.length - 1)
        : windowRows;
    const rendered = this.fullyRendered ? this.rows : visibleRows;
    const visibleIds = windowRows.map((row) => row.id);
    const lastRendered = rendered[rendered.length - 1];
    return {
      rows: rendered,
      scrollTop: this.scrollTop,
      scrollHeight: this.scrollHeight,
      clientHeight: this.clientHeight,
      renderedCount: rendered.length,
      estimatedTotalRows: this.rows.length,
      // Visible-row signature: changes whenever the DOM re-renders for a new
      // scroll position, even for lists that keep every row in the DOM.
      renderSignature: `${visibleIds.length}|${visibleIds[0] ?? ""}|${visibleIds[visibleIds.length - 1] ?? ""}`,
      contentBottomPx: lastRendered ? (lastRendered.id + 1) * this.rowHeightPx : null,
      rowStridePx: this.rowHeightPx,
    };
  }

  private rowsInWindow(top: number): SimRow[] {
    const start = Math.min(this.rows.length, Math.floor(top / this.rowHeightPx));
    const end = Math.min(this.rows.length, Math.ceil((top + this.clientHeight) / this.rowHeightPx));
    return this.rows.slice(start, end);
  }
}

function createRowMerger() {
  return (rows: SimRow[], batch: SimRow[] | null | undefined): SimRow[] => {
    if (!batch || batch.length === 0) return rows;
    const merged = new Map(rows.map((row) => [row.id, row]));
    let changed = false;
    for (const row of batch) {
      if (!merged.has(row.id)) {
        merged.set(row.id, row);
        changed = true;
      }
    }
    return changed ? Array.from(merged.values()) : rows;
  };
}

function createClock() {
  let current = 0;
  return {
    now: () => current,
    sleep: async (ms: number) => {
      current += Math.max(0, ms);
    },
    elapsed: () => current,
  };
}

function rawOptions(
  list: SimulatedTranscriptList,
  clock: ReturnType<typeof createClock>,
  overrides: Partial<CollectTranscriptRowsByScrollOptions<SimRow>> = {},
): CollectTranscriptRowsByScrollOptions<SimRow> {
  return {
    readSnapshot: () => list.readSnapshot(),
    setScrollTop: (value) => list.setScrollTop(value),
    mergeRows: createRowMerger(),
    sleep: clock.sleep,
    now: clock.now,
    budgetMs: 120_000,
    stepDelayMs: 40,
    maxSteps: 1_000,
    overlapPx: 40,
    idlePasses: 2,
    ...overrides,
  };
}

test("collectTranscriptRowsByScroll collects all 2,000 virtualized rows when the adaptive budget suffices", async () => {
  const list = new SimulatedTranscriptList({ rowCount: 2_000, rowHeightPx: 50, clientHeight: 400 });
  const clock = createClock();

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock));

  assert.equal(result.complete, true);
  assert.equal(result.reason, null);
  assert.equal(result.atBottom, true);
  assert.equal(result.rows.length, 2_000);
  assert.equal(new Set(result.rows.map((row) => row.id)).size, 2_000);
  // The sweep needs more than the old fixed 10s budget; that is exactly why the
  // previous implementation truncated and still reported success.
  assert.ok(result.elapsedMs > 10_000, `expected >10s, got ${result.elapsedMs}ms`);
});

test("collectTranscriptRowsByScroll reports an incomplete budget sweep instead of silently truncating", async () => {
  const list = new SimulatedTranscriptList({ rowCount: 2_000, rowHeightPx: 50, clientHeight: 400 });
  const clock = createClock();

  const result = await collectTranscriptRowsByScroll(
    rawOptions(list, clock, { budgetMs: 400, stepDelayMs: 40, maxSteps: 1_000 }),
  );

  assert.equal(result.complete, false);
  assert.equal(result.reason, "budget");
  assert.equal(result.atBottom, false);
  assert.ok(result.rows.length > 0, "partial rows are still reported for diagnostics");
  assert.ok(result.rows.length < 2_000, "the sweep must not claim a complete transcript");
  assert.ok(result.elapsedMs >= 400);
});

test("collectTranscriptRowsByScroll completes a list without real overflow in a single pass", async () => {
  const list = new SimulatedTranscriptList({ rowCount: 5, rowHeightPx: 50, clientHeight: 400 });
  const clock = createClock();

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock));

  assert.equal(result.complete, true);
  assert.equal(result.reason, "no_overflow");
  assert.equal(result.steps, 0);
  assert.equal(result.rows.length, 5);
  assert.equal(clock.elapsed(), 0, "no scrolling waits should be needed");
  assert.deepEqual(list.setCalls, [], "a non-overflowing list must never be scrolled");
});

test("collectTranscriptRowsByScroll still sweeps a fully rendered list and proves completeness", async () => {
  const list = new SimulatedTranscriptList({
    rowCount: 2_000,
    rowHeightPx: 50,
    clientHeight: 400,
    fullyRendered: true,
    initialScrollTop: 1_200,
  });
  const clock = createClock();

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock));

  // No estimation-based shortcut: a fully rendered list still walks the
  // viewports (it is cheap because every pass re-reads the same DOM rows), and
  // only reports success once it has actually reached the bottom.
  assert.equal(result.complete, true);
  assert.equal(result.reason, null);
  assert.ok(result.steps > 0, "the sweep must not trust a renderedCount estimate");
  assert.equal(result.rows.length, 2_000);
  assert.equal(list.scrollTop, 1_200);
});

test("collectTranscriptRowsByScroll does not complete from a stale DOM when rendering lags 120ms", async () => {
  const list = new SimulatedTranscriptList({
    rowCount: 2_000,
    rowHeightPx: 50,
    clientHeight: 400,
    renderLagMs: 120,
  });
  const clock = createClock();
  list.nowFn = clock.now;

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock));

  assert.equal(result.complete, true);
  assert.equal(result.reason, null);
  assert.equal(result.rows.length, 2_000);
  assert.equal(new Set(result.rows.map((row) => row.id)).size, 2_000);
});

test("collectTranscriptRowsByScroll reports render_timeout when a scroll step never re-renders", async () => {
  const list = new SimulatedTranscriptList({
    rowCount: 2_000,
    rowHeightPx: 50,
    clientHeight: 400,
    renderLagMs: Number.POSITIVE_INFINITY,
  });
  const clock = createClock();
  list.nowFn = clock.now;

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock));

  assert.equal(result.complete, false);
  assert.equal(result.reason, "render_timeout");
  assert.ok(result.rows.length < 2_000);
});

test("collectTranscriptRowsByScroll reports missing_rows when the last row never renders at the bottom", async () => {
  const list = new SimulatedTranscriptList({
    rowCount: 20,
    rowHeightPx: 50,
    clientHeight: 950,
    hideLastRowAtBottom: true,
  });
  const clock = createClock();

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock));

  assert.equal(result.complete, false);
  assert.equal(result.reason, "missing_rows");
  assert.equal(result.rows.length, 19);
});

test("collectTranscriptRowsByScroll collects all 20 rows when the viewport first shows 19", async () => {
  const list = new SimulatedTranscriptList({ rowCount: 20, rowHeightPx: 50, clientHeight: 950 });
  const clock = createClock();

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock));

  // Codex's repro: the old `renderedCount >= estimatedTotalRows - 1` shortcut
  // claimed completeness with 19/20 rows and zero scroll steps.
  assert.equal(result.complete, true);
  assert.equal(result.rows.length, 20);
  assert.ok(result.steps > 0, "the sweep must actually look for the missing row");
});

test("collectTranscriptRowsByScroll reports step_cap when the scroll step limit is reached", async () => {
  const list = new SimulatedTranscriptList({ rowCount: 2_000, rowHeightPx: 50, clientHeight: 400 });
  const clock = createClock();

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock, { maxSteps: 5 }));

  assert.equal(result.complete, false);
  assert.equal(result.reason, "step_cap");
  assert.equal(result.steps, 5);
  assert.equal(result.atBottom, false);
  assert.ok(result.rows.length < 2_000);
});

test("collectTranscriptRowsByScroll reports stalled when the container refuses to scroll", async () => {
  const list = new SimulatedTranscriptList({
    rowCount: 2_000,
    rowHeightPx: 50,
    clientHeight: 400,
    stuck: true,
  });
  const clock = createClock();

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock));

  assert.equal(result.complete, false);
  assert.equal(result.reason, "stalled");
  assert.equal(result.atBottom, false);
  assert.ok(result.rows.length > 0);
  assert.ok(result.rows.length < 2_000);
});

test("collectTranscriptRowsByScroll reports stalled when the container has no measurable viewport", async () => {
  const clock = createClock();
  const visibleRows = makeRows(2_000).slice(0, 8);

  const result = await collectTranscriptRowsByScroll({
    // A hidden/collapsed panel still exposes its last rendered rows, but with no
    // measurable viewport the sweep cannot prove it saw every row.
    readSnapshot: () => ({
      rows: visibleRows,
      scrollTop: 0,
      scrollHeight: 100_000,
      clientHeight: 0,
      renderedCount: visibleRows.length,
      estimatedTotalRows: 2_000,
    }),
    setScrollTop: () => {},
    mergeRows: createRowMerger(),
    sleep: clock.sleep,
    now: clock.now,
    budgetMs: 120_000,
    stepDelayMs: 40,
    maxSteps: 1_000,
    overlapPx: 40,
    idlePasses: 2,
  });

  assert.equal(result.complete, false);
  assert.equal(result.reason, "stalled");
  assert.equal(result.atBottom, false);
  assert.equal(result.rows.length, 8);
});

test("collectTranscriptRowsByScroll never skips rows when rows hydrate one snapshot late", async () => {
  const list = new SimulatedTranscriptList({
    rowCount: 2_000,
    rowHeightPx: 50,
    clientHeight: 400,
    hydrateLagReads: 1,
  });
  const clock = createClock();

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock));

  assert.equal(result.complete, true);
  assert.equal(result.reason, null);
  assert.equal(result.rows.length, 2_000);
  assert.equal(new Set(result.rows.map((row) => row.id)).size, 2_000);

  // No skip-ahead: every forward scroll move stays within one viewport.
  const maxForwardStep = list.clientHeight - 40;
  for (let index = 1; index < list.setCalls.length; index += 1) {
    const delta = list.setCalls[index] - list.setCalls[index - 1];
    assert.ok(delta <= maxForwardStep, `forward step of ${delta}px exceeds ${maxForwardStep}px`);
  }
});

test("collectTranscriptRowsByScroll restores the caller's original scroll position", async () => {
  const list = new SimulatedTranscriptList({
    rowCount: 2_000,
    rowHeightPx: 50,
    clientHeight: 400,
    initialScrollTop: 1_200,
  });
  const clock = createClock();

  const result = await collectTranscriptRowsByScroll(rawOptions(list, clock));

  assert.equal(result.complete, true);
  assert.equal(result.rows.length, 2_000);
  assert.equal(list.scrollTop, 1_200);
  assert.equal(list.setCalls[0], 0, "the sweep starts from the top");
  assert.equal(list.setCalls.at(-1), 1_200, "the caller's scroll position is restored last");
  assert.ok(
    list.setCalls.some((value) => value > 1_200),
    "the sweep actually moved down before restoring",
  );
});

test("computeTranscriptScrollBudgetMs scales past the old fixed 10s budget", () => {
  const metrics = { scrollHeight: 100_000, clientHeight: 400 };
  const steps = estimateTranscriptScrollSteps(metrics, { overlapPx: 40 });
  assert.equal(steps, 277);

  const budgetMs = computeTranscriptScrollBudgetMs({
    ...metrics,
    stepDelayMs: 60,
    overlapPx: 40,
  });

  assert.ok(budgetMs > 10_000, `expected more than the old 10s budget, got ${budgetMs}ms`);
  assert.ok(budgetMs >= steps * 60, "the budget must cover a full viewport-by-viewport sweep");
  assert.ok(budgetMs <= 90_000);
  // The budget also accounts for per-step render waiting, so a 2,000-row list
  // reaches the 90s ceiling instead of the old 26.93s step-only figure.
  assert.equal(budgetMs, 90_000);
});

test("computeTranscriptScrollBudgetMs clamps between 15s and 90s", () => {
  assert.equal(
    computeTranscriptScrollBudgetMs({ scrollHeight: 250, clientHeight: 400, stepDelayMs: 60 }),
    15_000,
  );
  assert.equal(
    computeTranscriptScrollBudgetMs({
      scrollHeight: 10_000_000,
      clientHeight: 400,
      stepDelayMs: 60,
    }),
    90_000,
  );
  assert.equal(estimateTranscriptScrollSteps({ scrollHeight: 400, clientHeight: 400 }), 0);
});

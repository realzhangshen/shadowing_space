import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type TestStatus = "pass" | "fail" | "skip";
type Category = "unit" | "integration" | "diagnostic";
type Validity = "reasonable" | "needs-review" | "outdated-candidate" | "obsolete";

type CatalogEntry = {
  file: string;
  name: string;
  category: Category;
  validity: Validity;
  owner: string;
  reason: string;
  lastReviewedOn: string;
  reviewBy: string;
};

type DiscoveredCase = {
  file: string;
  name: string;
};

type RuntimeCase = {
  file: string;
  name: string;
  status: TestStatus;
  durationMs: number | null;
};

type ReportCase = RuntimeCase & {
  category: Category | "uncataloged";
  validity: Validity | "uncataloged";
  owner: string | null;
  reason: string | null;
  lastReviewedOn: string | null;
  reviewBy: string | null;
};

type DiffItem = {
  file: string;
  name: string;
  from: TestStatus | "missing";
  to: TestStatus;
};

type ReportJson = {
  generatedAt: string;
  mode: "main" | "all";
  summary: {
    total: number;
    pass: number;
    fail: number;
    skip: number;
  };
  cases: ReportCase[];
  diff: {
    newFailures: DiffItem[];
    resolved: DiffItem[];
    newSkips: DiffItem[];
  };
  governance: {
    uncataloged: DiscoveredCase[];
    outdatedCandidates: CatalogEntry[];
    reviewOverdue: CatalogEntry[];
    catalogOrphans: CatalogEntry[];
    duplicateCatalogEntries: Array<{ file: string; name: string }>;
    diagnosticPolicyViolations: CatalogEntry[];
  };
  parseErrors: string[];
};

type ParsedTap = {
  cases: Array<{
    name: string;
    status: TestStatus;
    durationMs: number | null;
  }>;
};

const ROOT = process.cwd();
const TESTS_DIR = path.join(ROOT, "tests");
const CATALOG_PATH = path.join(TESTS_DIR, "catalog.yaml");
const REPORTS_DIR = path.join(ROOT, "reports", "tests");
const HISTORY_DIR = path.join(REPORTS_DIR, "history");
const LATEST_JSON_PATH = path.join(REPORTS_DIR, "latest.json");
const LATEST_MD_PATH = path.join(REPORTS_DIR, "latest.md");

const args = new Set(process.argv.slice(2));
const includeDiagnostics = args.has("--all");
const catalogOnly = args.has("--catalog-only");

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function keyOf(item: { file: string; name: string }): string {
  return `${item.file}::${item.name}`;
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function listTestFiles(dirAbs: string): string[] {
  if (!existsSync(dirAbs)) return [];

  const entries = readdirSync(dirAbs, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryAbs = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTestFiles(entryAbs));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(toPosixPath(path.relative(ROOT, entryAbs)));
    }
  }

  return files.sort();
}

function decodeQuotedLiteral(raw: string): string {
  if (raw.length < 2) return raw;
  const quote = raw[0];
  const body = raw.slice(1, -1);
  if (quote === "\"") {
    return body.replace(/\\(["\\bfnrt])/g, (_match, token: string) => {
      switch (token) {
        case "\"":
          return "\"";
        case "\\":
          return "\\";
        case "b":
          return "\b";
        case "f":
          return "\f";
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        default:
          return token;
      }
    });
  }
  if (quote === "'") {
    return body.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  }
  if (quote === "`") {
    return body.replace(/\\`/g, "`");
  }
  return raw;
}

function extractTestNames(fileRel: string): string[] {
  const fileAbs = path.join(ROOT, fileRel);
  const content = readFileSync(fileAbs, "utf8");
  const regex = /\btest\s*\(\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`)/g;
  const names: string[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(content)) !== null) {
    const literal = match[1];
    names.push(decodeQuotedLiteral(literal));
  }
  return names;
}

function parseKeyValue(line: string, lineNumber: number): { key: string; value: string } {
  const separator = line.indexOf(":");
  if (separator < 0) {
    throw new Error(`Invalid catalog line ${lineNumber}: "${line}"`);
  }
  const key = line.slice(0, separator).trim();
  let value = line.slice(separator + 1).trim();

  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = decodeQuotedLiteral(value);
  }

  return { key, value };
}

function finalizeCatalogEntry(partial: Partial<CatalogEntry>, lineNumber: number): CatalogEntry {
  const requiredKeys: Array<keyof CatalogEntry> = [
    "file",
    "name",
    "category",
    "validity",
    "owner",
    "reason",
    "lastReviewedOn",
    "reviewBy",
  ];

  for (const key of requiredKeys) {
    if (!partial[key]) {
      throw new Error(`Catalog entry near line ${lineNumber} is missing "${key}".`);
    }
  }

  const entry = partial as CatalogEntry;
  return {
    ...entry,
    file: toPosixPath(entry.file),
  };
}

function parseCatalog(content: string): CatalogEntry[] {
  const lines = content.split(/\r?\n/);
  const entries: CatalogEntry[] = [];
  let inTestsSection = false;
  let current: Partial<CatalogEntry> | null = null;
  let currentStartLine = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const rawLine = lines[i] ?? "";
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    if (!inTestsSection) {
      if (trimmed === "tests:") {
        inTestsSection = true;
        continue;
      }
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (current) {
        entries.push(finalizeCatalogEntry(current, currentStartLine));
      }
      current = {};
      currentStartLine = lineNumber;
      const rest = trimmed.slice(2).trim();
      if (rest) {
        const { key, value } = parseKeyValue(rest, lineNumber);
        (current as Record<string, string>)[key] = value;
      }
      continue;
    }

    if (!current) {
      throw new Error(`Catalog line ${lineNumber} must start with "- " for a new entry.`);
    }

    const { key, value } = parseKeyValue(trimmed, lineNumber);
    (current as Record<string, string>)[key] = value;
  }

  if (current) {
    entries.push(finalizeCatalogEntry(current, currentStartLine));
  }

  return entries;
}

function loadCatalog(): CatalogEntry[] {
  if (!existsSync(CATALOG_PATH)) {
    throw new Error(`Catalog not found at ${toPosixPath(path.relative(ROOT, CATALOG_PATH))}`);
  }
  const content = readFileSync(CATALOG_PATH, "utf8");
  return parseCatalog(content);
}

function parseTapOutput(output: string): ParsedTap {
  const cases: ParsedTap["cases"] = [];
  const lines = output.split(/\r?\n/);
  let currentCase: ParsedTap["cases"][number] | null = null;
  let inDetailBlock = false;

  for (const line of lines) {
    const resultMatch = line.match(/^(ok|not ok)\s+\d+\s+-\s+(.+?)(?:\s+#\s*(SKIP|TODO)\b.*)?$/);
    if (resultMatch) {
      const directive = resultMatch[3];
      const status: TestStatus =
        resultMatch[1] === "not ok" ? "fail" : directive === "SKIP" ? "skip" : "pass";
      currentCase = {
        name: resultMatch[2].trim(),
        status,
        durationMs: null,
      };
      cases.push(currentCase);
      inDetailBlock = false;
      continue;
    }

    if (line.trim() === "---" && currentCase) {
      inDetailBlock = true;
      continue;
    }

    if (line.trim() === "..." && currentCase) {
      inDetailBlock = false;
      currentCase = null;
      continue;
    }

    if (inDetailBlock && currentCase) {
      const durationMatch = line.match(/^\s*duration_ms:\s*([0-9.]+)/);
      if (durationMatch) {
        const durationMs = Number(durationMatch[1]);
        currentCase.durationMs = Number.isFinite(durationMs) ? durationMs : null;
      }
    }
  }

  return { cases };
}

function runTestFile(fileRel: string): {
  cases: RuntimeCase[];
  parseError: string | null;
  stdout: string;
  stderr: string;
} {
  const run = spawnSync(
    "node",
    ["--import", "tsx", "--test", "--test-reporter=tap", fileRel],
    {
      cwd: ROOT,
      encoding: "utf8",
    }
  );

  if (run.error) {
    return {
      cases: [],
      parseError: `${fileRel}: failed to spawn node test process: ${run.error.message}`,
      stdout: run.stdout ?? "",
      stderr: run.stderr ?? "",
    };
  }

  const stdout = run.stdout ?? "";
  const stderr = run.stderr ?? "";
  const parsed = parseTapOutput(stdout);
  const cases: RuntimeCase[] = parsed.cases.map((testCase) => ({
    file: fileRel,
    name: testCase.name,
    status: testCase.status,
    durationMs: testCase.durationMs,
  }));

  const hasFailCase = cases.some((testCase) => testCase.status === "fail");
  if (run.status !== 0 && !hasFailCase) {
    return {
      cases,
      parseError: `${fileRel}: non-zero exit (${run.status ?? "null"}) without parseable failing test.`,
      stdout,
      stderr,
    };
  }

  if (cases.length === 0) {
    return {
      cases,
      parseError: `${fileRel}: no test cases parsed from TAP output.`,
      stdout,
      stderr,
    };
  }

  return {
    cases,
    parseError: null,
    stdout,
    stderr,
  };
}

function summarize(cases: RuntimeCase[]): { total: number; pass: number; fail: number; skip: number } {
  let pass = 0;
  let fail = 0;
  let skip = 0;
  for (const testCase of cases) {
    if (testCase.status === "pass") pass += 1;
    if (testCase.status === "fail") fail += 1;
    if (testCase.status === "skip") skip += 1;
  }
  return {
    total: cases.length,
    pass,
    fail,
    skip,
  };
}

function loadPreviousReport(): ReportJson | null {
  if (!existsSync(LATEST_JSON_PATH)) return null;
  try {
    const raw = readFileSync(LATEST_JSON_PATH, "utf8");
    return JSON.parse(raw) as ReportJson;
  } catch (error) {
    // Log to stderr so it doesn't break report parsing
    const errorMsg = `[status] warning: failed to load previous report: ${error instanceof Error ? error.message : String(error)}\n`;
    process.stderr.write(errorMsg);
    return null;
  }
}

function createMarkdown(report: ReportJson): string {
  const lines: string[] = [];
  lines.push("# Test Status Report");
  lines.push("");
  lines.push(`- Generated At: ${report.generatedAt}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| total | pass | fail | skip |");
  lines.push("| ---: | ---: | ---: | ---: |");
  lines.push(
    `| ${report.summary.total} | ${report.summary.pass} | ${report.summary.fail} | ${report.summary.skip} |`
  );
  lines.push("");
  lines.push("## Diff");
  lines.push("");
  lines.push(`- New Failures: ${report.diff.newFailures.length}`);
  lines.push(`- Resolved: ${report.diff.resolved.length}`);
  lines.push(`- New Skips: ${report.diff.newSkips.length}`);
  lines.push("");

  if (report.diff.newFailures.length > 0) {
    lines.push("### New Failures");
    lines.push("");
    for (const item of report.diff.newFailures) {
      lines.push(`- ${item.file} :: ${item.name} (${item.from} -> ${item.to})`);
    }
    lines.push("");
  }

  if (report.diff.resolved.length > 0) {
    lines.push("### Resolved");
    lines.push("");
    for (const item of report.diff.resolved) {
      lines.push(`- ${item.file} :: ${item.name} (${item.from} -> ${item.to})`);
    }
    lines.push("");
  }

  lines.push("## Governance");
  lines.push("");
  lines.push(`- Uncataloged: ${report.governance.uncataloged.length}`);
  lines.push(`- Outdated Candidates: ${report.governance.outdatedCandidates.length}`);
  lines.push(`- Review Overdue: ${report.governance.reviewOverdue.length}`);
  lines.push(`- Catalog Orphans: ${report.governance.catalogOrphans.length}`);
  lines.push(`- Duplicate Catalog Entries: ${report.governance.duplicateCatalogEntries.length}`);
  lines.push(`- Diagnostic Policy Violations: ${report.governance.diagnosticPolicyViolations.length}`);
  lines.push("");

  if (report.governance.uncataloged.length > 0) {
    lines.push("### Uncataloged Tests");
    lines.push("");
    for (const item of report.governance.uncataloged) {
      lines.push(`- ${item.file} :: ${item.name}`);
    }
    lines.push("");
  }

  if (report.governance.reviewOverdue.length > 0) {
    lines.push("### Review Overdue");
    lines.push("");
    for (const item of report.governance.reviewOverdue) {
      lines.push(`- ${item.file} :: ${item.name} (reviewBy ${item.reviewBy})`);
    }
    lines.push("");
  }

  const failingCases = report.cases.filter((testCase) => testCase.status === "fail");
  if (failingCases.length > 0) {
    lines.push("## Failing Tests");
    lines.push("");
    for (const testCase of failingCases) {
      lines.push(`- ${testCase.file} :: ${testCase.name}`);
    }
    lines.push("");
  }

  const skippedCases = report.cases.filter((testCase) => testCase.status === "skip");
  if (skippedCases.length > 0) {
    lines.push("## Skipped Tests");
    lines.push("");
    for (const testCase of skippedCases) {
      lines.push(`- ${testCase.file} :: ${testCase.name}`);
    }
    lines.push("");
  }

  if (report.parseErrors.length > 0) {
    lines.push("## Parse Errors");
    lines.push("");
    for (const parseError of report.parseErrors) {
      lines.push(`- ${parseError}`);
    }
    lines.push("");
  }

  lines.push("## Cases");
  lines.push("");
  lines.push("| status | file | test | validity | reviewBy |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const testCase of report.cases) {
    lines.push(
      `| ${testCase.status} | ${testCase.file} | ${testCase.name} | ${testCase.validity} | ${testCase.reviewBy ?? "-"} |`
    );
  }
  lines.push("");

  return lines.join("\n");
}

function main(): void {
  const allTestFiles = listTestFiles(TESTS_DIR);
  const discoveredCases: DiscoveredCase[] = [];
  for (const fileRel of allTestFiles) {
    const names = extractTestNames(fileRel);
    for (const name of names) {
      discoveredCases.push({ file: fileRel, name });
    }
  }

  const catalogEntries = loadCatalog();
  const catalogByKey = new Map<string, CatalogEntry>();
  const duplicateCatalogEntries: Array<{ file: string; name: string }> = [];

  for (const entry of catalogEntries) {
    const key = keyOf(entry);
    if (catalogByKey.has(key)) {
      duplicateCatalogEntries.push({ file: entry.file, name: entry.name });
      continue;
    }
    catalogByKey.set(key, entry);
  }

  const discoveredByKey = new Map<string, DiscoveredCase>();
  for (const discoveredCase of discoveredCases) {
    discoveredByKey.set(keyOf(discoveredCase), discoveredCase);
  }

  const uncataloged = discoveredCases.filter((testCase) => !catalogByKey.has(keyOf(testCase)));
  const catalogOrphans = catalogEntries.filter((entry) => !discoveredByKey.has(keyOf(entry)));

  if (catalogOnly) {
    console.log(`[catalog] total entries: ${catalogEntries.length}`);
    console.log(`[catalog] discovered tests: ${discoveredCases.length}`);
    console.log(`[catalog] uncataloged: ${uncataloged.length}`);
    console.log(`[catalog] catalog orphans: ${catalogOrphans.length}`);
    console.log(`[catalog] duplicate entries: ${duplicateCatalogEntries.length}`);

    if (uncataloged.length > 0) {
      console.error("[catalog] uncataloged tests:");
      for (const item of uncataloged) {
        console.error(`- ${item.file} :: ${item.name}`);
      }
    }

    if (duplicateCatalogEntries.length > 0) {
      console.error("[catalog] duplicate catalog entries:");
      for (const item of duplicateCatalogEntries) {
        console.error(`- ${item.file} :: ${item.name}`);
      }
    }

    process.exitCode = uncataloged.length > 0 || duplicateCatalogEntries.length > 0 ? 1 : 0;
    return;
  }

  const selectedFiles = includeDiagnostics
    ? allTestFiles
    : allTestFiles.filter((fileRel) => !fileRel.startsWith("tests/diagnostics/"));

  if (selectedFiles.length === 0) {
    throw new Error("No test files found under tests/.");
  }

  const runtimeCases: RuntimeCase[] = [];
  const parseErrors: string[] = [];

  for (const fileRel of selectedFiles) {
    const result = runTestFile(fileRel);
    runtimeCases.push(...result.cases);

    const fileSummary = summarize(result.cases);
    console.log(
      `[test] ${fileRel} total=${fileSummary.total} pass=${fileSummary.pass} fail=${fileSummary.fail} skip=${fileSummary.skip}`
    );

    if (result.parseError) {
      parseErrors.push(result.parseError);
    }

    if (fileSummary.fail > 0 || result.parseError || result.stderr.trim()) {
      if (result.stdout.trim()) {
        process.stderr.write(`\n--- ${fileRel} stdout ---\n`);
        process.stderr.write(result.stdout);
        if (!result.stdout.endsWith("\n")) process.stderr.write("\n");
      }
      if (result.stderr.trim()) {
        process.stderr.write(`\n--- ${fileRel} stderr ---\n`);
        process.stderr.write(result.stderr);
        if (!result.stderr.endsWith("\n")) process.stderr.write("\n");
      }
    }
  }

  const summary = summarize(runtimeCases);
  const generatedAt = new Date().toISOString();
  const today = localDateString();
  const previousReport = loadPreviousReport();
  const previousByKey = new Map<string, TestStatus>();
  if (previousReport) {
    for (const testCase of previousReport.cases) {
      previousByKey.set(keyOf(testCase), testCase.status);
    }
  }

  const reportCases: ReportCase[] = runtimeCases
    .map((testCase) => {
      const catalog = catalogByKey.get(keyOf(testCase));
      if (!catalog) {
        const uncatalogedCase: ReportCase = {
          ...testCase,
          category: "uncataloged",
          validity: "uncataloged",
          owner: null,
          reason: null,
          lastReviewedOn: null,
          reviewBy: null,
        };
        return uncatalogedCase;
      }
      const catalogedCase: ReportCase = {
        ...testCase,
        category: catalog.category,
        validity: catalog.validity,
        owner: catalog.owner,
        reason: catalog.reason,
        lastReviewedOn: catalog.lastReviewedOn,
        reviewBy: catalog.reviewBy,
      };
      return catalogedCase;
    })
    .sort((a, b) => {
      const statusWeight = (status: TestStatus): number => {
        if (status === "fail") return 0;
        if (status === "skip") return 1;
        return 2;
      };
      if (statusWeight(a.status) !== statusWeight(b.status)) {
        return statusWeight(a.status) - statusWeight(b.status);
      }
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.name.localeCompare(b.name);
    });

  const newFailures: DiffItem[] = [];
  const resolved: DiffItem[] = [];
  const newSkips: DiffItem[] = [];

  for (const testCase of reportCases) {
    const previousStatus = previousByKey.get(keyOf(testCase)) ?? "missing";
    if (testCase.status === "fail" && previousStatus !== "fail") {
      newFailures.push({
        file: testCase.file,
        name: testCase.name,
        from: previousStatus,
        to: "fail",
      });
    }
    if (testCase.status === "pass" && previousStatus === "fail") {
      resolved.push({
        file: testCase.file,
        name: testCase.name,
        from: "fail",
        to: "pass",
      });
    }
    if (testCase.status === "skip" && previousStatus !== "skip") {
      newSkips.push({
        file: testCase.file,
        name: testCase.name,
        from: previousStatus,
        to: "skip",
      });
    }
  }

  const outdatedCandidates = catalogEntries.filter((entry) => entry.validity === "outdated-candidate");
  const reviewOverdue = catalogEntries.filter((entry) => entry.reviewBy < today);
  const diagnosticPolicyViolations = catalogEntries.filter(
    (entry) => entry.category === "diagnostic" && entry.validity !== "needs-review"
  );

  const report: ReportJson = {
    generatedAt,
    mode: includeDiagnostics ? "all" : "main",
    summary,
    cases: reportCases,
    diff: {
      newFailures,
      resolved,
      newSkips,
    },
    governance: {
      uncataloged,
      outdatedCandidates,
      reviewOverdue,
      catalogOrphans,
      duplicateCatalogEntries,
      diagnosticPolicyViolations,
    },
    parseErrors,
  };

  mkdirSync(REPORTS_DIR, { recursive: true });
  mkdirSync(HISTORY_DIR, { recursive: true });

  const historyFileStamp = generatedAt.replace(/[:.]/g, "-");
  const historyPath = path.join(HISTORY_DIR, `${historyFileStamp}.json`);

  writeFileSync(LATEST_JSON_PATH, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(historyPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(LATEST_MD_PATH, createMarkdown(report), "utf8");

  console.log(`[report] wrote ${toPosixPath(path.relative(ROOT, LATEST_JSON_PATH))}`);
  console.log(`[report] wrote ${toPosixPath(path.relative(ROOT, LATEST_MD_PATH))}`);
  console.log(`[report] wrote ${toPosixPath(path.relative(ROOT, historyPath))}`);
  console.log(
    `[summary] total=${summary.total} pass=${summary.pass} fail=${summary.fail} skip=${summary.skip}`
  );
  console.log(`[governance] uncataloged=${uncataloged.length} overdue=${reviewOverdue.length}`);

  const hasFailures = summary.fail > 0;
  const hasCatalogErrors = duplicateCatalogEntries.length > 0;
  const hasParseErrors = parseErrors.length > 0;

  process.exitCode = hasFailures || hasCatalogErrors || hasParseErrors ? 1 : 0;
}

try {
  main();
} catch (error) {
  const errorCode = "TEST_REPORTER_FATAL";
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(JSON.stringify({
    errorCode,
    message,
    stack,
    timestamp: new Date().toISOString()
  }));

  process.exitCode = 1;
}

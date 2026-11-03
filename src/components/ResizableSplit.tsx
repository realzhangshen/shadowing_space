"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  DEFAULT_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  clampSplitRatio,
  formatSplitColumns,
  nextSplitRatioForKeyboard,
  parseStoredSplitRatio,
  splitRatioFromPointer,
} from "@/lib/panelSplit";

export type ResizableSplitProps = {
  left: ReactNode;
  right: ReactNode;
  storageKey: string;
  label: string;
  defaultRatio?: number;
};

/**
 * Two-pane layout with a vertical divider that can be dragged, nudged with the
 * keyboard (ArrowLeft / ArrowRight) or reset by double-clicking. The ratio is
 * persisted to localStorage under `storageKey` and exposed to CSS as
 * `--split-left` so the desktop grid can size the panes without re-rendering
 * layout logic in JavaScript.
 */
export const ResizableSplit = forwardRef<HTMLDivElement, ResizableSplitProps>(
  function ResizableSplit(
    { left, right, storageKey, label, defaultRatio = DEFAULT_SPLIT_RATIO },
    forwardedRef,
  ): JSX.Element {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [ratio, setRatio] = useState(() => clampSplitRatio(defaultRatio));
    const ratioRef = useRef(ratio);
    ratioRef.current = ratio;

    const draggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);

    const setContainerRef = useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node;

        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    // Hydrate after mount so server-rendered markup keeps the default ratio.
    useEffect(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored !== null) {
          setRatio(parseStoredSplitRatio(stored));
        }
      } catch {
        // localStorage can be unavailable (private mode, blocked storage); keep default.
      }
    }, [storageKey]);

    const persist = useCallback(
      (next: number) => {
        try {
          window.localStorage.setItem(storageKey, String(next));
        } catch {
          // Persisting is best-effort; resizing still works for this visit.
        }
      },
      [storageKey],
    );

    const applyPointerRatio = useCallback((clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setRatio(splitRatioFromPointer(clientX, { left: rect.left, width: rect.width }));
    }, []);

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingRef.current = true;
        setIsDragging(true);
        applyPointerRatio(event.clientX);
      },
      [applyPointerRatio],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) {
          return;
        }

        applyPointerRatio(event.clientX);
      },
      [applyPointerRatio],
    );

    const handlePointerEnd = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) {
          return;
        }

        draggingRef.current = false;
        setIsDragging(false);

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }

        persist(ratioRef.current);
      },
      [persist],
    );

    const handleKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
          return;
        }

        event.preventDefault();
        // Stop the page-level practice shortcuts from also jumping sentences.
        event.stopPropagation();
        const next = nextSplitRatioForKeyboard(ratioRef.current, event.key);
        if (next === ratioRef.current) {
          return;
        }

        setRatio(next);
        persist(next);
      },
      [persist],
    );

    const handleDoubleClick = useCallback(() => {
      const next = clampSplitRatio(defaultRatio);
      setRatio(next);
      persist(next);
    }, [defaultRatio, persist]);

    const columns = formatSplitColumns(ratio);
    const leftPercent = Math.round(ratio * 100);

    return (
      <div
        ref={setContainerRef}
        className={isDragging ? "resizable-split is-dragging" : "resizable-split"}
        style={{ "--split-left": columns.left } as CSSProperties}
      >
        <div className="resizable-split-pane resizable-split-pane-left">{left}</div>

        <div
          className="split-divider"
          role="separator"
          aria-orientation="vertical"
          aria-label={label}
          aria-valuemin={MIN_SPLIT_RATIO}
          aria-valuemax={MAX_SPLIT_RATIO}
          aria-valuenow={Number(ratio.toFixed(2))}
          aria-valuetext={`${leftPercent}%`}
          title={label}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onKeyDown={handleKeyDown}
          onDoubleClick={handleDoubleClick}
        >
          <span className="split-divider-bar" aria-hidden="true" />
        </div>

        <div className="resizable-split-pane resizable-split-pane-right">{right}</div>
      </div>
    );
  },
);

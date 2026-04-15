"use client";

import { memo, useCallback, useEffect, useRef } from "react";

type WaveformCanvasProps = {
  peaks: Float32Array | null;
  height?: number;
  barColor?: string;
  dimColor?: string;
  progress?: number; // 0..1 — lines after this fraction are dimmed
  className?: string;
  onSeek?: (fraction: number) => void; // click position as 0..1
  livePeaksRef?: { readonly current: Float32Array | null };
  subscribeLivePeaks?: (cb: () => void) => () => void;
  mode?: "scrolling" | "static";
};

const DEFAULT_HEIGHT = 64;
const LINE_WIDTH = 1;
const LINE_GAP = 1;
const LINE_STEP = LINE_WIDTH + LINE_GAP; // 2px
const PLAYHEAD_WIDTH = 1.5;

function drawStatic(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  height: number,
  barColor: string,
  dimColor: string,
  progress: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;

  canvas.width = cssWidth * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, height);

  const lineCount = Math.floor(cssWidth / LINE_STEP);
  if (lineCount <= 0 || peaks.length === 0) return;

  const halfHeight = height / 2;
  const minBarHeight = 2;
  const normalizedProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const progressLine = Math.floor(normalizedProgress * lineCount);

  for (let i = 0; i < lineCount; i++) {
    const peakIdx = Math.floor((i / lineCount) * peaks.length);
    const rawAmplitude = peaks[peakIdx];
    const amplitude = Number.isFinite(rawAmplitude) ? Math.min(1, Math.max(0, rawAmplitude)) : 0;
    const barHeight = Math.max(minBarHeight, amplitude * (height - 4));
    const x = i * LINE_STEP;
    const y = halfHeight - barHeight / 2;

    ctx.fillStyle = i < progressLine ? barColor : dimColor;
    ctx.fillRect(x, y, LINE_WIDTH, barHeight);
  }

  if (normalizedProgress > 0 && normalizedProgress < 1) {
    const playheadX = normalizedProgress * cssWidth;
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = barColor;
    ctx.fillRect(playheadX - PLAYHEAD_WIDTH / 2, 0, PLAYHEAD_WIDTH, height);
    ctx.restore();
  }
}

function drawScrolling(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  height: number,
  barColor: string,
): void {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;

  canvas.width = cssWidth * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, height);

  const visibleCount = Math.floor(cssWidth / LINE_STEP);
  if (visibleCount <= 0 || peaks.length === 0) return;

  const halfHeight = height / 2;
  const minBarHeight = 2;

  const startIdx = Math.max(0, peaks.length - visibleCount);

  ctx.fillStyle = barColor;
  for (let i = 0; i < visibleCount; i++) {
    const peakIdx = startIdx + i;
    if (peakIdx >= peaks.length) break;

    const rawAmplitude = peaks[peakIdx];
    const amplitude = Number.isFinite(rawAmplitude) ? Math.min(1, Math.max(0, rawAmplitude)) : 0;
    const barHeight = Math.max(minBarHeight, amplitude * (height - 4));
    const x = i * LINE_STEP;
    const y = halfHeight - barHeight / 2;

    ctx.fillRect(x, y, LINE_WIDTH, barHeight);
  }
}

export const WaveformCanvas = memo(function WaveformCanvas({
  peaks,
  height = DEFAULT_HEIGHT,
  barColor,
  dimColor,
  progress = 1,
  className,
  onSeek,
  livePeaksRef,
  subscribeLivePeaks,
  mode = "static",
}: WaveformCanvasProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef(peaks);
  const heightRef = useRef(height);
  const colorRef = useRef(barColor);
  const dimColorRef = useRef(dimColor);
  const progressRef = useRef(progress);
  const onSeekRef = useRef(onSeek);
  const modeRef = useRef(mode);

  peaksRef.current = peaks;
  heightRef.current = height;
  colorRef.current = barColor;
  dimColorRef.current = dimColor;
  progressRef.current = progress;
  onSeekRef.current = onSeek;
  modeRef.current = mode;

  const redraw = useCallback((overridePeaks?: Float32Array) => {
    const canvas = canvasRef.current;
    const p = overridePeaks ?? peaksRef.current;
    if (!canvas || !p) return;

    const style = getComputedStyle(canvas);
    const activeColor =
      colorRef.current ??
      (style.getPropertyValue("--text-secondary").trim() || "rgba(38, 37, 30, 0.55)");
    const dim =
      dimColorRef.current ?? (style.getPropertyValue("--muted").trim() || "rgba(38, 37, 30, 0.15)");

    if (modeRef.current === "scrolling") {
      drawScrolling(canvas, p, heightRef.current, activeColor);
    } else {
      drawStatic(canvas, p, heightRef.current, activeColor, dim, progressRef.current);
    }
  }, []);

  useEffect(() => {
    redraw();
  }, [peaks, progress, mode, redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      redraw();
    });
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [redraw]);

  // Live subscription: bypass React reconciliation for real-time drawing
  useEffect(() => {
    if (!subscribeLivePeaks || !livePeaksRef) return;

    return subscribeLivePeaks(() => {
      const p = livePeaksRef.current;
      if (p) redraw(p);
    });
  }, [subscribeLivePeaks, livePeaksRef, redraw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onSeekRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    onSeekRef.current(Math.min(1, Math.max(0, fraction)));
  }, []);

  const isScrolling = mode === "scrolling";

  if (!peaks && !subscribeLivePeaks) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "waveform-canvas"}
      style={{
        width: "100%",
        height,
        display: "block",
        cursor: !isScrolling && onSeek ? "pointer" : undefined,
      }}
      onClick={!isScrolling && onSeek ? handleClick : undefined}
    />
  );
});

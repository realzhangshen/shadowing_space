"use client";

import { memo, useCallback, useEffect, useRef } from "react";

type WaveformCanvasProps = {
  peaks: Float32Array | null;
  height?: number;
  barColor?: string;
  dimColor?: string;
  progress?: number; // 0..1 — bars after this fraction are dimmed
  className?: string;
};

const DEFAULT_HEIGHT = 48;
const BAR_WIDTH = 2;
const BAR_GAP = 1;

function draw(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  height: number,
  barColor: string,
  dimColor: string,
  progress: number
): void {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;

  canvas.width = cssWidth * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, height);

  const step = BAR_WIDTH + BAR_GAP;
  const barCount = Math.floor(cssWidth / step);
  if (barCount <= 0) return;

  const halfHeight = height / 2;
  const minBarHeight = 2;
  const progressBar = Math.floor(progress * barCount);

  for (let i = 0; i < barCount; i++) {
    const peakIdx = Math.floor((i / barCount) * peaks.length);
    const amplitude = peaks[peakIdx];
    const barHeight = Math.max(minBarHeight, amplitude * (height - 4));
    const x = i * step;
    const y = halfHeight - barHeight / 2;

    ctx.fillStyle = i < progressBar ? barColor : dimColor;
    ctx.beginPath();
    ctx.roundRect(x, y, BAR_WIDTH, barHeight, 1);
    ctx.fill();
  }
}

export const WaveformCanvas = memo(function WaveformCanvas({
  peaks,
  height = DEFAULT_HEIGHT,
  barColor,
  dimColor,
  progress = 1,
  className
}: WaveformCanvasProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef(peaks);
  const heightRef = useRef(height);
  const colorRef = useRef(barColor);
  const dimColorRef = useRef(dimColor);
  const progressRef = useRef(progress);

  peaksRef.current = peaks;
  heightRef.current = height;
  colorRef.current = barColor;
  dimColorRef.current = dimColor;
  progressRef.current = progress;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const p = peaksRef.current;
    if (!canvas || !p) return;

    const style = getComputedStyle(canvas);
    const activeColor =
      colorRef.current ??
      (style.getPropertyValue("--text-secondary").trim() ||
      "rgba(38, 37, 30, 0.55)");
    const dim =
      dimColorRef.current ??
      (style.getPropertyValue("--muted").trim() ||
      "rgba(38, 37, 30, 0.15)");

    draw(canvas, p, heightRef.current, activeColor, dim, progressRef.current);
  }, []);

  useEffect(() => {
    redraw();
  }, [peaks, progress, redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      redraw();
    });
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [redraw]);

  if (!peaks) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "waveform-canvas"}
      style={{ width: "100%", height, display: "block" }}
    />
  );
});

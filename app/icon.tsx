import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: "linear-gradient(135deg, #6c5ce7, #a29bfe)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Waveform bars representing audio/speaking */}
        <rect x="1" y="8" width="2.5" height="4" rx="1" fill="white" />
        <rect x="5" y="5" width="2.5" height="10" rx="1" fill="white" />
        <rect x="9" y="3" width="2.5" height="14" rx="1" fill="white" />
        <rect x="13" y="6" width="2.5" height="8" rx="1" fill="white" />
        <rect x="17" y="7" width="2.5" height="6" rx="1" fill="white" />
      </svg>
    </div>,
    { ...size },
  );
}

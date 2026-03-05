import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YouTube Shadowing Practice Tool",
  description:
    "Practice speaking with any YouTube video. Listen, record yourself, and compare side-by-side. All data stays in your browser.",
  alternates: { canonical: "/" },
};

export default function HomePage(): JSX.Element {
  return (
    <div className="homepage">
      <section className="hero">
        <span className="hero-badge">Open Source</span>
        <h2 className="hero-title">
          Practice Speaking{" "}
          <span className="hero-title-accent">with YouTube</span>
        </h2>
        <p className="hero-subtitle">
          Listen to a sentence, repeat it, compare. That&apos;s shadowing — a
          simple way to train pronunciation, rhythm, and fluency.
        </p>
        <div className="hero-actions">
          <Link href="/dashboard" className="btn primary hero-btn">
            Go to Dashboard
          </Link>
          <Link href="/guide" className="btn secondary hero-btn">
            Learn More
          </Link>
        </div>
      </section>

      <section className="features-section">
        <div className="features-row">
          <div className="feature-card-home">
            <span className="feature-icon-home">&#9835;</span>
            <h3>Shadowing practice</h3>
            <p>Follow along sentence by sentence with real-time waveform recording</p>
          </div>
          <div className="feature-card-home">
            <span className="feature-icon-home">&#9654;</span>
            <h3>Works with any YouTube video</h3>
            <p>Paste any link — subtitles are automatically split into segments</p>
          </div>
          <div className="feature-card-home">
            <span className="feature-icon-home">&#9711;</span>
            <h3>Open source &amp; local-first</h3>
            <p>
              All data lives in your browser&apos;s IndexedDB. MIT-licensed, code on GitHub.{" "}
              <Link href="/guide#open-source" className="feature-link">
                Learn more
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

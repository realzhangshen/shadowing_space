import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shadowing Space - Practice Speaking with YouTube"
};

export default function HomePage(): JSX.Element {
  return (
    <div className="homepage">
      <section className="hero">
        <h2 className="hero-title">Practice Speaking with YouTube</h2>
        <p className="hero-subtitle">
          Shadowing is a proven technique: listen, then repeat what you hear
          to train your pronunciation, rhythm, and fluency — one sentence at a time.
        </p>
        <div className="hero-actions">
          <Link href="/dashboard" className="btn primary">
            Go to Dashboard
          </Link>
        </div>
      </section>

      <section className="feature-list">
        <div className="feature-row">
          <span className="feature-icon">🎧</span>
          <div>
            <strong>Shadowing practice</strong>
            <span>Follow along sentence by sentence with real-time waveform recording</span>
          </div>
        </div>
        <div className="feature-row">
          <span className="feature-icon">▶️</span>
          <div>
            <strong>Works with any YouTube video</strong>
            <span>Paste any link — subtitles are automatically split into segments</span>
          </div>
        </div>
        <div className="feature-row">
          <span className="feature-icon">🔒</span>
          <div>
            <strong>Free &amp; private</strong>
            <span>No account, no tracking. Everything stays in your browser.</span>
          </div>
        </div>
      </section>

      <p className="guide-nudge">
        First time here? <Link href="/guide">Read the Guide</Link> to get started.
      </p>
    </div>
  );
}

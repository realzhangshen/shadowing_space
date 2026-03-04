import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shadowing Space - Practice Speaking with YouTube"
};

export default function HomePage(): JSX.Element {
  return (
    <div className="homepage">
      <section className="hero">
        <h2 className="hero-title">
          Practice Speaking{" "}
          <span className="hero-title-accent">with YouTube</span>
        </h2>
        <p className="hero-subtitle">
          Shadowing is a proven technique: listen, then repeat what you hear
          to train your pronunciation, rhythm, and fluency — one sentence at a time.
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
            <h3>Free &amp; private</h3>
            <p>No account, no tracking. Everything stays in your browser.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

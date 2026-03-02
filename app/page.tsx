import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shadowing Space - Improve Your English Pronunciation"
};

export default function HomePage(): JSX.Element {
  return (
    <div className="homepage">
      {/* Hero */}
      <section className="hero">
        <h2 className="hero-title">Improve Your English Pronunciation</h2>
        <p className="hero-subtitle">
          Practice speaking naturally by shadowing YouTube videos sentence by sentence.
          Record yourself, compare with the original, and build confidence at your own pace.
        </p>
        <div className="hero-actions">
          <Link href="/dashboard" className="btn primary">
            Go to Dashboard
          </Link>
          <Link href="/guide" className="btn secondary">
            How It Works
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="features-grid">
        <div className="card feature-card">
          <h3>Import Videos</h3>
          <p>
            Paste any YouTube URL with subtitles. The app extracts sentences
            automatically so you can practice right away.
          </p>
        </div>
        <div className="card feature-card">
          <h3>Sentence Practice</h3>
          <p>
            Listen to each sentence, record yourself repeating it, then compare
            your pronunciation side by side.
          </p>
        </div>
        <div className="card feature-card">
          <h3>Multiple Practice Modes</h3>
          <p>
            Listen &amp; Repeat, Shadow along in real time, or just Listen.
            Practice one sentence at a time or play through everything continuously.
          </p>
        </div>
        <div className="card feature-card">
          <h3>100% Private</h3>
          <p>
            All data stays in your browser. No accounts, no servers storing your
            recordings — just you and your practice.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="how-it-works card">
        <h2>How It Works</h2>
        <div className="steps-grid">
          <div className="step-item">
            <span className="step-number">1</span>
            <h3>Import</h3>
            <p>Paste a YouTube URL with English subtitles and import the video.</p>
          </div>
          <div className="step-item">
            <span className="step-number">2</span>
            <h3>Practice</h3>
            <p>Play each sentence, record yourself, and listen back to compare.</p>
          </div>
          <div className="step-item">
            <span className="step-number">3</span>
            <h3>Compare</h3>
            <p>Use shadow mode to speak along in real time and track your progress.</p>
          </div>
        </div>
        <div className="hero-actions" style={{ marginTop: "1.5rem" }}>
          <Link href="/import" className="btn primary">
            Import Your First Video
          </Link>
        </div>
      </section>
    </div>
  );
}

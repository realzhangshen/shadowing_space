import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shadowing Space - Practice English with YouTube"
};

export default function HomePage(): JSX.Element {
  return (
    <div className="homepage">
      <section className="hero">
        <h2 className="hero-title">Practice English with YouTube</h2>
        <p className="hero-subtitle">
          Shadowing is a proven technique: listen to a native speaker, then repeat what they say
          to train your pronunciation, rhythm, and fluency — one sentence at a time.
        </p>
        <div className="hero-actions">
          <Link href="/dashboard" className="btn primary">
            Go to Dashboard
          </Link>
          <Link href="/import" className="btn secondary">
            Import a Video
          </Link>
        </div>
      </section>

      <section className="value-strip">
        <div className="value-item">
          <strong>Sentence-by-sentence</strong>
          <span>Shadow YouTube videos one sentence at a time</span>
        </div>
        <div className="value-item">
          <strong>Record &amp; compare</strong>
          <span>Live waveform recording with instant playback</span>
        </div>
        <div className="value-item">
          <strong>100% private</strong>
          <span>Everything stays in your browser, no account needed</span>
        </div>
      </section>

      <p className="guide-nudge">
        First time here? <Link href="/guide">Read the Guide</Link> to get started.
      </p>
    </div>
  );
}

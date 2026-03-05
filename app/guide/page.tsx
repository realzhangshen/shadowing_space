import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Guide",
  description:
    "Step-by-step guide to shadowing practice with YouTube videos. Learn manual and auto practice modes, keyboard shortcuts, and answers to common questions.",
  alternates: { canonical: "/guide" },
};

const faqItems = [
  {
    question: "What kind of videos work best?",
    answer:
      "Videos with clear English speech and accurate subtitles work best. Try TED talks, news clips, interviews, or language learning channels. Avoid videos with heavy background music, multiple overlapping speakers, or auto-generated captions that may be inaccurate.",
  },
  {
    question: "My video failed to import. What should I do?",
    answer:
      "Make sure the video has English subtitles (not just auto-generated ones, though those can work too). Some videos have embedding restrictions that prevent playback. Try a different video or check that the URL is correct.",
  },
  {
    question: "Where is my data stored?",
    answer:
      "Everything is stored in your browser using IndexedDB. No data is sent to any server. Your recordings, progress, and imported videos all stay on your device.",
  },
  {
    question: "How do I delete a video or my data?",
    answer:
      "On the Dashboard, each video card has a delete button. To clear all data, you can clear your browser site data for this domain.",
  },
  {
    question: "Does it work on mobile?",
    answer:
      "The app is responsive and works on mobile browsers. However, keyboard shortcuts are only available on desktop. Recording works on most mobile browsers that support the MediaRecorder API.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Practice Shadowing with YouTube Videos",
  description:
    "Use Shadowing Space to improve your pronunciation and fluency by practicing with any YouTube video.",
  tool: [
    { "@type": "HowToTool", name: "A web browser" },
    { "@type": "HowToTool", name: "A microphone" },
  ],
  step: [
    {
      "@type": "HowToStep",
      name: "Paste a YouTube URL",
      text: "Go to the Import page, paste any YouTube video URL with English subtitles, and the app will extract sentences automatically.",
    },
    {
      "@type": "HowToStep",
      name: "Practice shadowing",
      text: "Choose Manual or Auto flow mode. Listen to each sentence, then record yourself repeating it.",
    },
    {
      "@type": "HowToStep",
      name: "Compare and improve",
      text: "Use seekable waveform playback to compare your recording side-by-side with the original and track your progress on the dashboard.",
    },
  ],
  totalTime: "PT10M",
  url: `${siteConfig.url}/guide`,
};

export default function GuidePage(): JSX.Element {
  return (
    <div className="guide">
      <JsonLd data={faqJsonLd} />
      <JsonLd data={howToJsonLd} />
      <header className="guide-header">
        <h2>Guide</h2>
        <p>How it works, features, and shortcuts.</p>
      </header>

      {/* What is Shadowing? */}
      <section className="guide-section card">
        <h3>What is Shadowing?</h3>
        <p>
          Shadowing is a language learning technique where you listen to a native speaker
          and repeat what they say as closely as possible — matching their rhythm, intonation,
          and pronunciation.
        </p>
        <p>
          Shadowing trains your ear and mouth together — pronunciation, listening, and speaking
          all at once. Using real YouTube content means real speech patterns instead of textbook
          phrases.
        </p>
      </section>

      {/* Getting Started */}
      <section className="guide-section card">
        <h3>Getting Started</h3>
        <div className="steps-row">
          <div className="step-card">
            <span className="step-number">1</span>
            <h3>Paste a link</h3>
          </div>
          <div className="step-connector" />
          <div className="step-card">
            <span className="step-number">2</span>
            <h3>Practice</h3>
          </div>
          <div className="step-connector" />
          <div className="step-card">
            <span className="step-number">3</span>
            <h3>Compare</h3>
          </div>
        </div>
        <div className="guide-details">
          <p>Paste a YouTube URL with English subtitles — the app extracts sentences automatically.
             Choose Manual or Auto flow, play each sentence, then record yourself repeating it.
             Use seekable waveform playback to compare side-by-side and track progress on the dashboard.</p>
        </div>
      </section>

      {/* Practice Modes */}
      <section className="guide-section">
        <h3 className="guide-section-title">Practice Modes</h3>
        <div className="guide-card-grid">
          <div className="card guide-mode-card">
            <h4>Manual</h4>
            <p>You control play, record, and navigation. Step through sentences at your own pace.</p>
            <p className="guide-hint">Best for focused, deliberate practice.</p>
          </div>
          <div className="card guide-mode-card">
            <h4>Auto</h4>
            <p>Hands-free loop: playback, then recording starts automatically. Voice activity detection stops recording on silence and advances to the next sentence.</p>
            <p className="guide-hint">Best for immersive, flow-state sessions.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="guide-section">
        <h3 className="guide-section-title">Features</h3>
        <div className="features-grid">
          <div className="card feature-card">
            <h3>Live Waveform</h3>
            <p>Scrolling voice-memo style visualization during recording.</p>
          </div>
          <div className="card feature-card">
            <h3>Waveform Playback</h3>
            <p>Seekable waveform display for recorded audio.</p>
          </div>
          <div className="card feature-card">
            <h3>Speed Control</h3>
            <p>Adjust playback speed from 0.75x to 1.5x.</p>
          </div>
          <div className="card feature-card">
            <h3>Transcript Toggle</h3>
            <p>Blur subtitles to train your ear (press <kbd>T</kbd>).</p>
          </div>
          <div className="card feature-card">
            <h3>Progress Tracking</h3>
            <p>Per-video completion tracking on the dashboard.</p>
          </div>
          <div className="card feature-card">
            <h3>Local-first</h3>
            <p>IndexedDB storage, no servers, no accounts.</p>
          </div>
        </div>
      </section>

      {/* Open Source & Privacy */}
      <section className="guide-section card" id="open-source">
        <h3>Open Source &amp; Privacy</h3>
        <p>
          MIT license. The full source is on GitHub.
        </p>
        <p>
          All data stays in your browser (IndexedDB). Nothing is sent to a server.
        </p>
        <p>
          You can self-host with Vercel, Docker, or any Node.js setup.
        </p>
        <div style={{ marginTop: "1rem" }}>
          <a
            href="https://github.com/realzhangshen/shadowing_space"
            target="_blank"
            rel="noopener noreferrer"
            className="btn secondary open-source-btn"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="guide-section card">
        <h3>Keyboard Shortcuts</h3>
        <table className="shortcuts-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><kbd>Space</kbd></td><td>Play / Pause</td></tr>
            <tr><td><kbd>R</kbd></td><td>Record your voice</td></tr>
            <tr><td><kbd>A</kbd></td><td>Replay original sentence</td></tr>
            <tr><td><kbd>B</kbd></td><td>Play your recording</td></tr>
            <tr><td><kbd>M</kbd></td><td>Toggle flow (Manual / Auto)</td></tr>
            <tr><td><kbd>T</kbd></td><td>Toggle transcript visibility</td></tr>
            <tr><td><kbd>&larr;</kbd></td><td>Previous sentence</td></tr>
            <tr><td><kbd>&rarr;</kbd></td><td>Next sentence</td></tr>
          </tbody>
        </table>
      </section>

      {/* FAQ */}
      <section className="guide-section card">
        <h3>FAQ</h3>

        <details className="faq-item">
          <summary>What kind of videos work best?</summary>
          <p>
            Videos with clear English speech and accurate subtitles work best. Try TED talks,
            news clips, interviews, or language learning channels. Avoid videos with heavy
            background music, multiple overlapping speakers, or auto-generated captions that
            may be inaccurate.
          </p>
        </details>

        <details className="faq-item">
          <summary>My video failed to import. What should I do?</summary>
          <p>
            Make sure the video has English subtitles (not just auto-generated ones, though
            those can work too). Some videos have embedding restrictions that prevent playback.
            Try a different video or check that the URL is correct.
          </p>
        </details>

        <details className="faq-item">
          <summary>Where is my data stored?</summary>
          <p>
            Everything is stored in your browser using IndexedDB. No data is sent to any server.
            Your recordings, progress, and imported videos all stay on your device.
          </p>
        </details>

        <details className="faq-item">
          <summary>How do I delete a video or my data?</summary>
          <p>
            On the Dashboard, each video card has a delete button. To clear all data,
            you can clear your browser site data for this domain.
          </p>
        </details>

        <details className="faq-item">
          <summary>Does it work on mobile?</summary>
          <p>
            The app is responsive and works on mobile browsers. However, keyboard shortcuts
            are only available on desktop. Recording works on most mobile browsers that
            support the MediaRecorder API.
          </p>
        </details>
      </section>
    </div>
  );
}

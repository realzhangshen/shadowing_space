import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guide - Shadowing Space"
};

export default function GuidePage(): JSX.Element {
  return (
    <div className="guide">
      <header className="guide-header">
        <h2>Guide</h2>
        <p>Everything you need to know about Shadowing Space.</p>
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
          Unlike traditional repetition drills, shadowing trains your ear and mouth to work
          together. Research shows it improves pronunciation, listening comprehension, and
          speaking fluency simultaneously. By practicing with real YouTube content, you learn
          natural speech patterns instead of textbook phrases.
        </p>
      </section>

      {/* Getting Started */}
      <section className="guide-section card">
        <h3>Getting Started</h3>
        <div className="guide-steps">
          <div className="guide-step">
            <span className="step-number">1</span>
            <div>
              <strong>Import a Video</strong>
              <p>Paste a YouTube URL with English subtitles. The app extracts sentences automatically.</p>
            </div>
          </div>
          <div className="guide-step">
            <span className="step-number">2</span>
            <div>
              <strong>Practice</strong>
              <p>Choose Manual or Auto flow, play each sentence, record yourself, and compare.</p>
            </div>
          </div>
          <div className="guide-step">
            <span className="step-number">3</span>
            <div>
              <strong>Review &amp; Improve</strong>
              <p>Use seekable waveform playback to compare your recording with the original. Track your progress on the dashboard.</p>
            </div>
          </div>
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
            <h3>Fully Private</h3>
            <p>IndexedDB storage, no servers, no accounts.</p>
          </div>
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

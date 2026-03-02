import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guide - Shadowing Space"
};

export default function GuidePage(): JSX.Element {
  return (
    <div className="guide">
      <header className="guide-header">
        <h2>Guide</h2>
        <p>Everything you need to know about using Shadowing Space.</p>
      </header>

      <nav className="guide-toc card">
        <strong>Contents</strong>
        <ul>
          <li><a href="#what-is-shadowing">What is Shadowing?</a></li>
          <li><a href="#features">App Features</a></li>
          <li><a href="#tutorial">Step-by-Step Tutorial</a></li>
          <li><a href="#shortcuts">Keyboard Shortcuts</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
      </nav>

      <section id="what-is-shadowing" className="guide-section card">
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

      <section id="features" className="guide-section card">
        <h3>App Features</h3>
        <ul>
          <li>Import any YouTube video with English subtitles</li>
          <li>Automatic sentence-by-sentence segmentation</li>
          <li>Adjustable playback speed (0.75x to 1.5x)</li>
          <li>Built-in voice recorder for each sentence</li>
          <li>Side-by-side comparison of original and your recording</li>
          <li>Three practice methods: Listen &amp; Repeat, Shadow, and Listen</li>
          <li>Sentence or continuous (All) playback scope</li>
          <li>Transcript toggle to hide text and train your ear</li>
          <li>Progress tracking per video</li>
          <li>100% client-side — all data stays in your browser</li>
        </ul>
      </section>

      <section id="tutorial" className="guide-section card">
        <h3>Step-by-Step Tutorial</h3>

        <h4>1. Import a Video</h4>
        <p>
          Go to the <strong>Dashboard</strong> and click <strong>Import Video</strong>.
          Paste a YouTube URL that has English subtitles. The app will fetch the video
          and extract subtitle segments automatically.
        </p>

        <h4>2. Choose a Practice Method</h4>
        <p>
          Open any imported video to enter practice mode. Below the playback controls you
          will see two selectors: <strong>Method</strong> and <strong>Scope</strong>.
        </p>
        <ul>
          <li>
            <strong>Listen &amp; Repeat</strong> (press <kbd>1</kbd>) — Play a sentence,
            record yourself repeating it, then replay to compare. Auto-advance moves to the
            next sentence after you finish recording.
          </li>
          <li>
            <strong>Shadow</strong> (press <kbd>2</kbd> or <kbd>S</kbd>) — Play and record
            at the same time. Speak along with the original audio in real time. Use headphones
            so your microphone does not pick up the speaker.
          </li>
          <li>
            <strong>Listen</strong> (press <kbd>3</kbd>) — Play without recording. Good for
            passive listening or reviewing content before practicing.
          </li>
        </ul>

        <h4>3. Choose a Scope</h4>
        <p>
          Press <kbd>C</kbd> to toggle between <strong>Sentence</strong> and <strong>All</strong>.
        </p>
        <ul>
          <li>
            <strong>Sentence</strong> — Plays one sentence at a time. Best for focused practice.
          </li>
          <li>
            <strong>All</strong> — Plays continuously from the current sentence to the end.
            The active sentence highlights as it progresses. Available with Shadow and Listen
            methods.
          </li>
        </ul>
      </section>

      <section id="shortcuts" className="guide-section card">
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
            <tr><td><kbd>1</kbd></td><td>Method: Listen &amp; Repeat</td></tr>
            <tr><td><kbd>2</kbd> / <kbd>S</kbd></td><td>Method: Shadow</td></tr>
            <tr><td><kbd>3</kbd></td><td>Method: Listen</td></tr>
            <tr><td><kbd>C</kbd></td><td>Toggle scope (Sentence / All)</td></tr>
            <tr><td><kbd>T</kbd></td><td>Toggle transcript visibility</td></tr>
            <tr><td><kbd>&larr;</kbd></td><td>Previous sentence</td></tr>
            <tr><td><kbd>&rarr;</kbd></td><td>Next sentence</td></tr>
          </tbody>
        </table>
      </section>

      <section id="faq" className="guide-section card">
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

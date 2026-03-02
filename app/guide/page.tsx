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
          <li>Adjustable playback speed (0.5x to 2x)</li>
          <li>Built-in voice recorder for each sentence</li>
          <li>Side-by-side comparison of original and your recording</li>
          <li>Shadow mode — speak along in real time with auto-advance</li>
          <li>Continuous playback mode for passive listening</li>
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

        <h4>2. Basic Practice</h4>
        <p>
          Open any imported video to enter practice mode. You will see the video player
          on one side and the sentence list on the other. Click any sentence to jump to it.
          Press <kbd>Space</kbd> to play/pause, then press <kbd>R</kbd> to record yourself
          repeating the sentence.
        </p>

        <h4>3. Shadow Mode</h4>
        <p>
          Press <kbd>S</kbd> to toggle shadow mode. In this mode, the app plays each sentence,
          pauses for you to repeat, then automatically advances to the next one. It is the
          closest experience to real-time shadowing practice.
        </p>

        <h4>4. Continuous Play</h4>
        <p>
          Press <kbd>C</kbd> to enable continuous playback. The video plays through all
          sentences without stopping — useful for passive listening or when you want to
          shadow without pauses.
        </p>
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
            <tr><td><kbd>S</kbd></td><td>Toggle shadow mode</td></tr>
            <tr><td><kbd>C</kbd></td><td>Toggle continuous play</td></tr>
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

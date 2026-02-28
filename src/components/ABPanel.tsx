type ABPanelProps = {
  hasRecording: boolean;
  onPlayOriginal: () => void;
  onPlayRecording: () => void;
};

export function ABPanel({ hasRecording, onPlayOriginal, onPlayRecording }: ABPanelProps): JSX.Element {
  return (
    <section className="card">
      <h3>A/B Replay</h3>
      <div className="actions-row">
        <button type="button" className="btn secondary" onClick={onPlayOriginal}>
          Original (A)
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={onPlayRecording}
          disabled={!hasRecording}
        >
          My Recording (B)
        </button>
      </div>
      {!hasRecording ? <p className="muted">No recording for this sentence yet.</p> : null}
    </section>
  );
}

type RecorderPanelProps = {
  isRecording: boolean;
  totalAttempts: number;
  microphoneError?: string;
  onToggleRecording: () => void;
};

export function RecorderPanel({
  isRecording,
  totalAttempts,
  microphoneError,
  onToggleRecording
}: RecorderPanelProps): JSX.Element {
  return (
    <section className="card">
      <h3>Recording</h3>
      <p className="muted">Current sentence recording: {totalAttempts > 0 ? "saved" : "none"}</p>
      <button type="button" className={isRecording ? "btn danger" : "btn primary"} onClick={onToggleRecording}>
        {isRecording ? "Stop Recording (R)" : "Start Recording (R)"}
      </button>
      {microphoneError ? <p className="error-text">{microphoneError}</p> : null}
    </section>
  );
}

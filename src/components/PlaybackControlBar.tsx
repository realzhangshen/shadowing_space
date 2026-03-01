"use client";

type PlaybackControlBarProps = {
  isPlaying: boolean;
  isRecording: boolean;
  hasRecording: boolean;
  onToggleOriginal: () => void;
  onToggleRecording: () => void;
  onPlayRecording: () => void;
};

export function PlaybackControlBar({
  isPlaying,
  isRecording,
  hasRecording,
  onToggleOriginal,
  onToggleRecording,
  onPlayRecording
}: PlaybackControlBarProps): JSX.Element {
  return (
    <div className="control-bar">
      <button
        type="button"
        className="control-btn"
        title={isPlaying ? "Pause" : "Play"}
        onClick={onToggleOriginal}
      >
        <span className="control-icon">{isPlaying ? "\u23F8" : "\u25B6"}</span>
        <span className="control-label">{isPlaying ? "Pause" : "Play"}</span>
      </button>

      <button
        type="button"
        className={isRecording ? "control-btn control-btn-record recording" : "control-btn control-btn-record"}
        title={isRecording ? "Stop recording" : "Record"}
        onClick={onToggleRecording}
      >
        <span className="control-icon">{isRecording ? "\u23F9" : "\uD83C\uDFA4"}</span>
        <span className="control-label">{isRecording ? "Stop" : "Record"}</span>
      </button>

      <button
        type="button"
        className="control-btn"
        title="Play recording"
        disabled={!hasRecording}
        onClick={onPlayRecording}
      >
        <span className="control-icon">{"\uD83C\uDFA7"}</span>
        <span className="control-label">Replay</span>
      </button>
    </div>
  );
}

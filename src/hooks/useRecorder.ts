"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicStatus = "idle" | "acquiring" | "active" | "error";

type RecorderCompletePayload = {
  blob: Blob;
  durationMs: number;
  mimeType: string;
};

type UseRecorderParams = {
  onComplete: (payload: RecorderCompletePayload) => Promise<void> | void;
  onError?: (message: string) => void;
};

const preferredMimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];

export function useRecorder(params: UseRecorderParams): {
  isRecording: boolean;
  micStatus: MicStatus;
  stream: MediaStream | null;
  start: () => Promise<boolean>;
  stop: () => Promise<void>;
} {
  const { onComplete, onError } = params;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const stopResolveRef = useRef<(() => void) | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");

  const stopTracks = useCallback(() => {
    const s = streamRef.current;
    if (!s) {
      return;
    }

    for (const track of s.getTracks()) {
      track.stop();
    }
    streamRef.current = null;
    setStream(null);
    setMicStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      stopTracks();
    };
  }, [stopTracks]);

  const start = useCallback(async (): Promise<boolean> => {
    if (isRecording) {
      return true;
    }

    setMicStatus("acquiring");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStatus("active");

      const mimeType = preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      setStream(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          await onCompleteRef.current({
            blob,
            durationMs: Date.now() - startedAtRef.current,
            mimeType: blob.type || "audio/webm",
          });
        } catch (err) {
          onErrorRef.current?.(err instanceof Error ? err.message : "");
        } finally {
          chunksRef.current = [];
          stopTracks();
          stopResolveRef.current?.();
          stopResolveRef.current = null;
        }
      };

      recorder.start();
      setIsRecording(true);
      return true;
    } catch (error) {
      setMicStatus("error");
      stopTracks();
      setIsRecording(false);
      const message = error instanceof Error ? error.message : "";
      onErrorRef.current?.(message);
      return false;
    }
  }, [isRecording, stopTracks]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    await new Promise<void>((resolve) => {
      stopResolveRef.current = resolve;
      recorder.stop();
    });
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    micStatus,
    stream,
    start,
    stop,
  };
}

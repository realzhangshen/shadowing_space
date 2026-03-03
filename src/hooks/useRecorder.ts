"use client";

import { useCallback, useRef, useState } from "react";

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
  volume: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const { onComplete, onError } = params;
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [volume, setVolume] = useState(0);

  // AnalyserNode refs for volume metering
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number>(0);

  const teardownAnalyser = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setVolume(0);
  }, []);

  const startAnalyser = useCallback((mediaStream: MediaStream) => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(mediaStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    audioCtxRef.current = ctx;
    sourceRef.current = source;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setVolume(Math.min(1, rms * 3)); // amplify for visual range
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTracks = useCallback(() => {
    teardownAnalyser();
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
  }, [teardownAnalyser]);

  const start = useCallback(async () => {
    if (isRecording) {
      return;
    }

    setMicStatus("acquiring");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStatus("active");

      const mimeType = preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

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
          await onComplete({
            blob,
            durationMs: Date.now() - startedAtRef.current,
            mimeType: blob.type || "audio/webm"
          });
        } finally {
          chunksRef.current = [];
          stopTracks();
        }
      };

      recorder.start();
      startAnalyser(stream);
      setIsRecording(true);
    } catch (error) {
      setMicStatus("error");
      stopTracks();
      setIsRecording(false);
      const message =
        error instanceof Error
          ? error.message
          : "Cannot access microphone. Check browser permission settings.";
      onError?.(message);
    }
  }, [isRecording, onComplete, onError, startAnalyser, stopTracks]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    micStatus,
    stream,
    volume,
    start,
    stop
  };
}

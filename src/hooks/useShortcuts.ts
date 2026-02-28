"use client";

import { useEffect } from "react";

type ShortcutHandlers = {
  onPlayOrPauseSource: () => void;
  onToggleRecording: () => void;
  onPlaySource: () => void;
  onPlayAttempt: () => void;
  onPrevSegment: () => void;
  onNextSegment: () => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function useShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case " ":
          event.preventDefault();
          handlers.onPlayOrPauseSource();
          break;
        case "r":
          event.preventDefault();
          handlers.onToggleRecording();
          break;
        case "a":
          event.preventDefault();
          handlers.onPlaySource();
          break;
        case "b":
          event.preventDefault();
          handlers.onPlayAttempt();
          break;
        case "arrowleft":
          event.preventDefault();
          handlers.onPrevSegment();
          break;
        case "arrowright":
          event.preventDefault();
          handlers.onNextSegment();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [handlers]);
}

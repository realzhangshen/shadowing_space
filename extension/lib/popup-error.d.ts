export type PopupErrorKind =
  | "content-script-unreachable"
  | "no-track-selected"
  | "extraction-failed"
  | "permission-denied"
  | "unknown";

export type PopupErrorActionKind = "refresh-tab" | "open-options";

export interface PopupErrorAction {
  kind: PopupErrorActionKind;
  label: string;
}

export interface PopupError {
  kind: PopupErrorKind;
  title: string;
  body: string;
  action: PopupErrorAction | null;
}

export declare function mapPopupError(raw: unknown): PopupError;

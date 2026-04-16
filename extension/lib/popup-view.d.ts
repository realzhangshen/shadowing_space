export type TabKind = "youtube-watch" | "youtube-other" | "non-youtube";

export type PopupView = "ready" | "youtube-nudge" | "welcome";

export interface PickPopupViewInput {
  tabKind: TabKind;
  isFirstRun: boolean;
}

export interface PickPopupViewResult {
  view: PopupView;
  showIntroBanner: boolean;
}

export declare function classifyTab(url: unknown): TabKind;
export declare function pickPopupView(input: PickPopupViewInput): PickPopupViewResult;

export interface CaptionTrackLike {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> };
  vssId?: string;
}

export interface PlayerResponseLike {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrackLike[];
    };
  };
  videoDetails?: {
    videoId?: string;
    title?: string;
    thumbnail?: { thumbnails?: Array<{ url?: string }> };
  };
}

export declare function readPlayerResponse(windowLike: unknown): PlayerResponseLike | null;
export declare function hasUsableCaptionTracks(value: unknown): boolean;
export declare function chooseCaptionTrack(
  tracks: CaptionTrackLike[] | null | undefined,
  options?: { preferredLanguage?: string },
): CaptionTrackLike | null;

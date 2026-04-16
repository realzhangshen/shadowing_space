export declare const HANDOFF_STORAGE_KEY: string;
export declare const HANDOFF_TTL_MS: number;

export interface HandoffEnvelope<TPayload = unknown> {
  version: 1;
  createdAt: number;
  payload: TPayload;
}

export declare function createEnvelope<TPayload>(
  payload: TPayload,
  now?: number,
): HandoffEnvelope<TPayload>;

export declare function isEnvelopeFresh(envelope: unknown, now?: number, ttlMs?: number): boolean;

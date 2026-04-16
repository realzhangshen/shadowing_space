export declare const DEFAULT_IMPORT_ENDPOINT: string;
export declare const LOCAL_IMPORT_ENDPOINT: string;

export type ImportEndpointMode = "prod" | "localhost" | "custom";

export interface ImportEndpointSettings {
  mode?: ImportEndpointMode;
  customUrl?: string;
}

export declare function normalizeImportEndpoint(value: unknown): string | null;
export declare function resolveImportEndpoint(
  settings: ImportEndpointSettings | null | undefined,
): string;

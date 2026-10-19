export type GrowConfig = { baseUrl: string; apiKey: string | undefined; timeoutMs: number };

export type ProviderConfig = { publicBaseUrl: string; grow: GrowConfig; fetch: typeof fetch };

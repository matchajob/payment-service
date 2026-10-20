export type GrowConfig = { baseUrl: string; apiKey: string | undefined; timeoutMs: number };

export type StripeConfig = { baseUrl: string; timeoutMs: number };

export type ProviderConfig = { publicBaseUrl: string; grow: GrowConfig; stripe: StripeConfig; fetch: typeof fetch };

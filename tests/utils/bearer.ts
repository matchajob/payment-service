export const bearer = (apiKey: string): RequestInit => ({ headers: { authorization: `Bearer ${apiKey}` } });

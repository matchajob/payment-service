export const postJson = (apiKey: string, body: unknown): RequestInit => ({
  method: 'POST',
  headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

import { describe, expect, it } from 'vitest';
import { createApp } from '@/api/app';
import { problemSchema } from '@/contract/problem';

describe('createApp', () => {
  it('answers /health', async () => {
    const res = await createApp().request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('answers an unknown route with problem+json', async () => {
    const res = await createApp().request('/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(problemSchema.parse(await res.json()).status).toBe(404);
  });
});

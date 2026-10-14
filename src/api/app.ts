import { Hono } from 'hono';
import type { Problem } from '@/contract/problem';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';
//TODO should be a dict
const NOT_FOUND = 404;
const INTERNAL_ERROR = 500;

const problem = (status: number, title: string, detail?: string): Problem => ({
    type: 'about:blank',
    title,
    status,
    detail,
});

export const createApp = () => {
    const app = new Hono();

    app.get('/health', (c) => c.json({ ok: true }));

    app.notFound((c) =>
        c.body(JSON.stringify(problem(NOT_FOUND, 'Not Found', c.req.path)), NOT_FOUND, {
        'content-type': PROBLEM_CONTENT_TYPE,
        }),
    );

    app.onError((_err, c) =>
        c.body(JSON.stringify(problem(INTERNAL_ERROR, 'Internal Server Error')), INTERNAL_ERROR, {
        'content-type': PROBLEM_CONTENT_TYPE,
        }),
    );

    return app;
};
export const API_INTRODUCTION = `The Payment Service API is organized around REST. It accepts JSON request bodies, returns JSON responses, and uses standard HTTP status codes and bearer authentication.

Each API key belongs to one application and sees only that application's records.

## Authentication

Send your API key in the \`Authorization\` header on every request:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

Keep the key on your server. A missing or unknown key answers \`401\`.

## Idempotency

Every \`POST\` requires an \`Idempotency-Key\` header holding a UUID. Generate it once per intended change, store it with your own record, and send the same key on every retry. A repeat with the same key and body returns the stored answer, including a stored error, and does nothing twice. The same key with a different body answers \`422\`. A repeat while the first request is still running answers \`409\` with \`Retry-After: 1\`. Keys are kept for 24 hours.

## Errors

Errors are [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem documents served as \`application/problem+json\`. The \`detail\` field names the reason.

| Status | Meaning |
| --- | --- |
| \`400\` | The body failed validation, or the Idempotency-Key is missing or not a UUID. |
| \`401\` | The API key is missing or unknown. |
| \`404\` | No such record in your application. |
| \`409\` | The lifecycle refuses the change, the record already exists, or the same key is still running. |
| \`422\` | The Idempotency-Key was used with a different body. |
| \`500\` | Something failed on our side. Retry with the same Idempotency-Key. |

## Webhooks

Every change to a subscription is sent to your webhook URL as a signed event. See the Webhooks section below for each event type, and the [webhook guide](/docs/webhooks/overview/) for verification and delivery rules.

## Versioning

The API is versioned in the path (\`/v1\`). Within a version we only add: new fields in responses, new optional request fields, new endpoints. Ignore fields you do not know. A field is never removed or changed in type within a version.`;

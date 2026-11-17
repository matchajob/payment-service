export const INVOICER_BEHAVIOUR = { ISSUE: 'issue', FAIL: 'fail', LOSE_RESPONSE: 'lose-response' } as const;

export type InvoicerBehaviour = (typeof INVOICER_BEHAVIOUR)[keyof typeof INVOICER_BEHAVIOUR];

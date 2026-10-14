export const REJECTION_REASON = {
    NOT_ACCEPTED_IN_STATE: 'not_accepted_in_state',
    RESUME_NOT_ALLOWED: 'resume_not_allowed',
    STORE_MANAGED: 'store_managed',
} as const;

export type RejectionReason = (typeof REJECTION_REASON)[keyof typeof REJECTION_REASON];
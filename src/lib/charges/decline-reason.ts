import { strMaxSizeTheme } from '@matcha/infra/validations/z-string';

export const UNSPECIFIED_DECLINE = 'declined without a reason';

export const declineReason = (reason: string): string =>
  reason.trim() === '' ? UNSPECIFIED_DECLINE : reason.slice(0, strMaxSizeTheme.errorMessage);

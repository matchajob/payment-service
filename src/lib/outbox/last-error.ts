import { strMaxSizeTheme } from '@matcha/infra/validations/z-string';

export const UNKNOWN_DELIVERY_ERROR = 'unknown delivery error';

export const toLastError = (message: string): string =>
  message.length === 0 ? UNKNOWN_DELIVERY_ERROR : message.slice(0, strMaxSizeTheme.errorMessage);

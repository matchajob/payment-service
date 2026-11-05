export const isIanaTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
};

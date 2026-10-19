const MINOR_PER_MAJOR = 100;
const MINOR_DIGITS = 2;
const GROW_SUM = /^(\d+)(?:\.(\d{1,2}))?$/;
const UNREADABLE_SUM = 'grow sent a sum that is not shekels with up to two decimals';

export const toGrowSum = (amountMinor: number): string =>
  `${Math.trunc(amountMinor / MINOR_PER_MAJOR)}.${String(amountMinor % MINOR_PER_MAJOR).padStart(MINOR_DIGITS, '0')}`;

export const fromGrowSum = (sum: string): number => {
  const match = GROW_SUM.exec(sum);
  if (match === null) throw new Error(UNREADABLE_SUM);
  const [, shekels = '', agorot = ''] = match;
  return Number(shekels) * MINOR_PER_MAJOR + Number(agorot.padEnd(MINOR_DIGITS, '0'));
};

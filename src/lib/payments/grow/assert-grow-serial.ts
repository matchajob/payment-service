const SMALLEST_GROW_IDENTIFIER = 1n;
const LARGEST_GROW_IDENTIFIER = 4294967295n;
const OUT_OF_RANGE = 'grow takes a unique identifier between 1 and 4294967295';

export const assertGrowSerial = (chargeSerial: bigint): void => {
  if (chargeSerial < SMALLEST_GROW_IDENTIFIER || chargeSerial > LARGEST_GROW_IDENTIFIER) throw new Error(OUT_OF_RANGE);
};

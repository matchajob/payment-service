const HEX_BYTES = /^(?:[0-9a-f]{2})+$/i;
const HEX_PAIR = /../g;
const HEX_RADIX = 16;

export const hexToBytes = (hex: string): Uint8Array<ArrayBuffer> | undefined =>
  HEX_BYTES.test(hex) ? Uint8Array.from(hex.match(HEX_PAIR) ?? [], (pair) => parseInt(pair, HEX_RADIX)) : undefined;

// Grow publishes no full example of these replies; shapes follow its field lists. Replace with sandbox recordings.

export const GROW_STATUS_CODE = { NOT_PAID: '0', PAID: '2', DENIED: '9', SUSPENDED: '11' } as const;

export const SAVED_CARD_TOKEN = '8d2b3c4e5f6a7b8c9d0e1f2a3b4c5d6e';
export const PAYER_FULL_NAME = 'ישראל ישראלי';
export const PAYER_PHONE = '0501234567';

type GrowTransactionRow = {
  statusCode: string;
  cardToken?: string;
  transactionId?: string;
  transactionToken?: string;
  sum?: string;
  status?: string;
};

const ok = (data: object): string => JSON.stringify({ status: 1, err: '', data });

const transactionRow = ({
  statusCode,
  cardToken = '',
  transactionId = '0',
  transactionToken = '',
  sum = '0',
  status = '',
}: GrowTransactionRow) => ({
  statusCode,
  status,
  sum,
  transactionId,
  transactionToken,
  cardToken,
  fullName: PAYER_FULL_NAME,
  payerPhone: PAYER_PHONE,
  customField: [],
});

export const processInfoReply = (...rows: GrowTransactionRow[]): string =>
  ok({ transactions: rows.map(transactionRow) });

export const cardSavedReply = (cardToken: string = SAVED_CARD_TOKEN): string =>
  processInfoReply({ statusCode: GROW_STATUS_CODE.SUSPENDED, cardToken, sum: '1.00' });

export const unpaidProcessReply = (): string => processInfoReply({ statusCode: GROW_STATUS_CODE.NOT_PAID });

export const transactionInfoReply = (statusCode: string, sum: string, status = ''): string =>
  ok({ statusCode, status, sum, transactionId: '33500000', transactionToken: 'ecfd', customField: [] });

export const tokenTransactionsReply = (...rows: GrowTransactionRow[]): string =>
  ok({ transactions: rows.map(transactionRow) });

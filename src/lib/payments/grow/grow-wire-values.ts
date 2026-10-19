export const GROW_WIRE_VALUE = {
  CHARGE_TYPE_CREATE_TOKEN: '3',
  SAVE_CARD_TOKEN: '1',
  TOKEN_ONLY_SUM: '1',
  PAYMENT_TYPE_REGULAR: '2',
  SINGLE_PAYMENT: '1',
  NOTIFY_OK_STATUS: '1',
} as const;

export const GROW_FIELD = {
  REFERENCE: 'cField1',
  PAYER_FULL_NAME: 'pageField[fullName]',
  PAYER_PHONE: 'pageField[phone]',
  NOTIFY_STATUS: 'status',
  NOTIFY_PROCESS_ID: 'data[processId]',
  NOTIFY_PROCESS_TOKEN: 'data[processToken]',
  NOTIFY_REFERENCE: 'data[customFields][cField1]',
} as const;

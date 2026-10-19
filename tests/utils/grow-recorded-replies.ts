export const RECORDED_PROCESS_ID = '734754';
export const RECORDED_PROCESS_TOKEN = '2153287cd9af46457ae842337250b78d';
export const RECORDED_CHECKOUT_URL = 'https://sandbox.meshulam.co.il/far?l=89a71a421b8e0686024fbb762dab61e1';

export const RECORDED_CREATE_PROCESS_OK = `{"status":1,"err":"","data":{"processId":"${RECORDED_PROCESS_ID}","processToken":"${RECORDED_PROCESS_TOKEN}","url":"${RECORDED_CHECKOUT_URL}"}}`;

export const RECORDED_MISSING_FIELD_MESSAGE = 'חסרים שדות חובה: pageCode';
export const RECORDED_MISSING_FIELD = `{"err":{"id":54,"message":"${RECORDED_MISSING_FIELD_MESSAGE}"},"status":0,"data":""}`;
export const RECORDED_MISSING_FIELD_STRING_CODES = `{"err":{"id":"54","message":"${RECORDED_MISSING_FIELD_MESSAGE}"},"status":"0","data":""}`;
export const RECORDED_MISSING_FIELD_ID = 54;

export const RECORDED_INVALID_AMOUNT = '{"err":{"id":707,"message":"הסכום אינו תקין"},"status":"0","data":""}';

export const RECORDED_TRANSACTION_ID = '32324365';
export const RECORDED_TRANSACTION_TOKEN = 'bfc899df35258d5b87126e049614ff76';
export const RECORDED_TOKEN_CHARGE_PAID = `{"status":1,"err":"","data":{"asmachta":"293942875","cardSuffix":"3253","cardType":"Local","cardTypeCode":1,"cardBrand":"Visa","cardBrandCode":3,"cardExp":"1123","firstPaymentSum":0,"periodicalPaymentSum":0,"status":"שולם","statusCode":2,"transactionTypeId":"1","paymentType":"2","sum":"3","paymentsNum":0,"allPaymentsNum":1,"paymentDate":"22/8/23","description":"תיאור","fullName":"לקוח לקוח","payerPhone":"0500000000","payerEmail":"test@gmail.com","transactionId":${RECORDED_TRANSACTION_ID},"transactionToken":"${RECORDED_TRANSACTION_TOKEN}"}}`;

export const RECORDED_BAD_TOKEN_MESSAGE = 'לא ניתן לבצע תשלום עם טוקן, קוד מזהה טוקן אינו תקין';
export const RECORDED_BAD_TOKEN = `{"status":0,"err":{"id":140,"message":"${RECORDED_BAD_TOKEN_MESSAGE}"},"data":""}`;

export const RECORDED_STOLEN_CARD_MESSAGE = 'כרטיס גנוב - עסקה לא מאושרת';
export const RECORDED_STOLEN_CARD = `{"err":{"id":103,"message":"${RECORDED_STOLEN_CARD_MESSAGE}"},"status":0,"data":""}`;

export const RECORDED_TRANSACTION_INFO_PAID = `{"status":1,"err":"","data":{"asmachta":"300000209","cardSuffix":"1234","statusCode":2,"status":"שולם","sum":"2","paymentDate":"21/9/23","processId":"5000000","processToken":"d088","transactionId":"33500000","transactionToken":"ecfd","directDebitId":"19123456","recurringDebitId":"20011","customField":[]}}`;
export const RECORDED_TRANSACTION_INFO_PAID_MINOR = 200;

export const RECORDED_UNKNOWN_TRANSACTION =
  '{"status":0,"err":{"id":716,"message":"פרמטר קוד עסקה או תוקן אינו תקין"},"data":""}';

export const RECORDED_UNKNOWN_METHOD = '{"err":"unknown method","status":"0","data":""}';

export const RECORDED_NOTIFY_PROCESS_ID = '337764';
export const RECORDED_NOTIFY_PROCESS_TOKEN = '45c005d458bae927232a671c7934aa31';
export const RECORDED_TOKEN_SAVE_NOTIFY =
  'err=&status=1&data%5Bstatus%5D=%D7%A2%D7%A1%D7%A7%D7%94%20%D7%9E%D7%95%D7%A9%D7%94%D7%99%D7%AA&data%5BstatusCode%5D=11&data%5BtransactionTypeId%5D=1&data%5BpaymentType%5D=2&data%5Bsum%5D=1.00&data%5BpaymentsNum%5D=1&data%5BallPaymentsNum%5D=1&data%5BpaymentDate%5D=26%2F8%2F21&data%5Bdescription%5D=&data%5BfullName%5D=%D7%90%D7%99%D7%99%D7%9C%20%D7%92%D7%A8%D7%A9%D7%95%D7%9F&data%5BpayerPhone%5D=0545283882&data%5BpayerEmail%5D=&data%5BcustomFields%5D%5BcField9%5D=a0d193523d15&data%5BtransactionId%5D=159955&data%5BtransactionToken%5D=9c3093aa96a1226c76899e9e390f08da&data%5BprocessId%5D=337764&data%5BprocessToken%5D=45c005d458bae927232a671c7934aa31';

export const BLOCK_PAGE = '<html><head><title>Request Rejected</title></head><body>Incident ID: 1</body></html>';

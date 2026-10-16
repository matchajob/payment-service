import { declarePaymentServiceStack } from '@iac/payment-service-stack';
import { readStackSettings } from '@iac/stack-settings';

const outputs = declarePaymentServiceStack(readStackSettings());

export const serviceUrl = outputs.serviceUrl;
export const registryUrl = outputs.registryUrl;
export const databaseConnectionName = outputs.databaseConnectionName;
export const providerCredentialsKey = outputs.providerCredentialsKey;
export const cronInvokerEmail = outputs.cronInvokerEmail;
export const cronJobNames = outputs.cronJobNames;
export const deployerEmail = outputs.deployerEmail;
export const workloadIdentityProvider = outputs.workloadIdentityProvider;

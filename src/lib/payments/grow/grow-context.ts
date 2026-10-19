import type { GrowClient } from '@/infra/grow/grow-client';
import type { GrowCredentials } from '@/lib/payments/grow/grow-credentials';

export type GrowContext = { client: GrowClient; credentials: GrowCredentials; notifyUrl: string };

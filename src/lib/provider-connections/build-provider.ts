import { unconfiguredProvider } from '@/lib/payments/unconfigured-provider';
import type { BuildProvider } from '@/lib/provider-connections/provider-for';

export const buildProvider: BuildProvider = () => unconfiguredProvider;

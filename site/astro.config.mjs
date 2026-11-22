// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://payment-service-landing.vercel.app',
  redirects: { '/sdk': '/docs/sdk/' },
  integrations: [
    starlight({
      title: 'Payment Service',
      description: 'Subscription billing on your own card provider account.',
      customCss: ['./src/styles/theme.css'],
      lastUpdated: false,
      pagination: true,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      sidebar: [
        {
          label: 'Get started',
          items: [
            { label: 'Introduction', slug: 'docs' },
            { label: 'Quickstart', slug: 'docs/quickstart' },
            { label: 'How it works', slug: 'docs/how-it-works' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Accept a subscription', slug: 'docs/guides/accept-a-subscription' },
            { label: 'Grant access with entitled', slug: 'docs/guides/grant-access' },
            { label: 'Handle failed payments', slug: 'docs/guides/failed-payments' },
            { label: 'Cancel and resume', slug: 'docs/guides/cancel-and-resume' },
            { label: 'Update a card', slug: 'docs/guides/update-a-card' },
            { label: 'Tax invoices', slug: 'docs/guides/tax-invoices', badge: { text: 'Soon', variant: 'caution' } },
            { label: 'Go-live checklist', slug: 'docs/guides/go-live' },
          ],
        },
        {
          label: 'Concepts',
          items: [
            { label: 'Subscription lifecycle', slug: 'docs/concepts/lifecycle' },
            { label: 'Billing periods', slug: 'docs/concepts/billing-periods' },
            { label: 'Billing policy', slug: 'docs/concepts/billing-policy' },
            { label: 'Organizations and applications', slug: 'docs/concepts/organizations' },
            { label: 'Idempotency', slug: 'docs/concepts/idempotency' },
            { label: 'Errors', slug: 'docs/concepts/errors' },
            { label: 'Money and data safety', slug: 'docs/concepts/safety' },
          ],
        },
        {
          label: 'Webhooks',
          items: [
            { label: 'Overview', slug: 'docs/webhooks/overview' },
            { label: 'Verify signatures', slug: 'docs/webhooks/verify-signatures' },
            { label: 'Event types', slug: 'docs/webhooks/event-types' },
            { label: 'Delivery and retries', slug: 'docs/webhooks/delivery' },
          ],
        },
        {
          label: 'API reference',
          items: [{ label: 'REST API', link: '/api-reference/', attrs: { target: '_self' } }],
        },
        {
          label: 'TypeScript SDK',
          items: [
            { label: 'Overview', slug: 'docs/sdk' },
            { label: 'Configuration', slug: 'docs/sdk/configuration' },
            { label: 'Plans and customers', slug: 'docs/sdk/plans-and-customers' },
            { label: 'Subscriptions', slug: 'docs/sdk/subscriptions' },
            { label: 'Errors and retries', slug: 'docs/sdk/errors-and-retries' },
            { label: 'Verify events', slug: 'docs/sdk/verify-events' },
          ],
        },
        {
          label: 'Resources',
          items: [
            { label: 'Limits and roadmap', slug: 'docs/resources/limits' },
            { label: 'Glossary', slug: 'docs/resources/glossary' },
            { label: 'Changelog', slug: 'docs/resources/changelog' },
          ],
        },
      ],
    }),
  ],
});

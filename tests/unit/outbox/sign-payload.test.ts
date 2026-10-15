import { describe, expect, it } from 'vitest';
import { signPayload } from '@/lib/outbox/sign-payload';

const SECRET = 'whsec_test_secret';
const TIMESTAMP = 1768471200;
const BODY = '{"eventId":"e","type":"subscription.activated"}';
const EXPECTED = '8fee6266f265bb85e0f49d65b947e6310bed35399baf2ad27fc6204b8b93a6ee';

describe('signPayload (Spec 5 rule 5: HMAC-SHA256 over timestamp.body)', () => {
  it('matches the known answer computed independently with openssl', () => {
    expect(signPayload(SECRET, TIMESTAMP, BODY)).toBe(EXPECTED);
  });

  it('changes when one byte of the body changes, so a tampered body fails verification', () => {
    expect(signPayload(SECRET, TIMESTAMP, BODY.replace('activated', 'activatee'))).not.toBe(EXPECTED);
  });

  it('changes with the timestamp, so a replayed body cannot be given a fresh timestamp', () => {
    expect(signPayload(SECRET, TIMESTAMP + 1, BODY)).not.toBe(EXPECTED);
  });

  it('changes with the secret, so one tenant cannot forge events for another', () => {
    expect(signPayload(`${SECRET}-other`, TIMESTAMP, BODY)).not.toBe(EXPECTED);
  });
});

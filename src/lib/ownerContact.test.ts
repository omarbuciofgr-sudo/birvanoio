import { describe, expect, test } from 'bun:test';
import { contactFound, lookupCharge } from '../../supabase/functions/_shared/ownerContact';

describe('owner contact lookups', () => {
  test('five starting lookups are free, not credits', () => {
    for (let left = 5; left > 0; left--) expect(lookupCharge({ phone: true, email: true }, left, 10)).toEqual({ freeUsed: 1, credits: 0 });
  });
  test('misses consume neither a lookup nor credits', () => {
    expect(lookupCharge(contactFound(null), 5, 10)).toEqual({ freeUsed: 0, credits: 0 });
    expect(lookupCharge(contactFound({ phones: [], emails: [] }), 0, 10)).toEqual({ freeUsed: 0, credits: 0 });
  });
  test('name-only or invalid contact is a miss', () => {
    expect(contactFound({ phones: [{ number: 'N/A' }], emails: [{ address: 'unknown' }] })).toEqual({ phone: false, email: false });
  });
  test('phone-only and email-only are successful lookups', () => {
    expect(contactFound({ phones: [{ number: '7135550123' }] }).phone).toBe(true);
    expect(contactFound({ emails: [{ address: 'owner@example.com' }] }).email).toBe(true);
  });
  test('paid lookup uses actual configured cost', () => {
    expect(lookupCharge({ phone: false, email: true }, 0, 17)).toEqual({ freeUsed: 0, credits: 17 });
  });
});
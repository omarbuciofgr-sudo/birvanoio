import { parseBatchDataBody } from './batchData.ts';
import { expect, test } from 'bun:test';
test('reads documented v1 shape with name object', () => {
  const r = parseBatchDataBody({ status: { code: 200 }, results: { persons: [{ name: { first: 'Jane', last: 'Doe', full: 'Jane Doe' }, phoneNumbers: [{ number: '7135551234', type: 'Mobile' }, { number: '7135550000', dnc: true }], emails: [{ email: 'j@x.com' }], meta: { matched: true } }] } });
  expect(r.fullName).toBe('Jane Doe'); expect(r.phones.map(p => p.number)).toEqual(['7135551234']); expect(r.emails[0].address).toBe('j@x.com');
});
test('tolerates legacy names[] and results[0].persons', () => {
  const r = parseBatchDataBody({ results: [{ persons: [{ names: [{ firstName: 'A', lastName: 'B' }], phones: [{ phoneNumber: '2125551234' }], emails: ['a@b.co'] }] }] });
  expect(r.fullName).toBe('A B'); expect(r.phones.length).toBe(1); expect(r.emails[0].address).toBe('a@b.co');
});
test('no persons means no match', () => { expect(parseBatchDataBody({ results: { persons: [] } }).matched).toBe(false); });

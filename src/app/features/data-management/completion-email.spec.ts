import { normalizeRecipientEmail, recipientEmailError } from './completion-email';

describe('completion email contract feedback', () => {
  it.each([
    'bad',
    'a..b@example.test',
    'a@-example.test',
    'a@ex_ample.test',
    'é@example.test',
    'a@[127.0.0.1]',
    'Name <a@example.test>',
    'a\r@example.test',
    'a@example.test\n',
    `${'a'.repeat(65)}@example.test`,
  ])('rejects invalid mailbox %s', (email) => {
    expect(recipientEmailError([email])).not.toBeNull();
  });
  it('requires recipients', () => expect(recipientEmailError([])).not.toBeNull());
  it('bounds the recipient batch', () => {
    expect(
      recipientEmailError(Array.from({ length: 101 }, (_, index) => `a${index}@example.test`)),
    ).not.toBeNull();
  });
  it('accepts local-case distinctions and internal domains', () => {
    expect(recipientEmailError(['A@internal', 'a@internal'])).toBeNull();
  });
  it('rejects duplicate domains case-insensitively', () => {
    expect(recipientEmailError(['a@EXAMPLE.test', 'a@example.test'])).toContain('unique');
  });
  it('preserves local case when normalizing', () => {
    expect(normalizeRecipientEmail('Alice@EXAMPLE.TEST')).toBe('Alice@example.test');
  });
  it('accepts the 254-character boundary', () => {
    expect(
      recipientEmailError([
        `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`,
      ]),
    ).toBeNull();
  });
  it('rejects 255 characters', () => {
    expect(
      recipientEmailError([
        `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`,
      ]),
    ).not.toBeNull();
  });
});

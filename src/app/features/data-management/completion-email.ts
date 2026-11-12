/** Useful client checks for the service contract; server validation remains authoritative. */
export function recipientEmailError(emails: readonly string[]): string | null {
  if (emails.length === 0) {
    return 'Add at least one recipient email address.';
  }
  if (emails.length > 100) {
    return 'Use at most 100 recipient email addresses.';
  }
  const recipients = new Set<string>();
  for (const email of emails) {
    const [local, domain, extra] = email.split('@');
    if (
      email.length > 254 ||
      !/^[\x21-\x7e]+$/.test(email) ||
      !local ||
      local.length > 64 ||
      !domain ||
      extra !== undefined ||
      !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local) ||
      !domain
        .split('.')
        .every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))
    ) {
      return 'Use ASCII email addresses without display names, up to 254 characters (64 before @).';
    }
    const canonical = normalizeRecipientEmail(email);
    if (recipients.has(canonical)) {
      return 'Recipient email addresses must be unique.';
    }
    recipients.add(canonical);
  }
  return null;
}

export function normalizeRecipientEmail(email: string): string {
  const separator = email.lastIndexOf('@');
  return email.slice(0, separator + 1) + email.slice(separator + 1).toLowerCase();
}

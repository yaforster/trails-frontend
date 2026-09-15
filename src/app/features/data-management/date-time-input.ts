export function toIsoDateTime(localDateTimeValue: string): string | null {
  if (!localDateTimeValue) {
    return null;
  }

  const date = new Date(localDateTimeValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toLocalDateTimeInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function taka(value) {
  const amount = Number(value) || 0;
  return `৳${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function shortDate(value) {
  if (!value) return '';
  // SQLite timestamps are UTC without a zone suffix.
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

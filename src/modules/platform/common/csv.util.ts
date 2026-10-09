/**
 * RFC 4180 compliant CSV utility with formula injection protection.
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';

  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);

  // Prevent CSV Formula Injection (=, +, -, @, tab, cr)
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Quote if contains comma, quote, or newline
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function toCsvString(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const rowLines = rows.map((row) => row.map(escapeCsvValue).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

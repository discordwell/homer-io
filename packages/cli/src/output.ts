import chalk from 'chalk';

/**
 * Print a formatted ASCII table to stdout.
 */
export function printTable(headers: string[], rows: string[][]): void {
  if (headers.length === 0) return;

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const dataMax = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, dataMax);
  });

  // Build separator
  const separator = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';

  // Build header row
  const headerRow = '|' + headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('|') + '|';

  // Print
  console.log(separator);
  console.log(headerRow);
  console.log(separator);
  for (const row of rows) {
    const line = '|' + widths.map((w, i) => ` ${(row[i] || '').padEnd(w)} `).join('|') + '|';
    console.log(line);
  }
  console.log(separator);
}

/**
 * Print JSON to stdout with 2-space indent.
 */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Print an informational message to stderr (dim).
 */
export function info(msg: string): void {
  console.error(chalk.dim(msg));
}

/**
 * Print a success message to stderr (green).
 */
export function success(msg: string): void {
  console.error(chalk.green(msg));
}

/**
 * Print an error message to stderr (red).
 */
export function error(msg: string): void {
  console.error(chalk.red(msg));
}

/**
 * Output data — JSON to stdout if --json, otherwise table format.
 * For table output, data must have headers and rows.
 */
export function output(data: unknown, json: boolean): void {
  if (json) {
    printJson(data);
  } else if (Array.isArray(data)) {
    // If data is an array of objects, auto-derive headers
    if (data.length === 0) {
      info('No results.');
      return;
    }
    const first = data[0] as Record<string, unknown>;
    const headers = Object.keys(first);
    const rows = data.map(item => {
      const obj = item as Record<string, unknown>;
      return headers.map(h => String(obj[h] ?? ''));
    });
    printTable(headers, rows);
  } else if (data && typeof data === 'object') {
    // Single object: print key-value pairs
    const obj = data as Record<string, unknown>;
    const headers = ['Field', 'Value'];
    const rows = Object.entries(obj).map(([k, v]) => [k, String(v ?? '')]);
    printTable(headers, rows);
  } else {
    console.log(String(data));
  }
}

/** ISO timestamp -> "YYYY-MM-DD" (what <input type="date"> and the tables expect). */
export const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '');

/** Human-readable date for tables, e.g. "1 Dec 2024". */
export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** Unit cost for tables; "—" when the product has none. */
export const fmtMoney = (n?: number) => (n == null ? '—' : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export const errMsg = (e: unknown, fallback = 'Something went wrong') => (e instanceof Error ? e.message : fallback);

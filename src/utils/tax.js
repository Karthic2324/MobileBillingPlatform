// Per-item GST calculation. Each item: { qty, rate, gst } where gst is a percent (0 if blank).
export const calcInvoice = (items = []) => {
  let taxable = 0;
  let tax = 0;
  const byRate = {};
  items.forEach((i) => {
    const amt = (parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0);
    const g = parseFloat(i.gst) || 0;
    const t = (amt * g) / 100;
    taxable += amt;
    tax += t;
    const k = String(g);
    if (!byRate[k]) byRate[k] = { rate: g, taxable: 0, tax: 0 };
    byRate[k].taxable += amt;
    byRate[k].tax += t;
  });
  return {
    taxable,
    tax,
    total: taxable + tax,
    byRate: Object.values(byRate).sort((a, b) => a.rate - b.rate),
  };
};

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n) => String(n).padStart(2, '0');

// Date -> 'YYYY-MM-DD' using the device's LOCAL calendar day (no timezone shift).
export const toISODate = (d = new Date()) => {
  if (typeof d === 'string' && ISO_RE.test(d)) return d;
  const dt = new Date(d);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

// 'YYYY-MM-DD' -> Date at local midnight.
export const parseISODate = (s) => {
  const m = ISO_RE.exec(String(s || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
};

// 'YYYY-MM-DD' (picked invoice date) or any Date/timestamp -> 'DD-MM-YYYY'
export const formatDate = (d = new Date()) => {
  if (typeof d === 'string') {
    const m = ISO_RE.exec(d);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  const dt = new Date(d);
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`;
};

// The date an invoice BELONGS to. New/updated invoices have invoice_date;
// older ones fall back to the day they were created.
export const getInvoiceDate = (inv = {}) => inv.invoice_date || toISODate(inv.created_at || new Date());

// Indian financial year label for a date (Apr-Mar): 2026-11-10 -> '26-27', 2027-02-01 -> '26-27'
export const financialYearLabel = (iso) => {
  const dt = parseISODate(iso);
  const start = dt.getMonth() >= 3 ? dt.getFullYear() : dt.getFullYear() - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

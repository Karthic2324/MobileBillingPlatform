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

export const formatDate = (d = new Date()) => {
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${dt.getFullYear()}`;
};

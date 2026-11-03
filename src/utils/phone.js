// Keeps only digits and drops a leading 91 / 0 so "+91 98765 43210" -> "9876543210"
export const normalizePhone = (value = '') => {
  let d = String(value).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};
export const isValidMobile = (value) => /^\d{10}$/.test(normalizePhone(value));
export const phoneToEmail = (value) => `${normalizePhone(value)}@multivendor.local`;

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { formatDate, toISODate, getInvoiceDate } from '../utils/tax';

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d = new Date()) => {
  const s = startOfDay(d);
  const diff = (s.getDay() + 6) % 7; // week starts Monday
  s.setDate(s.getDate() - diff);
  return s;
};
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear = (d = new Date()) => new Date(d.getFullYear(), 0, 1);
const startOfLastYear = (d = new Date()) => new Date(d.getFullYear() - 1, 0, 1);
const endOfLastYear = (d = new Date()) => new Date(d.getFullYear() - 1, 11, 31);

// `to` is optional; periods without it run up to today.
const PERIODS = [
  { key: 'day', label: 'Today', from: startOfDay },
  { key: 'week', label: 'This Week', from: startOfWeek },
  { key: 'month', label: 'This Month', from: startOfMonth },
  { key: 'year', label: 'This Year', from: startOfYear },
  { key: 'lastyear', label: 'Last Year', from: startOfLastYear, to: endOfLastYear },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// % change from `before` to `now`; null when there is nothing to compare with.
const pctChange = (now, before) => (before > 0 ? ((now - before) / before) * 100 : null);
const pctText = (p) => (p === null ? '—' : `${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(1)}%`);

const summarize = (list) => {
  let revenue = 0, tax = 0, received = 0;
  list.forEach((i) => {
    revenue += parseFloat(i.total_amount) || 0;
    tax += parseFloat(i.total_tax) || 0;
    received += parseFloat(i.received_amount) || 0;
  });
  return { count: list.length, revenue, tax, received, pending: Math.max(revenue - received, 0) };
};

const inr = (n) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ReportsScreen({ vendorProfile = {} }) {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState('day');

  const load = async () => {
    setLoading(true);
    try {
      // Load from the start of LAST year so the year-on-year comparison has its data
      const earliest = new Date(Math.min(startOfLastYear().getTime(), startOfWeek().getTime()));
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('vendor_id', vendorProfile.id)
        // invoice_date is the billing date; rows without it (old data) fall back to created_at
        .or(`invoice_date.gte.${toISODate(earliest)},and(invoice_date.is.null,created_at.gte.${earliest.toISOString()})`)
        .order('invoice_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      Alert.alert('Report Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (vendorProfile?.id) load();
    }, [vendorProfile?.id])
  );

  // Count an invoice by its billing date: from the period start up to today.
  const inRange = (fromISO, toISOStr) =>
    invoices.filter((i) => {
      const d = getInvoiceDate(i);
      return d >= fromISO && d <= toISOStr;
    });
  const inPeriod = (p) => {
    const today = toISODate(new Date());
    const to = p.to ? toISODate(p.to()) : today;
    return inRange(toISODate(p.from()), to > today ? today : to);
  };

  // ---- Year-on-year comparison ----
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;
  const sThisYear = summarize(inPeriod(PERIODS.find((p) => p.key === 'year')));
  const sLastYearFull = summarize(inPeriod(PERIODS.find((p) => p.key === 'lastyear')));
  // Last year, but only up to today's date (fair comparison with the year so far)
  const sLastYearSame = summarize(
    inRange(toISODate(new Date(lastYear, 0, 1)), toISODate(new Date(lastYear, now.getMonth(), now.getDate())))
  );
  const growth = pctChange(sThisYear.revenue, sLastYearSame.revenue);

  // Month-by-month totals for both years
  const monthly = MONTH_NAMES.map((name, m) => {
    const sum = (year) => {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      return summarize(inRange(`${key}-01`, `${key}-31`)).revenue;
    };
    const cur = sum(thisYear);
    const prev = sum(lastYear);
    return { name, cur, prev, change: pctChange(cur, prev) };
  });
  const active = PERIODS.find((p) => p.key === selected);
  const activeList = inPeriod(active);
  const s = summarize(activeList);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sales Report</Text>

      {/* Quick totals for every period */}
      <View style={styles.grid}>
        {PERIODS.map((p) => {
          const t = summarize(inPeriod(p));
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodCard, selected === p.key && styles.periodCardActive]}
              onPress={() => setSelected(p.key)}
            >
              <Text style={styles.periodLabel}>{p.label}</Text>
              <Text style={styles.periodValue}>{inr(t.revenue)}</Text>
              <Text style={styles.periodSub}>{t.count} invoice{t.count === 1 ? '' : 's'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Detail for selected period */}
      <View style={styles.detail}>
        <Text style={styles.detailTitle}>{active.label} — Details</Text>
        <Row label="Total Sales (incl. GST)" value={inr(s.revenue)} big />
        <Row label="GST Collected" value={inr(s.tax)} />
        <Row label="Amount Received" value={inr(s.received)} />
        <Row label="Pending / Balance" value={inr(s.pending)} warn={s.pending > 0} />
        <Row label="Invoices" value={String(s.count)} />
      </View>

      {/* Year-on-year performance */}
      <View style={styles.detail}>
        <Text style={styles.detailTitle}>{thisYear} vs {lastYear} — Performance</Text>
        <Row label={`${thisYear} sales (so far)`} value={inr(sThisYear.revenue)} big />
        <Row label={`${lastYear} same period`} value={inr(sLastYearSame.revenue)} />
        <Row label={`${lastYear} full year`} value={inr(sLastYearFull.revenue)} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Growth vs same period</Text>
          <Text style={[styles.rowValue, { color: growth === null ? '#94a3b8' : growth >= 0 ? '#34d399' : '#f87171' }]}>
            {pctText(growth)}
          </Text>
        </View>
        <Row label={`${lastYear} invoices`} value={String(sLastYearFull.count)} />
        <Row label={`${lastYear} GST collected`} value={inr(sLastYearFull.tax)} />

        <View style={styles.monthHead}>
          <Text style={[styles.mCell, { flex: 0.8 }]}>Month</Text>
          <Text style={styles.mCell}>{lastYear}</Text>
          <Text style={styles.mCell}>{thisYear}</Text>
          <Text style={[styles.mCell, { flex: 0.9, textAlign: 'right' }]}>Change</Text>
        </View>
        {monthly.map((m) => (
          <View key={m.name} style={styles.monthRow}>
            <Text style={[styles.mCellTxt, { flex: 0.8, color: '#94a3b8' }]}>{m.name}</Text>
            <Text style={styles.mCellTxt}>{inr(m.prev)}</Text>
            <Text style={styles.mCellTxt}>{inr(m.cur)}</Text>
            <Text style={[styles.mCellTxt, { flex: 0.9, textAlign: 'right', color: m.change === null ? '#64748b' : m.change >= 0 ? '#34d399' : '#f87171' }]}>
              {pctText(m.change)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.listTitle}>Invoices in this period</Text>
      {activeList.length === 0 ? (
        <Text style={styles.empty}>No invoices in this period.</Text>
      ) : (
        activeList.map((i) => (
          <View key={i.id} style={styles.invRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invNo}>{i.invoice_no}</Text>
              <Text style={styles.invSub}>{i.customer_name} • {formatDate(getInvoiceDate(i))}</Text>
            </View>
            <Text style={styles.invAmt}>{inr(parseFloat(i.total_amount) || 0)}</Text>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.refresh} onPress={load}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>🔄 Refresh</Text>
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const Row = ({ label, value, big, warn }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, big && { fontSize: 18, color: '#34d399' }, warn && { color: '#fbbf24' }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 14 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  periodCard: { width: '48%', backgroundColor: '#1e293b', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#334155' },
  periodCardActive: { borderColor: '#38bdf8', backgroundColor: '#172a40' },
  periodLabel: { color: '#94a3b8', fontSize: 12 },
  periodValue: { color: '#f8fafc', fontSize: 17, fontWeight: 'bold', marginVertical: 4 },
  periodSub: { color: '#64748b', fontSize: 11 },
  detail: { backgroundColor: '#1e293b', borderRadius: 8, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#334155' },
  detailTitle: { color: '#38bdf8', fontWeight: 'bold', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { color: '#94a3b8', fontSize: 13 },
  rowValue: { color: '#f8fafc', fontWeight: 'bold', fontSize: 14 },
  listTitle: { color: '#f8fafc', fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 10 },
  invRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', padding: 10, borderRadius: 6, marginBottom: 6, borderWidth: 1, borderColor: '#334155' },
  invNo: { color: '#38bdf8', fontWeight: 'bold', fontSize: 13 },
  invSub: { color: '#94a3b8', fontSize: 11 },
  invAmt: { color: '#34d399', fontWeight: 'bold' },
  monthHead: { flexDirection: 'row', marginTop: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#334155' },
  monthRow: { flexDirection: 'row', paddingVertical: 5 },
  mCell: { flex: 1.2, color: '#38bdf8', fontWeight: 'bold', fontSize: 11 },
  mCellTxt: { flex: 1.2, color: '#f8fafc', fontSize: 11 },
  refresh: { backgroundColor: '#334155', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 12 },
});

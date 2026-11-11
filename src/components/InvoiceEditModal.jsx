import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../config/supabase';
import { calcInvoice, getInvoiceDate } from '../utils/tax';
import DatePickerField from './DatePickerField';

const blankRow = () => ({ key: String(Date.now() + Math.random()), description: '', hsn: '', gst: '', qty: '1', rate: '0.00' });

export default function InvoiceEditModal({ visible, invoice, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [received, setReceived] = useState('0');
  const [items, setItems] = useState([]);
  const [oldIds, setOldIds] = useState([]);

  useEffect(() => {
    if (visible && invoice) load();
  }, [visible, invoice?.id]);

  const load = async () => {
    setLoading(true);
    try {
      setInvoiceDate(getInvoiceDate(invoice));
      setCustomerName(invoice.customer_name || '');
      setAddress(invoice.customer_address || '');
      setPhone(invoice.customer_phone || '');
      setReceived(String(invoice.received_amount ?? 0));

      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);
      if (error) throw error;
      // Keep the original row order (line_no is added by supabase_changes.sql; old rows have none)
      data.sort((a, b) => (a.line_no ?? 1e9) - (b.line_no ?? 1e9));

      // Older invoices have no per-item GST saved. If tax was charged, assume the old flat 18%.
      const legacyGst = parseFloat(invoice.total_tax) > 0 ? '18' : '';
      setOldIds((data || []).map((r) => r.id));
      setItems(
        (data || []).length
          ? data.map((r) => ({
              key: String(r.id),
              description: r.description || '',
              hsn: r.hsn_code || '',
              gst: r.gst_percent != null ? (parseFloat(r.gst_percent) > 0 ? String(parseFloat(r.gst_percent)) : '') : legacyGst,
              qty: String(r.qty ?? 1),
              rate: String(r.rate ?? 0),
            }))
          : [blankRow()]
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const update = (key, field, val) =>
    setItems((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: val } : r)));

  const removeRow = (key) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));

  const totals = calcInvoice(items);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: invErr } = await supabase
        .from('invoices')
        .update({
          invoice_date: invoiceDate,
          customer_name: customerName || 'Walk-in Customer',
          customer_address: address,
          customer_phone: phone,
          taxable_amount: totals.taxable,
          total_tax: totals.tax,
          total_amount: totals.total,
          received_amount: parseFloat(received) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);
      if (invErr) throw invErr;

      // Insert the new lines first, then remove the old ones, so a failure never loses data.
      const rows = items.map((i, idx) => ({
        line_no: idx + 1,
        invoice_id: invoice.id,
        vendor_id: invoice.vendor_id,
        description: i.description || 'Item',
        hsn_code: i.hsn || '',
        gst_percent: parseFloat(i.gst) || 0,
        qty: parseFloat(i.qty) || 1,
        rate: parseFloat(i.rate) || 0,
        amount: (parseFloat(i.qty) || 1) * (parseFloat(i.rate) || 0),
      }));
      const { error: insErr } = await supabase.from('invoice_items').insert(rows);
      if (insErr) throw insErr;

      if (oldIds.length) {
        const { error: delErr } = await supabase.from('invoice_items').delete().in('id', oldIds);
        if (delErr) throw delErr;
      }

      Alert.alert('Saved', 'Invoice updated successfully.');
      onSaved && onSaved();
      onClose();
    } catch (err) {
      Alert.alert('Update Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!invoice) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Edit {invoice.invoice_no}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.btnText}>Close</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView style={{ padding: 14 }}>
            <Text style={styles.label}>Invoice Date</Text>
            <DatePickerField dark value={invoiceDate} onChange={setInvoiceDate} />
            <Text style={styles.label}>Customer Name</Text>
            <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName} />
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Text style={[styles.label, { marginTop: 14, color: '#38bdf8' }]}>Items</Text>
            {items.map((r, idx) => (
              <View key={r.key} style={styles.itemCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemNo}>Item {idx + 1}</Text>
                  <TouchableOpacity onPress={() => removeRow(r.key)}>
                    <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
                <TextInput style={styles.input} placeholder="Description" placeholderTextColor="#64748b"
                  value={r.description} onChangeText={(v) => update(r.key, 'description', v)} />
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="HSN" placeholderTextColor="#64748b"
                    value={r.hsn} onChangeText={(v) => update(r.key, 'hsn', v)} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="GST %" placeholderTextColor="#64748b"
                    keyboardType="numeric" value={r.gst} onChangeText={(v) => update(r.key, 'gst', v)} />
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Qty" placeholderTextColor="#64748b"
                    keyboardType="numeric" value={r.qty} onChangeText={(v) => update(r.key, 'qty', v)} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Rate" placeholderTextColor="#64748b"
                    keyboardType="numeric" value={r.rate} onChangeText={(v) => update(r.key, 'rate', v)} />
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addRow} onPress={() => setItems((p) => [...p, blankRow()])}>
              <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>+ Add Item Row</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Received Amount</Text>
            <TextInput style={styles.input} value={received} onChangeText={setReceived} keyboardType="numeric" />

            <View style={styles.totalBox}>
              <Text style={styles.totalLine}>Taxable: ₹{totals.taxable.toFixed(2)}</Text>
              <Text style={styles.totalLine}>GST: ₹{totals.tax.toFixed(2)}</Text>
              <Text style={[styles.totalLine, { fontSize: 16, color: '#34d399' }]}>Total: ₹{totals.total.toFixed(2)}</Text>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
            <View style={{ height: 50 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#ef4444', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  label: { color: '#94a3b8', fontSize: 12, marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#1e293b', color: '#fff', padding: 9, borderRadius: 6, borderWidth: 1, borderColor: '#334155', marginBottom: 6 },
  itemCard: { backgroundColor: '#172033', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemNo: { color: '#f8fafc', fontWeight: 'bold' },
  addRow: { padding: 10, alignItems: 'center', borderRadius: 6, backgroundColor: '#1e293b', marginBottom: 8 },
  totalBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginTop: 10 },
  totalLine: { color: '#f8fafc', fontWeight: 'bold', marginBottom: 2 },
  saveBtn: { backgroundColor: '#059669', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 14 },
});

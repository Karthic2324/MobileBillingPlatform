import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { generateInvoiceHTML } from '../utils/generateInvoiceHTML';
import { formatDate, getInvoiceDate } from '../utils/tax';
import InvoiceEditModal from '../components/InvoiceEditModal';

export default function InvoiceHistoryScreen({ vendorProfile = {}, isAdmin = false }) {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let q = supabase.from('invoices').select('*')
        .order('invoice_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      // A vendor only ever sees their own invoices; the controller sees everything.
      if (!isAdmin && vendorProfile?.id) q = q.eq('vendor_id', vendorProfile.id);
      const { data, error } = await q;
      if (error) throw error;
      setInvoices(data || []);
      applySearch(searchQuery, data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch invoice history: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInvoices();
    }, [vendorProfile?.id, isAdmin])
  );

  const applySearch = (text, list = invoices) => {
    const t = text.trim().toLowerCase();
    if (!t) return setFilteredInvoices(list);
    setFilteredInvoices(
      list.filter(
        (inv) =>
          (inv.invoice_no || '').toLowerCase().includes(t) ||
          (inv.customer_name || '').toLowerCase().includes(t)
      )
    );
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    applySearch(text);
  };

  const handleDownloadPDF = async (inv) => {
    try {
      const { data: lines, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', inv.id);
      if (error) throw error;
      lines.sort((a, b) => (a.line_no ?? 1e9) - (b.line_no ?? 1e9));

      // Always read the latest vendor details so Controller changes appear on the PDF
      let profile = vendorProfile;
      const { data: freshProfile } = await supabase.from('profiles').select('*').eq('id', inv.vendor_id).single();
      if (freshProfile) profile = freshProfile;

      const legacyGst = parseFloat(inv.total_tax) > 0 ? '18' : '';
      const items = (lines || []).map((r) => ({
        description: r.description,
        hsn: r.hsn_code,
        qty: r.qty,
        rate: r.rate,
        gst: r.gst_percent != null ? String(r.gst_percent) : legacyGst,
      }));

      const html = generateInvoiceHTML(
        {
          invoiceNo: inv.invoice_no,
          invoiceDate: formatDate(getInvoiceDate(inv)),
          customerName: inv.customer_name,
          address: inv.customer_address,
          phone: inv.customer_phone,
          items,
          receivedAmount: inv.received_amount,
          bankDetails: {
            name: profile.bank_name || profile.business_name,
            ifsc: profile.ifsc_code,
            accNo: profile.account_no || profile.account_number,
          },
        },
        profile
      );

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert('PDF Error', 'Could not generate or share PDF: ' + error.message);
    }
  };

  const handleDeleteInvoice = (invoiceId) => {
    Alert.alert('Delete Invoice', 'Delete this invoice permanently? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
            const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
            if (error) throw error;
            fetchInvoices();
          } catch (err) {
            Alert.alert('Delete Error', err.message);
          }
        },
      },
    ]);
  };

  const renderInvoiceItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.invoiceNumber}>{item.invoice_no || item.id.slice(0, 6)}</Text>
        <Text style={styles.amount}>₹{parseFloat(item.total_amount || 0).toFixed(2)}</Text>
      </View>
      <Text style={styles.customerText}>Customer: {item.customer_name || 'Walk-in Customer'}</Text>
      <Text style={styles.dateText}>
        Date: {formatDate(getInvoiceDate(item))}
        {item.updated_at ? '  •  edited' : ''}
      </Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.btn, styles.viewBtn]} onPress={() => setEditing(item)}>
          <Text style={styles.btnText}>✏️ Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.pdfBtn]} onPress={() => handleDownloadPDF(item)}>
          <Text style={styles.btnText}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.deleteBtn]} onPress={() => handleDeleteInvoice(item.id)}>
          <Text style={styles.btnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Invoice # or Customer..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : (
        <FlatList
          data={filteredInvoices}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderInvoiceItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>No invoice records found.</Text>}
        />
      )}

      <InvoiceEditModal
        visible={!!editing}
        invoice={editing}
        onClose={() => setEditing(null)}
        onSaved={fetchInvoices}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  searchContainer: { padding: 16, backgroundColor: '#1e293b' },
  searchInput: { backgroundColor: '#0f172a', color: '#fff', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#334155' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { padding: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 8, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  invoiceNumber: { color: '#38bdf8', fontSize: 15, fontWeight: 'bold' },
  amount: { color: '#10b981', fontSize: 16, fontWeight: 'bold' },
  customerText: { color: '#f8fafc', fontSize: 13, marginBottom: 2 },
  dateText: { color: '#94a3b8', fontSize: 11, marginBottom: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },
  btn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 6 },
  viewBtn: { backgroundColor: '#3b82f6' },
  pdfBtn: { backgroundColor: '#8b5cf6' },
  deleteBtn: { backgroundColor: '#ef4444' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: 40 },
});

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../config/supabase';

export default function InvoiceHistoryScreen({ vendorProfile, isAdmin = false }) {
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAllInvoices();
  }, []);

  const fetchAllInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase.from('invoices').select('*').order('created_at', { ascending: false });

      // If regular vendor, restrict ledger strictly to their vendor_id
      if (!isAdmin && vendorProfile?.id) {
        query = query.eq('vendor_id', vendorProfile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.log('Ledger Fetch Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter invoices based on search query (Invoice ID, Customer Name, Phone, or Date)
  const filteredInvoices = invoices.filter((item) => {
    if (!searchQuery.trim()) return false; // Keeps screen blank until search query is entered

    const query = searchQuery.toLowerCase();
    const invNo = (item.invoice_no || '').toLowerCase();
    const custName = (item.customer_name || '').toLowerCase();
    const custPhone = (item.customer_phone || '').toLowerCase();
    const invDate = (item.created_at || '').split('T')[0].toLowerCase();

    return (
      invNo.includes(query) ||
      custName.includes(query) ||
      custPhone.includes(query) ||
      invDate.includes(query)
    );
  });

  return (
    <View style={styles.container}>
      {/* Search Bar Header */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Invoice ID, Name, Phone, or Date..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : (
        <FlatList
          data={filteredInvoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No matching invoices found.'
                  : '🔍 Enter an Invoice ID, Customer Name, Phone Number, or Date to search records.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.invNo}>{item.invoice_no}</Text>
                <Text style={styles.invAmount}>₹{parseFloat(item.total_amount || 0).toFixed(2)}</Text>
              </View>
              <Text style={styles.subText}>Customer: {item.customer_name}</Text>
              <Text style={styles.subText}>Phone: {item.customer_phone || 'N/A'}</Text>
              <Text style={styles.subText}>
                Date: {item.created_at ? item.created_at.split('T')[0] : 'N/A'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  searchContainer: { padding: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  searchInput: { backgroundColor: '#0f172a', color: '#fff', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#334155', fontSize: 13 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: '#1e293b', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  invNo: { color: '#38bdf8', fontWeight: 'bold', fontSize: 14 },
  invAmount: { color: '#34d399', fontWeight: 'bold', fontSize: 14 },
  subText: { color: '#cbd5e1', fontSize: 11, marginTop: 2 },
});
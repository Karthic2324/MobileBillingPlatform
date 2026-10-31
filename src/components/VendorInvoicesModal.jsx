import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../config/supabase';

export default function VendorInvoicesModal({ visible, vendor, onClose }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vendor && visible) {
      fetchVendorInvoices(vendor.id);
    }
  }, [vendor, visible]);

  const fetchVendorInvoices = async (vendorId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('vendor_id', vendorId) // Filter strictly for this specific vendor
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.log('Error fetching vendor invoices:', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!vendor) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header Banner */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              Invoices for: {vendor.business_name || 'Vendor'}
            </Text>
            <Text style={styles.headerSub}>
              GSTIN: {vendor.gstin || 'N/A'} | Phone: {vendor.phone || 'N/A'}
            </Text>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Invoice List */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.loaderText}>Fetching vendor invoice ledger...</Text>
          </View>
        ) : (
          <FlatList
            data={invoices}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.content}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No invoices issued by this vendor yet.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.invNo}>{item.invoice_no}</Text>
                  <Text style={styles.invAmount}>
                    ₹{parseFloat(item.total_amount || 0).toFixed(2)}
                  </Text>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  headerSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  closeBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  content: { padding: 16 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: '#94a3b8', marginTop: 10, fontSize: 13 },
  emptyContainer: { padding: 30, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 13 },
  card: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  invNo: { color: '#38bdf8', fontWeight: 'bold', fontSize: 14 },
  invAmount: { color: '#34d399', fontWeight: 'bold', fontSize: 14 },
  subText: { color: '#cbd5e1', fontSize: 11, marginTop: 2 },
});
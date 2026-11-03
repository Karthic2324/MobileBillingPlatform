import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '../config/supabase';

export default function VendorManagementModal({ visible, vendor, onClose, onRefresh }) {
  if (!vendor) return null;

  const [businessName, setBusinessName] = useState(vendor.business_name || '');
  const [phone, setPhone] = useState(vendor.phone || '');
  const [address, setAddress] = useState(vendor.address || '');
  const [gstin, setGstin] = useState(vendor.gstin || '');
  const [invoicePrefix, setInvoicePrefix] = useState(vendor.invoice_prefix || '');
  const [invoiceStartNo, setInvoiceStartNo] = useState(String(vendor.invoice_start_no || 1001));
  const [bankName, setBankName] = useState(vendor.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(vendor.account_no || vendor.account_number || '');
  const [ifscCode, setIfscCode] = useState(vendor.ifsc_code || '');
  const [updating, setUpdating] = useState(false);

  const handleUpdateVendorProfile = async () => {
    setUpdating(true);
    try {
      // Determine the correct identifier key (fallback from id to vendor_id if necessary)
      const recordId = vendor.id || vendor.vendor_id;

      const { data, error } = await supabase
        .from('profiles') // Check if your table is 'profiles' or 'vendors'
        .update({
          business_name: businessName,
          phone: phone,
          address: address,
          gstin: gstin,
          invoice_prefix: invoicePrefix,
          invoice_start_no: parseInt(invoiceStartNo, 10) || 1001,
          bank_name: bankName,
          account_no: accountNumber,
          ifsc_code: ifscCode,
        })
        .eq('id', recordId)
        .select(); // Returns updated rows to verify success

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No record was updated. Please check your vendor ID configuration.');
      }

      Alert.alert('Success', 'Vendor profile & invoice settings updated successfully!');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      Alert.alert('Update Error', err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Managing: {vendor.business_name}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Section 1: Business Details */}
          <Text style={styles.sectionHeader}>🏢 Business Profile Settings</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Business / Company Name</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
            />

            <Text style={styles.label}>Contact Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Company Address</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={address}
              onChangeText={setAddress}
              multiline
            />
          </View>

          {/* Section 2: Invoice Configurations */}
          <Text style={styles.sectionHeader}>📄 Invoice & Tax Customization</Text>
          <View style={styles.card}>
            <Text style={styles.label}>GSTIN</Text>
            <TextInput
              style={styles.input}
              value={gstin}
              onChangeText={setGstin}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Invoice Number Prefix (e.g., INV, MB/SL)</Text>
            <TextInput
              style={styles.input}
              value={invoicePrefix}
              onChangeText={setInvoicePrefix}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Invoice Starting Number (next invoice will not go below this)</Text>
            <TextInput
              style={styles.input}
              value={invoiceStartNo}
              onChangeText={setInvoiceStartNo}
              keyboardType="numeric"
            />
          </View>

          {/* Section 3: Bank Details */}
          <Text style={styles.sectionHeader}>🏦 Banking Details for Invoices</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Bank Name</Text>
            <TextInput
              style={styles.input}
              value={bankName}
              onChangeText={setBankName}
            />

            <Text style={styles.label}>Account Number</Text>
            <TextInput
              style={styles.input}
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="numeric"
            />

            <Text style={styles.label}>IFSC Code</Text>
            <TextInput
              style={styles.input}
              value={ifscCode}
              onChangeText={setIfscCode}
              autoCapitalize="characters"
            />
          </View>

          {/* Save Action */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleUpdateVendorProfile}
            disabled={updating}
          >
            <Text style={styles.saveBtnText}>
              {updating ? 'Saving Changes...' : 'Save Vendor Configurations'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
  closeBtn: { backgroundColor: '#ef4444', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  content: { padding: 16 },
  sectionHeader: { color: '#38bdf8', fontSize: 14, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
  card: { backgroundColor: '#1e293b', padding: 14, borderRadius: 8, marginBottom: 12 },
  label: { color: '#94a3b8', fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: '#0f172a',
    color: '#fff',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveBtn: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '../config/supabase';

export default function VendorProfileScreen({ onProfileUpdated }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setBusinessName(data.business_name || '');
        setAddress(data.address || '');
        setGstin(data.gstin || '');
        setPhone(data.phone || '');
        setBankName(data.bank_name || '');
        setIfscCode(data.ifsc_code || '');
        setAccountNo(data.account_no || '');
        setInvoicePrefix(data.invoice_prefix || 'INV');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!businessName) {
      Alert.alert('Validation Error', 'Business Name is required.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found.');

      const updates = {
        id: user.id,
        business_name: businessName,
        address,
        gstin,
        phone,
        bank_name: bankName,
        ifsc_code: ifscCode,
        account_no: accountNo,
        invoice_prefix: invoicePrefix,
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) throw error;

      Alert.alert('Success', 'Profile settings updated successfully!');

      if (onProfileUpdated) {
        onProfileUpdated(updates);
      }
    } catch (err) {
      Alert.alert('Save Error', err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Vendor Profile Settings</Text>
      <Text style={styles.headerSub}>
        Update your company details, tax details, and bank credentials.
      </Text>

      {/* Business Details Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Business Information</Text>

        <Text style={styles.label}>Business / Company Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Om Muruga Auto Electrical Works"
          placeholderTextColor="#94a3b8"
          value={businessName}
          onChangeText={setBusinessName}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Shop / Office address"
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={3}
          value={address}
          onChangeText={setAddress}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={styles.label}>GSTIN</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 33DSSPS7678B1Z2"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              value={gstin}
              onChangeText={setGstin}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.label}>Contact Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="9976765151"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
        </View>

        <Text style={styles.label}>Invoice Prefix</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. INV or MB/SL/26-27"
          placeholderTextColor="#94a3b8"
          value={invoicePrefix}
          onChangeText={setInvoicePrefix}
        />
      </View>

      {/* Bank Details Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Banking & Payment Details</Text>

        <Text style={styles.label}>Bank Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. ICICI Bank"
          placeholderTextColor="#94a3b8"
          value={bankName}
          onChangeText={setBankName}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={styles.label}>IFSC Code</Text>
            <TextInput
              style={styles.input}
              placeholder="ICIC0004179"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              value={ifscCode}
              onChangeText={setIfscCode}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.label}>Account Number</Text>
            <TextInput
              style={styles.input}
              placeholder="417905500050"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={accountNo}
              onChangeText={setAccountNo}
            />
          </View>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={styles.saveBtn}
        onPress={handleSaveProfile}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save Profile Settings</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 14 },
  loadingContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#94a3b8', fontSize: 12, marginBottom: 16 },
  card: { backgroundColor: '#1e293b', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 14 },
  cardSectionTitle: { color: '#38bdf8', fontSize: 15, fontWeight: 'bold', marginBottom: 12 },
  label: { color: '#e2e8f0', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 6, color: '#fff', padding: 10, fontSize: 13, marginBottom: 10 },
  multiline: { height: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  saveBtn: { backgroundColor: '#059669', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 30 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
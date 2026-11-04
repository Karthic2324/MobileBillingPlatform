import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '../config/supabase';
import { signupClient } from '../config/supabaseAdminSignup';
import { normalizePhone, isValidMobile, phoneToEmail } from '../utils/phone';
import VendorManagementModal from '../components/VendorManagementModal';
import VendorInvoicesModal from '../components/VendorInvoicesModal';

export default function AdminDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'vendors' | 'ledger'

  // Vendor Modals State
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [invoicesModalVisible, setInvoicesModalVisible] = useState(false);
  const [addVendorModalVisible, setAddVendorModalVisible] = useState(false);

  // New Vendor Registration State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [newInvoicePrefix, setNewInvoicePrefix] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNo, setNewAccountNo] = useState('');
  const [newIfsc, setNewIfsc] = useState('');
  const [creatingVendor, setCreatingVendor] = useState(false);

  // Analytics Metrics
  const [metrics, setMetrics] = useState({
    totalVendors: 0,
    totalInvoices: 0,
    platformRevenue: 0,
    totalProducts: 0,
  });

  const [vendorList, setVendorList] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profileErr } = await supabase.from('profiles').select('*');
      if (profileErr) throw profileErr;

      const { data: invoices, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      if (invErr) throw invErr;

      const { count: productCount, error: prodErr } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
      if (prodErr) throw prodErr;

      const totalRev = (invoices || []).reduce(
        (sum, item) => sum + (parseFloat(item.total_amount) || 0),
        0
      );

      setVendorList(profiles || []);
      setAllInvoices(invoices || []);
      setMetrics({
        totalVendors: (profiles || []).length,
        totalInvoices: (invoices || []).length,
        platformRevenue: totalRev,
        totalProducts: productCount || 0,
      });
    } catch (err) {
      Alert.alert('Admin Access Error', err.message || 'Failed to fetch platform metrics.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApproval = async (vendorId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: !currentStatus })
        .eq('id', vendorId);

      if (error) throw error;
      Alert.alert('Success', `Vendor access ${!currentStatus ? 'GRANTED' : 'REVOKED'}.`);
      fetchAdminData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update vendor status.');
    }
  };

  const handleCreateVendorAccount = async () => {
    if (!newBusinessName || !newPassword) {
      Alert.alert('Validation Error', 'Please fill in Business Name, Mobile Number and Password.');
      return;
    }
    if (!isValidMobile(newPhone)) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number. The vendor logs in with it.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    setCreatingVendor(true);
    try {
      const phone = normalizePhone(newPhone);
      // The vendor logs in with mobile number + password. Supabase needs an email internally,
      // so we use <mobile>@multivendor.local (same rule as the login screen).
      // A separate client is used so the Controller stays logged in.
      const { data: authData, error: authError } = await signupClient.auth.signUp({
        email: phoneToEmail(phone),
        password: newPassword,
        options: { data: { business_name: newBusinessName, phone } },
      });
      if (authError) throw authError;

      const userId = authData?.user?.id;
      if (!userId) throw new Error('Account was not created. This mobile number may already be registered.');

      const details = {
        business_name: newBusinessName,
        phone,
        address: newAddress,
        gstin: newGstin,
        invoice_prefix: newInvoicePrefix || null,
        bank_name: newBankName,
        account_no: newAccountNo,
        ifsc_code: newIfsc,
        role: 'VENDOR',
        is_approved: true,
      };

      // The profile row is created by a database trigger, which can take a moment.
      // Retry a few times and make sure a row was really updated (RLS can silently update 0 rows).
      let saved = false;
      for (let attempt = 0; attempt < 4 && !saved; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 700));
        const { data: rows, error: profErr } = await supabase
          .from('profiles')
          .update(details)
          .eq('id', userId)
          .select();
        if (profErr) throw profErr;
        saved = !!(rows && rows.length);
      }
      if (!saved) {
        throw new Error(
          'Vendor login was created, but the company details could not be saved. ' +
          'Run the latest supabase_changes.sql (controller permissions), then open this vendor and press Edit to save the details.'
        );
      }

      Alert.alert('Success', `Vendor created. They can log in with mobile ${phone} and the password you set.`);
      setNewEmail('');
      setNewPassword('');
      setNewBusinessName('');
      setNewPhone('');
      setNewAddress('');
      setNewGstin('');
      setNewInvoicePrefix('');
      setNewBankName('');
      setNewAccountNo('');
      setNewIfsc('');
      setAddVendorModalVisible(false);
      fetchAdminData();
    } catch (err) {
      Alert.alert('Creation Error', err.message);
    } finally {
      setCreatingVendor(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Loading Controller Metrics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Controller Control Panel</Text>
        <Text style={styles.headerSub}>Manage All the vendors Profiles ....</Text>
      </View>

      {/* Segmented Control Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'overview' && styles.activeTabBtn]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'vendors' && styles.activeTabBtn]}
          onPress={() => setActiveTab('vendors')}
        >
          <Text style={[styles.tabText, activeTab === 'vendors' && styles.activeTabText]}>
            Vendors ({metrics.totalVendors})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ledger' && styles.activeTabBtn]}
          onPress={() => setActiveTab('ledger')}
        >
          <Text style={[styles.tabText, activeTab === 'ledger' && styles.activeTabText]}>
            All invoices History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: Overview Analytics */}
      {activeTab === 'overview' && (
        <ScrollView style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Platform Revenue</Text>
            <Text style={styles.cardValue}>₹{metrics.platformRevenue.toFixed(2)}</Text>
            <Text style={styles.cardSub}>Combined total from all billing vendors</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.card, { flex: 1, marginRight: 6 }]}>
              <Text style={styles.cardLabel}>Active Vendors</Text>
              <Text style={styles.cardValueSmall}>{metrics.totalVendors}</Text>
            </View>
            <View style={[styles.card, { flex: 1, marginLeft: 6 }]}>
              <Text style={styles.cardLabel}>Invoices Issued</Text>
              <Text style={styles.cardValueSmall}>{metrics.totalInvoices}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Global Catalog Items</Text>
            <Text style={styles.cardValueSmall}>{metrics.totalProducts}</Text>
          </View>

          <TouchableOpacity style={styles.refreshBtn} onPress={fetchAdminData}>
            <Text style={styles.refreshBtnText}>🔄 Refresh Real-Time Analytics</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Tab 2: Vendor List */}
      {activeTab === 'vendors' && (
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={styles.addVendorBtn}
            onPress={() => setAddVendorModalVisible(true)}
          >
            <Text style={styles.addVendorBtnText}>➕ Register New Vendor Account</Text>
          </TouchableOpacity>

          <FlatList
            data={vendorList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.content}
            renderItem={({ item }) => (
              <View style={styles.listCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.vendorTitle}>{item.business_name || 'Unnamed Business'}</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      { backgroundColor: item.is_approved ? '#059669' : '#d97706' },
                    ]}
                  >
                    {item.is_approved ? 'APPROVED' : 'PENDING'}
                  </Text>
                </View>

                <Text style={styles.listSubText}>Contact: {item.phone || 'No phone'}</Text>
                <Text style={styles.listSubText}>GSTIN: {item.gstin || 'N/A'}</Text>

                {/* Vendor Actions */}
                <View style={[styles.actionRow, { marginTop: 12 }]}>
                  {item.role !== 'ADMIN' && (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        { backgroundColor: item.is_approved ? '#ef4444' : '#059669' },
                      ]}
                      onPress={() => handleToggleApproval(item.id, item.is_approved)}
                    >
                      <Text style={styles.actionBtnText}>
                        {item.is_approved ? 'Revoke' : 'Grant'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#0284c7' }]}
                    onPress={() => {
                      setSelectedVendor(item);
                      setInvoicesModalVisible(true);
                    }}
                  >
                    <Text style={styles.actionBtnText}>📄 View Invoices</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#475569' }]}
                    onPress={() => {
                      setSelectedVendor(item);
                      setEditModalVisible(true);
                    }}
                  >
                    <Text style={styles.actionBtnText}>⚙️ Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* Tab 3: Global Invoice Ledger */}
      {activeTab === 'ledger' && (
        <FlatList
          data={allInvoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => (
            <View style={styles.listCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.invNo}>{item.invoice_no}</Text>
                <Text style={styles.invAmount}>₹{parseFloat(item.total_amount).toFixed(2)}</Text>
              </View>
              <Text style={styles.listSubText}>Customer: {item.customer_name}</Text>
              <Text style={styles.listSubText}>
                Date: {item.created_at ? item.created_at.split('T')[0] : 'N/A'}
              </Text>
            </View>
          )}
        />
      )}

      {/* Modal 1: Register New Vendor */}
      <Modal visible={addVendorModalVisible} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Register New Vendor Account</Text>
            <TouchableOpacity
              onPress={() => setAddVendorModalVisible(false)}
              style={styles.closeModalBtn}
            >
              <Text style={styles.closeModalBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>Business / Company Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sri Murugan Stores"
              placeholderTextColor="#64748b"
              value={newBusinessName}
              onChangeText={setNewBusinessName}
            />

            <Text style={styles.label}>User Mobile Number (login ID) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter the Mobile Number"
              placeholderTextColor="#64748b"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Account Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum 6 characters"
              placeholderTextColor="#64748b"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <Text style={styles.label}>Company Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Street, City, PIN"
              placeholderTextColor="#64748b"
              value={newAddress}
              onChangeText={setNewAddress}
            />

            <Text style={styles.label}>GSTIN</Text>
            <TextInput
              style={styles.input}
              placeholder="33ABCDE1234F1Z5"
              placeholderTextColor="#64748b"
              value={newGstin}
              onChangeText={setNewGstin}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Invoice Number Prefix</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. OMA"
              placeholderTextColor="#64748b"
              value={newInvoicePrefix}
              onChangeText={setNewInvoicePrefix}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Bank Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. ICICI Bank"
              placeholderTextColor="#64748b"
              value={newBankName}
              onChangeText={setNewBankName}
            />

            <Text style={styles.label}>Bank Account Number</Text>
            <TextInput
              style={styles.input}
              placeholder=""
              placeholderTextColor="#64748b"
              value={newAccountNo}
              onChangeText={setNewAccountNo}
              keyboardType="numeric"
            />

            <Text style={styles.label}>IFSC Code</Text>
            <TextInput
              style={styles.input}
              placeholder="ICIC0001234"
              placeholderTextColor="#64748b"
              value={newIfsc}
              onChangeText={setNewIfsc}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={styles.createVendorActionBtn}
              onPress={handleCreateVendorAccount}
              disabled={creatingVendor}
            >
              <Text style={styles.createVendorActionText}>
                {creatingVendor ? 'Creating Account...' : 'Create & Approve Vendor'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal 2: Vendor Profile Settings Edit */}
      <VendorManagementModal
        key={selectedVendor?.id || 'none'}
        visible={editModalVisible}
        vendor={selectedVendor}
        onClose={() => setEditModalVisible(false)}
        onRefresh={fetchAdminData}
      />

      {/* Modal 3: Specific Vendor Invoices History */}
      <VendorInvoicesModal
        visible={invoicesModalVisible}
        vendor={selectedVendor}
        onClose={() => setInvoicesModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', marginTop: 10, fontSize: 13 },
  header: { backgroundColor: '#1e293b', padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  activeTabBtn: { backgroundColor: '#0284c7' },
  tabText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  activeTabText: { color: '#fff' },
  content: { padding: 12 },
  card: { backgroundColor: '#1e293b', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  row: { flexDirection: 'row' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 6 },
  cardLabel: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  cardValue: { color: '#34d399', fontSize: 26, fontWeight: 'bold', marginVertical: 4 },
  cardValueSmall: { color: '#38bdf8', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  cardSub: { color: '#64748b', fontSize: 11 },
  refreshBtn: { backgroundColor: '#059669', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 4, marginBottom: 20 },
  refreshBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  addVendorBtn: { backgroundColor: '#10b981', marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: 8, alignItems: 'center' },
  addVendorBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  listCard: { backgroundColor: '#1e293b', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  vendorTitle: { color: '#38bdf8', fontWeight: 'bold', fontSize: 15 },
  statusBadge: { color: '#fff', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  listSubText: { color: '#cbd5e1', fontSize: 11, marginTop: 2 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, flex: 1, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  invNo: { color: '#38bdf8', fontWeight: 'bold', fontSize: 14 },
  invAmount: { color: '#34d399', fontWeight: 'bold', fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalHeaderTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  closeModalBtn: { backgroundColor: '#ef4444', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  closeModalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  modalBody: { padding: 16 },
  label: { color: '#94a3b8', fontSize: 12, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: '#1e293b', color: '#fff', padding: 12, borderRadius: 6, borderWidth: 1, borderColor: '#334155' },
  createVendorActionBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  createVendorActionText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
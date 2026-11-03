import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../config/supabase';

export default function AccountScreen({ vendorProfile = {}, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Validation Error', 'Please fill in all three password fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New password and confirm password do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Validation Error', 'New password must be different from the current one.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No active session. Please log in again.');

      // Confirm the current password first
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyErr) throw new Error('Current password is incorrect.');

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      Alert.alert('Success', 'Your password has been changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      Alert.alert('Password Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>My Account</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{vendorProfile.business_name || 'Vendor'}</Text>
        <Text style={styles.sub}>Mobile: {vendorProfile.phone || 'N/A'}</Text>
        <Text style={styles.sub}>Role: {vendorProfile.role || 'VENDOR'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔑 Change Password</Text>
        <Text style={styles.label}>Current Password</Text>
        <TextInput style={styles.input} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} placeholder="••••••••" placeholderTextColor="#64748b" />
        <Text style={styles.label}>New Password</Text>
        <TextInput style={styles.input} secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder="At least 6 characters" placeholderTextColor="#64748b" />
        <Text style={styles.label}>Confirm New Password</Text>
        <TextInput style={styles.input} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" placeholderTextColor="#64748b" />

        <TouchableOpacity style={styles.btn} onPress={handleChangePassword} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Update Password</Text>}
        </TouchableOpacity>
      </View>

      {onLogout && (
        <TouchableOpacity style={styles.logout} onPress={onLogout}>
          <Text style={styles.btnText}>Logout</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 14 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  card: { backgroundColor: '#1e293b', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 14 },
  cardTitle: { color: '#38bdf8', fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  sub: { color: '#94a3b8', fontSize: 13, marginBottom: 2 },
  label: { color: '#94a3b8', fontSize: 12, marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#0f172a', color: '#fff', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#334155' },
  btn: { backgroundColor: '#059669', padding: 12, borderRadius: 6, alignItems: 'center', marginTop: 14 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  logout: { backgroundColor: '#ef4444', padding: 12, borderRadius: 6, alignItems: 'center', marginBottom: 30 },
});

import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../config/supabase';
import InvoiceWorkstation from '../components/InvoiceWorkstation';

export default function VendorInvoiceScreen() {
  const [vendorProfile, setVendorProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentVendorProfile();
  }, []);

  const fetchCurrentVendorProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Session Error', 'No active user found.');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setVendorProfile(data || {});
    } catch (err) {
      Alert.alert('Profile Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#2454c2' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#1e293b', alignItems: 'center' }}>
        <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 12 }}>
          Vendor: {vendorProfile?.business_name || 'My Shop'}
        </Text>
        <TouchableOpacity onPress={handleLogout} style={{ backgroundColor: '#ef4444', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Logout</Text>
        </TouchableOpacity>
      </View>
      <InvoiceWorkstation vendorProfile={vendorProfile} />
    </View>
  );
}
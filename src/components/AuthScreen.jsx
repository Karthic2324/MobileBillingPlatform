import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '../config/supabase';

export default function AuthScreen({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please fill in both email and password.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // 1. Authenticate with Supabase Auth
        const { data: { user }, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // 2. Fetch User Status via RPC (Bypasses RLS block)
        const { data: statusData, error: rpcError } = await supabase
          .rpc('check_user_status', { user_id: user.id });

        if (rpcError) throw rpcError;

        const userStatus = statusData && statusData.length > 0 ? statusData[0] : null;

        const isAdmin = userStatus?.role === 'ADMIN';
        const isApproved = userStatus?.is_approved === true;

        // 3. Block only non-approved vendors
        if (!isAdmin && !isApproved) {
          await supabase.auth.signOut();
          Alert.alert(
            'Access Pending',
            'Your account has been registered, but it requires approval from the Controller Admin before you can log in.'
          );
          setLoading(false);
          return;
        }

        if (onLoginSuccess) onLoginSuccess();
      } else {
        // Registration Flow
        if (!businessName) {
          Alert.alert('Validation Error', 'Please enter your business name.');
          setLoading(false);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              business_name: businessName,
              phone: phone,
            },
          },
        });

        if (signUpError) throw signUpError;

        Alert.alert(
          'Registration Submitted',
          'Your account has been created! Please notify the Controller Admin to grant your access.'
        );
        setIsLogin(true);
      }
    } catch (err) {
      Alert.alert('Authentication Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {isLogin ? 'Vendor Login' : 'Vendor Registration'}
          </Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? 'Access your invoice portal'
              : 'Start generating multi-tenant invoices'}
          </Text>

          {!isLogin && (
            <>
              <Text style={styles.label}>Business Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Om Muruga Auto Electrical Works"
                placeholderTextColor="#94a3b8"
                value={businessName}
                onChangeText={setBusinessName}
              />

              <Text style={styles.label}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="Mobile number"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </>
          )}

          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="vendor@company.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.btn}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {isLogin ? 'Login to Portal' : 'Register Vendor Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 16, alignItems: 'center' }}
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.toggleText}>
              {isLogin
                ? "Don't have an account? Register"
                : 'Already registered? Login'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#cbd5e1',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    color: '#fff',
    padding: 10,
    fontSize: 14,
  },
  btn: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 6,
    marginTop: 20,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  toggleText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '500',
  },
});
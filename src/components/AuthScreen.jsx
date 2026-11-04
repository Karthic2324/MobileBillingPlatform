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
import { normalizePhone, isValidMobile, phoneToEmail } from '../utils/phone';

export default function AuthScreen({ onLoginSuccess }) {
  // Screen modes: 'LOGIN' | 'REGISTER' | 'FORGOT_SEND_OTP' | 'FORGOT_VERIFY_OTP'
  const [mode, setMode] = useState('LOGIN');

  // Input states
  const [loginType, setLoginType] = useState('MOBILE'); // 'MOBILE' | 'EMAIL'
  const [identifier, setIdentifier] = useState(''); // Holds Email or Phone
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper function: Helper to resolve Email vs Phone input
  const isPhoneLogin = loginType === 'MOBILE';
  const resolveTargetEmail = (inputVal) => {
    if (isPhoneLogin) return phoneToEmail(inputVal);
    return inputVal.trim();
  };

  // Helper function: Format raw phone for SMS OTP services
  const getFormattedPhone = (inputVal) => {
    return `+91${normalizePhone(inputVal)}`;
  };

  // Standard Login / Registration Handler
  const handleAuth = async () => {
    if (!identifier) {
      Alert.alert('Validation Error', 'Please enter your email or 10-digit mobile number.');
      return;
    }
    if (!password) {
      Alert.alert('Validation Error', 'Please enter your password.');
      return;
    }

    if (isPhoneLogin && !isValidMobile(identifier)) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    const targetEmail = resolveTargetEmail(identifier);
    const isPhone = isPhoneLogin;
    setLoading(true);

    try {
      if (mode === 'LOGIN') {
        // 1. Authenticate with Supabase Auth
        const { data: { user }, error } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

        if (error) throw error;

        // 2. Fetch User Status via RPC (Bypasses RLS block)
        const { data: statusData, error: rpcErr } = await supabase
          .rpc('check_user_status', { user_id: user.id });

        if (rpcErr) throw rpcErr;

        const userStatus = statusData && statusData.length > 0 ? statusData[0] : null;
        const isAdmin = userStatus?.role === 'ADMIN';
        const isApproved = userStatus?.is_approved === true;

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
      } else if (mode === 'REGISTER') {
        if (!businessName) {
          Alert.alert('Validation Error', 'Please enter your business name.');
          setLoading(false);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password,
          options: {
            data: {
              business_name: businessName,
              phone: isPhone ? normalizePhone(identifier) : null,
              email: !isPhone ? identifier.trim() : null,
            },
          },
        });

        if (signUpError) throw signUpError;

        Alert.alert(
          'Registration Submitted',
          'Your account has been created! Please notify the Controller Admin to grant your access.'
        );
        setMode('LOGIN');
      }
    } catch (err) {
      Alert.alert('Authentication Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 1 of Reset Password: Send Reset Link or OTP
  const handleSendReset = async () => {
    if (!identifier) {
      Alert.alert('Validation Error', 'Please enter your email or 10-digit mobile number.');
      return;
    }

    const isPhone = isPhoneLogin;
    setLoading(true);

    try {
      if (isPhone) {
        // Trigger SMS OTP for phone users
        const formattedPhone = getFormattedPhone(identifier);
        const { error } = await supabase.auth.signInWithOtp({
          phone: formattedPhone,
        });

        if (error) throw error;

        Alert.alert('OTP Sent', `A verification code has been sent via SMS to ${formattedPhone}.`);
        setMode('FORGOT_VERIFY_OTP');
      } else {
        // Trigger Email Reset Link for standard email users
        const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim());

        if (error) throw error;

        Alert.alert('Reset Link Sent', `Password reset instructions have been sent to ${identifier}.`);
        setMode('LOGIN');
      }
    } catch (err) {
      Alert.alert('Reset Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 of Reset Password (Phone OTP verification flow)
  const handleVerifyOtpAndResetPassword = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Validation Error', 'Please enter the 6-digit OTP code.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = getFormattedPhone(identifier);

      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp.trim(),
        type: 'sms',
      });

      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      Alert.alert('Password Updated', 'Your password has been reset successfully! You can now log in.');
      setPassword('');
      setNewPassword('');
      setOtp('');
      setMode('LOGIN');
    } catch (err) {
      Alert.alert('Password Reset Failed', err.message);
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

          {/* TITLE & SUBTITLE */}
          <Text style={styles.title}>
            {mode === 'LOGIN' && 'Invoxa'}
            {mode === 'REGISTER' && 'Vendor Registration'}
            {(mode === 'FORGOT_SEND_OTP' || mode === 'FORGOT_VERIFY_OTP') && '🔑 Reset Password'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'LOGIN' && 'Welcome Back ....!!!!'}
            {mode === 'REGISTER' && 'Create your vendor account to start billing'}
            {mode === 'FORGOT_SEND_OTP' && 'Enter your Email or Mobile Number to reset password'}
            {mode === 'FORGOT_VERIFY_OTP' && `Enter the OTP sent to ${identifier} and set a new password`}
          </Text>

          {/* BUSINESS NAME (Register Only) */}
          {mode === 'REGISTER' && (
            <>
              <Text style={styles.label}>Business Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Om Muruga Auto Electrical Works"
                placeholderTextColor="#94a3b8"
                value={businessName}
                onChangeText={setBusinessName}
              />
            </>
          )}

          {/* EMAIL OR PHONE INPUT (Login / Register / Forgot Password) */}
          {mode !== 'FORGOT_VERIFY_OTP' && (
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, loginType === 'MOBILE' && styles.toggleBtnActive]}
                onPress={() => { setLoginType('MOBILE'); setIdentifier(''); }}
              >
                <Text style={[styles.toggleText, loginType === 'MOBILE' && styles.toggleTextActive]}>📱 Mobile Number</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, loginType === 'EMAIL' && styles.toggleBtnActive]}
                onPress={() => { setLoginType('EMAIL'); setIdentifier(''); }}
              >
                <Text style={[styles.toggleText, loginType === 'EMAIL' && styles.toggleTextActive]}>✉️ Email</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>{isPhoneLogin ? 'Mobile Number *' : 'Email Address *'}</Text>
          <TextInput
            style={styles.input}
            placeholder={isPhoneLogin ? 'Enter Your Mobile Number' : 'Enter your Email '}
            placeholderTextColor="#94a3b8"
            keyboardType={isPhoneLogin ? 'phone-pad' : 'email-address'}
            maxLength={isPhoneLogin ? 13 : undefined}
            autoCapitalize="none"
            value={identifier}
            onChangeText={setIdentifier}
            editable={mode !== 'FORGOT_VERIFY_OTP'}
          />

          {/* PASSWORD (Login & Register Only) */}
          {(mode === 'LOGIN' || mode === 'REGISTER') && (
            <>
              <Text style={styles.label}>Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </>
          )}

          {/* OTP & NEW PASSWORD (FORGOT VERIFY OTP ONLY) */}
          {mode === 'FORGOT_VERIFY_OTP' && (
            <>
              <Text style={styles.label}>SMS OTP Code *</Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit OTP code"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={6}
              />

              <Text style={styles.label}>New Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </>
          )}

          {/* PRIMARY BUTTON */}
          {(mode === 'LOGIN' || mode === 'REGISTER') && (
            <TouchableOpacity
              style={styles.btn}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>
                  {mode === 'LOGIN' ? 'Login to Portal' : 'Register Vendor Account'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {mode === 'FORGOT_SEND_OTP' && (
            <TouchableOpacity
              style={styles.btn}
              onPress={handleSendReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Send Reset Request</Text>
              )}
            </TouchableOpacity>
          )}

          {mode === 'FORGOT_VERIFY_OTP' && (
            <TouchableOpacity
              style={styles.btn}
              onPress={handleVerifyOtpAndResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Verify OTP & Reset Password</Text>
              )}
            </TouchableOpacity>
          )}



        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  toggleText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  toggleTextActive: { color: '#fff' },
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
  forgotText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '500',
  },
});
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Modal,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES } from '../constants/theme';
import client from '../api/client';

export default function LoginScreen({ navigation }) {
  const { login }          = useAuth();
  const [email, setEmail]  = useState('');
  const [pass, setPass]    = useState('');
  const [loading, setLoading] = useState(false);

  // ── Forgot Password state ──────────────────────────────────────
  const [fpVisible, setFpVisible]   = useState(false);
  const [fpStep, setFpStep]         = useState(1);   // 1 = phone entry, 2 = OTP + new pw
  const [fpPhone, setFpPhone]       = useState('');
  const [fpOtp, setFpOtp]           = useState('');
  const [fpNewPw, setFpNewPw]       = useState('');
  const [fpConfirmPw, setFpConfirmPw] = useState('');
  const [fpLoading, setFpLoading]   = useState(false);

  const openForgot = () => {
    setFpStep(1);
    setFpPhone('');
    setFpOtp('');
    setFpNewPw('');
    setFpConfirmPw('');
    setFpVisible(true);
  };

  const closeForgot = () => {
    setFpVisible(false);
  };

  const handleSendOtp = async () => {
    if (!fpPhone.trim()) {
      Alert.alert('Required', 'Please enter your registered phone number.');
      return;
    }
    setFpLoading(true);
    try {
      await client.post('/auth/forgot-password/send-otp', { phone: fpPhone.trim() });
      Alert.alert('OTP Sent', 'A 6-digit code has been sent to your phone number.');
      setFpStep(2);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to send OTP. Try again.');
    } finally {
      setFpLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (fpOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit code.');
      return;
    }
    if (fpNewPw.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (fpNewPw !== fpConfirmPw) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setFpLoading(true);
    try {
      const { data } = await client.post('/auth/forgot-password/reset', {
        phone:                 fpPhone.trim(),
        otp:                   fpOtp,
        password:              fpNewPw,
        password_confirmation: fpConfirmPw,
      });
      Alert.alert('Success', data.message || 'Password reset! Please log in.', [
        { text: 'OK', onPress: closeForgot },
      ]);
    } catch (e) {
      const msg = e?.response?.data?.message
        || e?.response?.data?.errors?.otp?.[0]
        || 'Reset failed. Check your OTP and try again.';
      Alert.alert('Error', msg);
    } finally {
      setFpLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !pass) { Alert.alert('Error', 'Please fill in all fields'); return; }
    setLoading(true);
    try {
      await login(email.trim(), pass);
      // Don't manually navigate — AppNavigator will reactively update based on user state
      // This avoids race conditions where the component redirects before AuthContext updates
    } catch (e) {
      const msg = e?.response?.data?.message || 'Invalid credentials.';
      Alert.alert('Login Failed', msg);
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.sub}>Sign in to your DropStore account</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email / Phone</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email or phone"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#aaa"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={pass}
            onChangeText={setPass}
            placeholder="••••••••"
            secureTextEntry
            placeholderTextColor="#aaa"
          />

          {/* Forgot Password link */}
          <TouchableOpacity onPress={openForgot} style={styles.forgotLink}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>Don't have an account? <Text style={styles.linkAccent}>Register</Text></Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Forgot Password Modal ────────────────────────────── */}
      <Modal visible={fpVisible} animationType="slide" transparent onRequestClose={closeForgot}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <Text style={styles.modalSub}>
                    {fpStep === 1
                      ? 'Enter your registered phone number'
                      : 'Enter the OTP and your new password'}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeForgot} style={styles.modalClose}>
                  <MaterialCommunityIcons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Step 1: Phone */}
              {fpStep === 1 && (
                <>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    value={fpPhone}
                    onChangeText={setFpPhone}
                    placeholder="Your registered phone number"
                    keyboardType="phone-pad"
                    placeholderTextColor="#aaa"
                  />
                  <TouchableOpacity style={[styles.btn, { marginTop: 20 }]} onPress={handleSendOtp} disabled={fpLoading}>
                    {fpLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.btnText}>Send OTP</Text>}
                  </TouchableOpacity>
                </>
              )}

              {/* Step 2: OTP + new password */}
              {fpStep === 2 && (
                <>
                  <Text style={styles.label}>One-Time Code</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    value={fpOtp}
                    onChangeText={setFpOtp}
                    placeholder="6-digit code"
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholderTextColor="#aaa"
                  />

                  <Text style={styles.label}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    value={fpNewPw}
                    onChangeText={setFpNewPw}
                    placeholder="At least 8 characters"
                    secureTextEntry
                    placeholderTextColor="#aaa"
                  />

                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    value={fpConfirmPw}
                    onChangeText={setFpConfirmPw}
                    placeholder="Repeat new password"
                    secureTextEntry
                    placeholderTextColor="#aaa"
                  />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnSecondary]}
                      onPress={() => { setFpStep(1); setFpOtp(''); }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <MaterialCommunityIcons name="arrow-left" size={16} color={COLORS.primary} />
                        <Text style={styles.btnSecondaryText}>Resend</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleResetPassword} disabled={fpLoading}>
                      {fpLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.btnText}>Reset Password</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  inner    : { padding: 24, paddingTop: 60 },
  title    : { fontSize: 30, fontWeight: '800', color: COLORS.black },
  sub      : { color: '#888', marginTop: 4, marginBottom: 32, fontSize: 15 },
  form     : { gap: 4 },
  label    : { fontSize: 13, fontWeight: '600', color: COLORS.black, marginBottom: 4, marginTop: 12 },
  input    : {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.black,
    backgroundColor: COLORS.grey,
  },
  otpInput : { letterSpacing: 8, fontSize: 22, textAlign: 'center' },
  btn      : { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnText  : { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary : { flex: 0, paddingHorizontal: 18, backgroundColor: '#f1f5f9', marginTop: 0 },
  btnSecondaryText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  forgotLink: { alignSelf: 'flex-end', marginTop: 8 },
  forgotText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  link     : { textAlign: 'center', color: '#888', marginTop: 24, fontSize: 14 },
  linkAccent: { color: COLORS.primary, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 40, width: '100%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.black },
  modalSub  : { fontSize: 13, color: '#888', marginTop: 2, maxWidth: '85%' },
  modalClose: { padding: 4 },
  modalCloseText: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
});

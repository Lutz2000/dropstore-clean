import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

const COUNTRIES = ['Uganda','Kenya','Tanzania','Rwanda','Burundi','South Sudan','DR Congo'];

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [role, setRole]   = useState('buyer');
    const [form, setForm]   = useState({
    name: '', phone: '', email: '', referral_agent_name: '',
    gender: 'male', age: '', country: 'Uganda',
    password: '', password_confirmation: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRegister = async () => {
    setErrors({});
    setLoading(true);
    try {
      await register({ ...form, role });
      // Don't manually navigate — AppNavigator will reactively update based on user state
      // This avoids race conditions where the component redirects before AuthContext updates
    } catch (e) {
      if (e?.response?.status === 422) {
        if (e.response.data.redirect === 'subscription_packages') {
          Alert.alert(
            'Free Account Already Used',
            e.response.data.message || 'A free vendor account has already been created from this device. Please log in to your existing account.',
            [{ text: 'OK' }]
          );
        } else {
          setErrors(e.response.data.errors || {});
        }
      } else {
        Alert.alert('Error', e?.response?.data?.message || 'Registration failed.');
      }
    } finally { setLoading(false); }
  };

  const err = (k) => errors[k] ? <Text style={styles.error}>{errors[k][0]}</Text> : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.sub}>Join DropStore today</Text>

        {/* Role Tabs */}
        <View style={styles.tabs}>
          {['buyer','vendor'].map(r => (
            <TouchableOpacity key={r} style={[styles.tab, role === r && styles.tabActive]} onPress={() => setRole(r)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <MaterialCommunityIcons name={r === 'buyer' ? 'shopping-cart' : 'store'} size={18} color={role === r ? '#fff' : COLORS.primary} />
                <Text style={[styles.tabText, role === r && styles.tabTextActive]}>
                  {r === 'buyer' ? 'Buyer' : 'Vendor'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

                {/* Name + Phone */}
        <View style={styles.row2}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={v => set('name', v)}
              placeholder="John Doe" keyboardType="default" autoCapitalize="words" placeholderTextColor="#aaa" />
            {err('name')}
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Phone *</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={v => set('phone', v)}
              placeholder="+256 700 000000" keyboardType="phone-pad" autoCapitalize="none" placeholderTextColor="#aaa" />
            {err('phone')}
          </View>
        </View>

        {/* Email */}
        <Text style={styles.label}>Email Address *</Text>
        <View style={styles.iconInputWrap}>
          <MaterialCommunityIcons name="email-outline" size={16} color="#aaa" style={styles.inputIcon} />
          <TextInput style={[styles.input, styles.inputWithIcon]} value={form.email} onChangeText={v => set('email', v)}
            placeholder="john@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#aaa" />
        </View>
        {err('email')}

        {/* Referral Agent — free text, optional */}
        <Text style={styles.label}>Referral Agent Name <Text style={styles.labelOptional}>(Optional)</Text></Text>
        <View style={styles.iconInputWrap}>
          <MaterialCommunityIcons name="account-tie-outline" size={16} color="#aaa" style={styles.inputIcon} />
          <TextInput
            style={[styles.input, styles.inputWithIcon]}
            value={form.referral_agent_name}
            onChangeText={v => set('referral_agent_name', v)}
            placeholder="Sales agent name (if referred)"
            keyboardType="default"
            autoCapitalize="words"
            placeholderTextColor="#aaa"
          />
        </View>
        <Text style={styles.fieldHint}>Leave blank if you're registering on your own</Text>
        {err('referral_agent_name')}

        {/* Password + Confirm */}
        <View style={styles.row2}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Password *</Text>
            <TextInput style={styles.input} value={form.password} onChangeText={v => set('password', v)}
              placeholder="Min 8 chars" secureTextEntry autoCapitalize="none" placeholderTextColor="#aaa" />
            {err('password')}
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Confirm *</Text>
            <TextInput style={styles.input} value={form.password_confirmation} onChangeText={v => set('password_confirmation', v)}
              placeholder="Repeat password" secureTextEntry autoCapitalize="none" placeholderTextColor="#aaa" />
          </View>
        </View>

        {/* Gender */}
        <Text style={styles.label}>Gender</Text>
        <View style={styles.row}>
          {['male','female'].map(g => (
            <TouchableOpacity key={g} style={[styles.pill, form.gender === g && styles.pillActive]} onPress={() => set('gender', g)}>
              <Text style={[styles.pillText, form.gender === g && styles.pillTextActive]}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Country */}
        <Text style={styles.label}>Country</Text>
        <View style={styles.row}>
          {COUNTRIES.map(c => (
            <TouchableOpacity key={c} style={[styles.pill, form.country === c && styles.pillActive]} onPress={() => set('country', c)}>
              <Text style={[styles.pillText, form.country === c && styles.pillTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Already have an account? <Text style={styles.linkAccent}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container    : { flex: 1, backgroundColor: '#fff' },
  inner        : { padding: 24, paddingTop: 50, paddingBottom: 40 },
  title        : { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  sub          : { color: '#888', marginTop: 4, marginBottom: 20, fontSize: 15 },
  tabs         : { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#FFA100', marginBottom: 16 },
  tab          : { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive    : { backgroundColor: '#FFA100' },
  tabText      : { fontWeight: '600', color: '#FFA100' },
  tabTextActive: { color: '#fff' },
  label        : { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginTop: 12, marginBottom: 4 },
  input        : { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#f5f5f5', color: '#1a1a1a' },
  error        : { color: '#ef4444', fontSize: 12, marginTop: 2 },
  row          : { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill         : { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  pillActive   : { backgroundColor: '#FFA100', borderColor: '#FFA100' },
  pillText     : { color: '#555', fontSize: 13 },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  btn          : { backgroundColor: '#FFA100', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  btnText      : { color: '#fff', fontSize: 16, fontWeight: '700' },
    link          : { textAlign: 'center', color: '#888', marginTop: 20, fontSize: 14 },
  linkAccent    : { color: '#FFA100', fontWeight: '600' },
  // Two-column row
  row2          : { flexDirection: 'row', gap: 10, marginBottom: 0 },
  halfField     : { flex: 1 },
  // Icon input wrapper
  iconInputWrap : { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, backgroundColor: '#f5f5f5', marginBottom: 2 },
  inputIcon     : { marginLeft: 12, marginRight: 4 },
  inputWithIcon : { flex: 1, borderWidth: 0, backgroundColor: 'transparent', borderRadius: 10 },
  // Optional label hint + field hint
  labelOptional : { fontWeight: '400', color: '#aaa', fontSize: 12 },
  fieldHint     : { fontSize: 11, color: '#9ca3af', marginTop: 3, marginBottom: 8 },
});

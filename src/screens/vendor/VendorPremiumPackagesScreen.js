import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import client from '../../api/client';
import { COLORS, SIZES } from '../../constants/theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const PLAN_COLORS = {
  monthly:   '#3b82f6',
  quarterly: '#8b5cf6',
  semiannual:'#0f766e',
  annual:    '#92400e',
};

const FEATURES = [
  { icon: 'infinity', text: 'Unlimited product uploads' },
  { icon: 'image-multiple', text: 'Up to 15 images per product' },
  { icon: 'megaphone-outline', text: 'Unlimited promo banners across all categories' },
  { icon: 'medal', text: 'First priority in product listings' },
  { icon: 'fire', text: 'Products featured in Trends area' },
  { icon: 'chart-box-outline', text: 'Premium analytics dashboard' },
  { icon: 'cart-outline', text: 'Abandoned cart notifications' },
  { icon: 'headset', text: 'Dedicated admin support' },
];

const BANK_DETAILS = [
  { label: 'Bank',       value: 'Stanbic Bank Uganda' },
  { label: 'Account',    value: 'DropStore Ltd' },
  { label: 'Acc. No.',   value: '9030023478911' },
  { label: 'Branch',     value: 'Kampala Main Branch' },
  { label: 'Reference',  value: 'PREMIUM-[Your Name]' },
];

export default function VendorPremiumPackagesScreen({ navigation }) {
  const [plans, setPlans]         = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('annual');
  const [form, setForm] = useState({ plan: 'annual', payment_reference: '', bank_name: '', depositor_name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm]   = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        client.get('/premium/plans'),
        client.get('/premium'),
      ]);
      setPlans(plansRes.data);
      setCurrentSub(subRes.data);
      if (subRes.data?.plan) {
        setSelectedPlan(subRes.data.plan);
        setForm(f => ({ ...f, plan: subRes.data.plan }));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const selectPlan = (plan) => {
    setSelectedPlan(plan);
    setForm(f => ({ ...f, plan }));
  };

  const submit = async () => {
    if (!form.plan) { Alert.alert('Required', 'Select a plan.'); return; }
    if (!form.payment_reference.trim()) { Alert.alert('Required', 'Enter the payment reference.'); return; }
    if (!form.bank_name.trim()) { Alert.alert('Required', 'Enter the bank name.'); return; }
    if (!form.depositor_name.trim()) { Alert.alert('Required', 'Enter the depositor name.'); return; }
    setSubmitting(true);
    try {
      const res = await client.post('/premium/apply', form);
      Alert.alert('Submitted!', res.data.message || 'Application received. Admin will review within 24 hours.', [
        { text: 'OK', onPress: () => { loadData(); setShowForm(false); } },
      ]);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Submission failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  const formatUGX = (n) => `UGX ${Number(n).toLocaleString('en-UG')}`;

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;

  const hasPremium = currentSub?.has_premium;
  const isPending  = currentSub?.status === 'pending';
  const isRejected = currentSub?.status === 'rejected';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView style={{ flex: 1, backgroundColor: '#fafafa' }}>
        {hasPremium && (
          <View style={{ backgroundColor: '#dcfce7', padding: 12, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#166534" />
              <Text style={{ color: '#166534', fontSize: 14, fontWeight: '600', flex: 1 }}>
                You are an active premium subscriber. Renew below or manage your subscription.
              </Text>
            </View>
          </View>
        )}

        {isPending && (
          <View style={{ backgroundColor: '#fef08a', padding: 12, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#713f12" />
              <Text style={{ color: '#713f12', fontSize: 14, fontWeight: '600', flex: 1 }}>
                Your application is pending admin review (within 24 hours).
              </Text>
            </View>
          </View>
        )}

        {isRejected && (
          <View style={{ backgroundColor: '#fee2e2', padding: 12, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#7f1d1d" />
              <Text style={{ color: '#7f1d1d', fontSize: 14, fontWeight: '600', flex: 1 }}>
                Your application was rejected. Please contact support or reapply.
              </Text>
            </View>
          </View>
        )}

        {/* Hero section */}
        <View style={{ backgroundColor: COLORS.primary, padding: 20, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
            <MaterialCommunityIcons name="diamond" size={28} color="#fbbf24" />
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff' }}>Unlock Premium</Text>
          </View>
          <Text style={{ fontSize: 14, color: '#e0e0e0', textAlign: 'center' }}>
            Boost your sales with premium features, priority support & analytics.
          </Text>
          
          {/* Hero chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {[
              { icon: 'infinity', label: 'Unlimited' },
              { icon: 'medal', label: 'Priority' },
              { icon: 'fire', label: 'Trends' },
              { icon: 'chart-box-outline', label: 'Analytics' },
            ].map(c => (
              <View key={c.label} style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name={c.icon} size={14} color="#fff" />
                <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ padding: 16 }}>
          {/* Plan cards */}
          {plans.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.planCard,
                selectedPlan === p.plan && { borderColor: PLAN_COLORS[p.plan], borderWidth: 2, backgroundColor: '#f9fafb' },
              ]}
              onPress={() => selectPlan(p.plan)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' }}>{p.label}</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{p.period}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: PLAN_COLORS[p.plan] }}>{formatUGX(p.price)}</Text>
                  <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>per {p.period.toLowerCase()}</Text>
                </View>
              </View>
              {selectedPlan === p.plan && (
                <View style={{ backgroundColor: PLAN_COLORS[p.plan], paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>Selected</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* Features */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 12, color: '#1a1a1a' }}>All Plans Include:</Text>
          {FEATURES.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 }}>
              <MaterialCommunityIcons name={f.icon} size={20} color={COLORS.primary} />
              <Text style={{ fontSize: 14, color: '#333', flex: 1 }}>{f.text}</Text>
            </View>
          ))}

          {/* Bank details */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 12, color: '#1a1a1a' }}>Payment Instructions:</Text>
          <View style={{ backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            {BANK_DETAILS.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < BANK_DETAILS.length - 1 ? 1 : 0, borderBottomColor: '#e5e7eb' }}>
                <Text style={{ fontSize: 13, color: '#666', fontWeight: '500' }}>{d.label}</Text>
                <Text style={{ fontSize: 13, color: '#1a1a1a', fontWeight: '600' }}>{d.value}</Text>
              </View>
            ))}
          </View>

          {/* Action button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={() => setShowForm(true)}
            disabled={submitting}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
              {submitting ? 'Submitting...' : 'Continue with Bank Transfer'}
            </Text>
          </TouchableOpacity>

          {/* Application form modal */}
          <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
            <View style={{ flex: 1, backgroundColor: '#fafafa', paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Apply for Premium</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                  Fill in your bank transfer details. Admin will verify and activate within 24 hours.
                </Text>

                <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#1a1a1a' }}>Selected Plan</Text>
                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: PLAN_COLORS[form.plan] }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: PLAN_COLORS[form.plan] }}>
                    {plans.find(p => p.plan === form.plan)?.label || '—'}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    {formatUGX(plans.find(p => p.plan === form.plan)?.price || 0)}
                  </Text>
                </View>

                <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#1a1a1a' }}>Payment Reference</Text>
                <TextInput
                  placeholder="e.g., PREMIUM-12345-JOHN"
                  value={form.payment_reference}
                  onChangeText={v => setForm(f => ({ ...f, payment_reference: v }))}
                  style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, borderWidth: 1, borderColor: '#e5e7eb' }}
                />

                <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#1a1a1a' }}>Bank Name</Text>
                <TextInput
                  placeholder="e.g., Stanbic Bank Uganda"
                  value={form.bank_name}
                  onChangeText={v => setForm(f => ({ ...f, bank_name: v }))}
                  style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, borderWidth: 1, borderColor: '#e5e7eb' }}
                />

                <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#1a1a1a' }}>Depositor Name</Text>
                <TextInput
                  placeholder="Name of person depositing"
                  value={form.depositor_name}
                  onChangeText={v => setForm(f => ({ ...f, depositor_name: v }))}
                  style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 32, fontSize: 13, borderWidth: 1, borderColor: '#e5e7eb' }}
                />

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={submit}
                  disabled={submitting}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </Modal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 32,
  },
});

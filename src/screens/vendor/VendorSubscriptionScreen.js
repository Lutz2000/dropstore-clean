import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, FlatList, TextInput,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client from '../../api/client';
import { COLORS, SIZES } from '../../constants/theme';

const PAYMENT_METHODS = [
  { key: 'yo_uganda',    label: 'Yo! Uganda (Mobile Money)' },
  { key: 'mastercard',   label: 'Mastercard' },
  { key: 'visa',         label: 'Visa' },
  { key: 'bank_account', label: 'Bank Account' },
  { key: 'cash',         label: 'Cash' },
];

const PLAN_COLORS = {
  weekly:    '#3b82f6',
  monthly:   COLORS.primary,
  quarterly: '#8b5cf6',
};

export default function VendorSubscriptionScreen({ navigation }) {
  const [plans, setPlans]               = useState([]);
  const [current, setCurrent]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [subscribing, setSubscribing]   = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [phone, setPhone]               = useState('');
  const [showPayModal, setShowPayModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        client.get('/subscription/plans'),
        client.get('/subscription'),
      ]);
      // exclude free tier from purchasable list
      setPlans(plansRes.data.filter(p => p.plan !== 'free'));
      setCurrent(subRes.data);
    } catch (e) {
      Alert.alert('Error', 'Could not load subscription data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan) => {
    // status === 'none' means never subscribed → must go through the full apply form first
    // status === 'expired' means subscription lapsed → show plan + payment to renew
    if (current?.status === 'none') {
      navigation.navigate('VendorApply');
      return;
    }
    setSelectedPlan(plan);
    setPaymentMethod(null);
    setPhone('');
    setShowPayModal(true);
  };

  const handleSubscribe = async () => {
    if (!paymentMethod) {
      Alert.alert('Required', 'Please select a payment method.');
      return;
    }
    setSubscribing(true);
    setShowPayModal(false);
    try {
      const payload = {
        plan: selectedPlan.plan,
        payment_method: paymentMethod,
      };
      if (paymentMethod === 'yo_uganda' && phone.trim()) {
        payload.phone = '+256' + phone.trim();
      }
      const res = await client.post('/subscription', payload);
      Alert.alert(
        'Subscribed!',
        `Your ${selectedPlan.label} plan is now active for ${selectedPlan.duration_days} days.`,
        [{ text: 'OK', onPress: () => { loadData(); navigation.goBack(); } }],
      );
    } catch (e) {
      const msg = e?.response?.data?.message || 'Subscription failed. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubscribing(false);
    }
  };

  if (loading || subscribing) {
    return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;
  }

  const isCurrentPlan = (plan) =>
    current?.has_subscription && current?.plan === plan.plan;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current subscription card */}
      <View style={styles.currentCard}>
        {current?.has_subscription ? (
          <>
            <View style={styles.currentRow}>
              <Text style={styles.currentLabel}>Current Plan</Text>
              <View style={[styles.badge, { backgroundColor: PLAN_COLORS[current.plan] || COLORS.primary }]}>
                <Text style={styles.badgeText}>{current.label?.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.currentRow}>
              <Text style={styles.currentSub}>
                ✅ Verified Badge  •  {current.images_per_product} images/product  •  {current.promo_banner_days}-day promo
              </Text>
            </View>
            <View style={[styles.expiryBar, { backgroundColor: '#f3f4f6' }]}>
              <Text style={styles.expiryText}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.primary} /><Text>{current.days_remaining} {current.days_remaining === 1 ? 'day' : 'days'} remaining</Text></View>
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.noSubTitle}>No Active Subscription</Text>
            <Text style={styles.noSubSub}>You are on the free plan. Upgrade to unlock more features.</Text>
          </>
        )}
      </View>

      {/* Plans */}
      <Text style={styles.sectionTitle}>Choose a Plan</Text>

      {plans.map((plan) => {
        const color   = PLAN_COLORS[plan.plan] || COLORS.primary;
        const active  = isCurrentPlan(plan);
        return (
          <View key={plan.plan} style={[styles.planCard, active && { borderColor: color, borderWidth: 2 }]}>
            {active && (
              <View style={[styles.activePill, { backgroundColor: color }]}>
                <Text style={styles.activePillText}>ACTIVE</Text>
              </View>
            )}
            <View style={styles.planHeader}>
              <Text style={[styles.planName, { color }]}>{plan.label}</Text>
              <Text style={styles.planPrice}>
                UGX {plan.price.toLocaleString()}
                <Text style={styles.planDuration}> / {plan.duration_days} days</Text>
              </Text>
            </View>

            <View style={styles.featureList}>
              {plan.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <MaterialCommunityIcons name="check" size={16} color={color} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.subscribeBtn, { backgroundColor: color }, active && styles.subscribedBtn]}
              onPress={() => !active && handleSelectPlan(plan)}
              disabled={active}
            >
              <Text style={styles.subscribeBtnText}>
                {active ? 'Current Plan' : `Subscribe — UGX ${plan.price.toLocaleString()}`}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Free tier info */}
      <View style={styles.freeCard}>
        <Text style={styles.freeTitle}>Free (No Subscription)</Text>
        <Text style={styles.freeSub}>• 1 product upload max</Text>
        <Text style={styles.freeSub}>• 1 product image</Text>
        <Text style={styles.freeSub}>• No verified badge</Text>
        <Text style={styles.freeSub}>• No promo banners</Text>
      </View>

      {/* Payment Method Modal */}
      <Modal
        visible={showPayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Payment Method</Text>
            <Text style={styles.modalSub}>
              {selectedPlan?.label} — UGX {selectedPlan?.price?.toLocaleString()}
            </Text>

            <FlatList
              data={PAYMENT_METHODS}
              keyExtractor={item => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.payOption,
                    paymentMethod === item.key && styles.payOptionActive,
                  ]}
                  onPress={() => setPaymentMethod(item.key)}
                >
                  <View style={[
                    styles.radioOuter,
                    paymentMethod === item.key && { borderColor: COLORS.primary },
                  ]}>
                    {paymentMethod === item.key && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.payOptionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />

            {/* Yo Uganda phone field */}
            {paymentMethod === 'yo_uganda' && (
              <View style={styles.phoneField}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <MaterialCommunityIcons name="mobile" size={16} color={COLORS.primary} />
                  <Text style={styles.phoneLabel}>Mobile Money Number</Text>
                </View>
                <View style={styles.phoneRow}>
                  <View style={styles.phonePrefix}><Text style={styles.phonePrefixText}>+256</Text></View>
                  <TextInput
                    style={styles.phoneInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="7XXXXXXXX"
                    placeholderTextColor="#aaa"
                    keyboardType="phone-pad"
                    maxLength={9}
                  />
                </View>
                <Text style={styles.phoneHint}>Enter the number to receive the USSD payment prompt.</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPayModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!paymentMethod || (paymentMethod === 'yo_uganda' && !phone.trim())) && { opacity: 0.5 }]}
                onPress={handleSubscribe}
                disabled={!paymentMethod || (paymentMethod === 'yo_uganda' && !phone.trim())}
              >
                <Text style={styles.confirmBtnText}>Confirm & Subscribe</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container    : { flex: 1, backgroundColor: '#f9f9f9' },
  content      : { padding: 16, paddingBottom: 40 },

  currentCard  : { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20, elevation: 2 },
  currentRow   : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  currentLabel : { fontSize: 13, color: '#888', fontWeight: '600' },
  badge        : { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText    : { color: '#fff', fontSize: 11, fontWeight: '800' },
  currentSub   : { fontSize: 13, color: '#555', flex: 1 },
  expiryBar    : { borderRadius: 8, padding: 10, marginTop: 8 },
  expiryText   : { fontSize: 13, color: '#555', fontWeight: '600' },
  noSubTitle   : { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  noSubSub     : { fontSize: 13, color: '#888' },

  sectionTitle : { fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },

  planCard     : { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
  activePill   : { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  activePillText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  planHeader   : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planName     : { fontSize: 19, fontWeight: '800' },
  planPrice    : { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  planDuration : { fontSize: 13, color: '#888', fontWeight: '400' },

  featureList  : { marginBottom: 16, gap: 6 },
  featureRow   : { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureIcon  : { fontSize: 15, fontWeight: '700', marginTop: 1 },
  featureText  : { fontSize: 14, color: '#333', flex: 1 },

  subscribeBtn    : { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  subscribedBtn   : { opacity: 0.5 },
  subscribeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  freeCard     : { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 14, marginTop: 4 },
  freeTitle    : { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 6 },
  freeSub      : { fontSize: 13, color: '#888', marginBottom: 3 },

  modalOverlay : { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox     : { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '75%' },
  modalTitle   : { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  modalSub     : { fontSize: 14, color: '#888', marginBottom: 16 },

  payOption       : { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f3f4f6', gap: 12 },
  payOptionActive : { backgroundColor: '#fff8f0' },
  radioOuter      : { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  radioInner      : { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  payOptionText   : { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },

  modalActions : { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn    : { flex: 1, borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelBtnText: { color: '#888', fontWeight: '600', fontSize: 14 },
  confirmBtn   : { flex: 2, borderRadius: 10, paddingVertical: 12, backgroundColor: COLORS.primary, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Phone field
  phoneField   : { marginTop: 14 },
  phoneLabel   : { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  phoneRow     : { flexDirection: 'row', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, overflow: 'hidden', backgroundColor: '#f8fafc' },
  phonePrefix  : { paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#f1f5f9', borderRightWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center' },
  phonePrefixText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  phoneInput   : { flex: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#1a1a1a' },
  phoneHint    : { fontSize: 11, color: '#94a3b8', marginTop: 5 },
});

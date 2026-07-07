﻿import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../../api/client';
import { COLORS } from '../../constants/theme';

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SUBSCRIPTION_PLANS = [
  {
    key: 'weekly', label: 'Weekly', price: 11000, days: 7,
    features: ['3 images/product', 'Verified badge (upon admin approval)', '7-day promo banners'],
  },
  {
    key: 'monthly', label: 'Monthly', price: 20000, days: 30,
    features: ['5 images/product', 'Verified badge (upon admin approval)', '30-day promo banners'],
  },
  {
    key: 'quarterly', label: 'Quarterly', price: 50000, days: 90,
    features: ['7 images/product', 'Verified badge (upon admin approval)', '90-day promo banners'],
  },
];

const ALL_PAYMENT_METHODS = [
  { key: 'yo_uganda',    label: 'Yo! Uganda', icon: 'mobile', desc: 'Mobile Money push payment' },
  { key: 'mastercard',   label: 'Mastercard',  icon: 'credit-card', desc: 'Debit / Credit card' },
  { key: 'visa',         label: 'Visa',        icon: 'credit-card', desc: 'Debit / Credit card' },
  { key: 'bank_account', label: 'Bank Account',icon: 'bank', desc: 'Direct bank transfer' },
  { key: 'cash',         label: 'Cash',        icon: 'cash', desc: 'Pay in person' },
];

const PLAN_COLORS = { weekly: '#3b82f6', monthly: COLORS.primary, quarterly: '#8b5cf6' };

// Pending Yo Uganda payment — persisted for 12 hours so a vendor who dismisses
// the modal without tapping "Submit Application" can reopen it without being charged again.
const PENDING_PAYMENT_KEY = 'dropstore_yo_pending';
const PENDING_TTL         = 12 * 60 * 60 * 1000; // 12 hours in ms

function normalizePhone(phone) {
  let p = (phone || '').replace(/[^0-9]/g, '');
  if (p.length === 10 && p.startsWith('0')) return '256' + p.slice(1);
  if (!p.startsWith('256'))                return '256' + p;
  return p;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function FieldLabel({ children, required }) {
  return (
    <Text style={styles.label}>
      {children}{required && <Text style={{ color: '#ef4444' }}> *</Text>}
    </Text>
  );
}

function TextBox({ value, onChange, placeholder, keyboardType = 'default', multiline = false }) {
  return (
    <TextInput
      style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      keyboardType={keyboardType}
      multiline={multiline}
      autoCapitalize="none"
      placeholderTextColor="#aaa"
    />
  );
}

// â”€â”€â”€ Image picker helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function pickImage(setter) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { Alert.alert('Permission required', 'Allow access to photos.'); return; }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaType.images,
    quality: 0.8,
  });
  if (!result.canceled && result.assets?.length) {
    setter(result.assets[0]);
  }
}

function ImageUploadBox({ label, asset, onPick, required }) {
  return (
    <View style={styles.uploadBox}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <TouchableOpacity style={styles.uploadBtn} onPress={onPick}>
        {asset
          ? <Image source={{ uri: asset.uri }} style={styles.uploadPreview} resizeMode="cover" />
          : <Text style={styles.uploadBtnText}>ðŸ“Ž Tap to upload</Text>
        }
      </TouchableOpacity>
    </View>
  );
}
// ── Payment Flow Modal ─────────────────────────────────────────────────────────
function PaymentFlowModal({ visible, method, plan, phoneNumber, bankDetails, onConfirm, onCancel }) {
  const [yoLoading, setYoLoading]       = useState(false);
  const [yoSent, setYoSent]             = useState(false);
  const [yoPhone, setYoPhone]           = useState('');
  const [yoError, setYoError]           = useState(null);
  const [localPhone, setLocalPhone]     = useState(''); // for commercial vendors
  const [cardHolder, setCardHolder]     = useState('');
  const [cardNumber, setCardNumber]     = useState('');
  const [cardExpiry, setCardExpiry]     = useState('');
  const autoFiredRef = useRef(false);

  // Reset state + check for a still-valid pending Yo payment (12-hour window).
  // If the vendor already paid but dismissed the modal before tapping "Submit Application",
  // reopening the modal with the same phone/plan shows the submit screen directly —
  // no second USSD push is sent.
  useEffect(() => {
    if (!visible) return;

    setYoLoading(false);
    setYoPhone('');
    setYoError(null);
    setLocalPhone('');
    autoFiredRef.current = false;
    setYoSent(false);

    if (method?.key !== 'yo_uganda') return;

    // Helper: fire a fresh USSD push (individual vendors whose phone is already known)
    const fireNewPayment = () => {
      if (phoneNumber?.trim() && !autoFiredRef.current) {
        autoFiredRef.current = true;
        const phone = phoneNumber.trim();
        setYoLoading(true);
        setYoError(null);
        client.post('/vendor/initiate-payment', {
          amount: plan?.price ?? 0,
          narration: `DropStore ${plan?.label} subscription`,
          phone,
        })
          .then(res => {
            const p = res.data?.phone ?? phone;
            setYoPhone(p);
            setYoSent(true);
            AsyncStorage.setItem(
              PENDING_PAYMENT_KEY,
              JSON.stringify({ phone: p, plan: plan?.key, ts: Date.now() }),
            ).catch(() => {});
          })
          .catch(e => {
            const msg = e?.response?.data?.error || 'Could not send payment request. Please try again.';
            setYoError(msg);
          })
          .finally(() => setYoLoading(false));
      }
    };

    AsyncStorage.getItem(PENDING_PAYMENT_KEY)
      .then(stored => {
        if (stored) {
          try {
            const pending     = JSON.parse(stored);
            const knownPhone  = phoneNumber?.trim();
            // For individual vendors the phone is known; match it.
            // For commercial vendors (no phone yet) accept any pending entry for this plan.
            const phonesMatch = !knownPhone || normalizePhone(knownPhone) === normalizePhone(pending.phone);
            const plansMatch  = pending.plan === plan?.key;
            const stillValid  = Date.now() - pending.ts < PENDING_TTL;
            if (phonesMatch && plansMatch && stillValid) {
              setYoPhone(pending.phone);
              setYoSent(true);
              autoFiredRef.current = true; // prevent auto-fire below
              return;
            }
          } catch (_) { /* corrupt entry — ignore */ }
        }
        fireNewPayment();
      })
      .catch(fireNewPayment); // AsyncStorage unavailable — fall back to normal flow
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, method?.key]);

  const handleYoPay = async (overridePhone) => {
    const usePhone = overridePhone || localPhone.trim();
    setYoLoading(true);
    setYoError(null);
    try {
      // For commercial vendors typing a phone in the modal: check pending first
      // so they aren't charged twice if they previously paid with the same number.
      const stored = await AsyncStorage.getItem(PENDING_PAYMENT_KEY).catch(() => null);
      if (stored) {
        try {
          const pending    = JSON.parse(stored);
          const phonesMatch = normalizePhone(usePhone) === normalizePhone(pending.phone);
          const plansMatch  = pending.plan === plan?.key;
          const stillValid  = Date.now() - pending.ts < PENDING_TTL;
          if (phonesMatch && plansMatch && stillValid) {
            setYoPhone(pending.phone);
            setYoSent(true);
            return; // show submit screen — no new charge
          }
        } catch (_) {}
      }

      const payload = {
        amount: plan?.price ?? 0,
        narration: `DropStore ${plan?.label} subscription`,
      };
      if (usePhone) payload.phone = usePhone;
      const res = await client.post('/vendor/initiate-payment', payload);
      const p = res.data?.phone ?? usePhone ?? '';
      setYoPhone(p);
      setYoSent(true);
      AsyncStorage.setItem(
        PENDING_PAYMENT_KEY,
        JSON.stringify({ phone: p, plan: plan?.key, ts: Date.now() }),
      ).catch(() => {});
    } catch (e) {
      const msg = e?.response?.data?.error || 'Could not send payment request. Please try again.';
      setYoError(msg);
    } finally {
      setYoLoading(false);
    }
  };

  const handleCardConfirm = () => {
    if (!cardHolder.trim()) { Alert.alert('Required', 'Enter card holder name.'); return; }
    const digits = cardNumber.replace(/\s/g, '');
    if (digits.length < 16) { Alert.alert('Required', 'Enter your full 16-digit card number.'); return; }
    if (!cardExpiry.trim()) { Alert.alert('Required', 'Enter card expiry date.'); return; }
    onConfirm({ cardHolder, cardNumber: digits, cardExpiry });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          <View style={pm.handle} />

          {/* ── Yo Uganda ── */}
          {method?.key === 'yo_uganda' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <MaterialCommunityIcons name="mobile" size={20} color={COLORS.primary} />
                <Text style={pm.title}>Yo! Uganda Payment</Text>
              </View>
              <Text style={pm.sub}>
                A mobile money request will be sent to your phone number. Enter your PIN when the prompt appears.
              </Text>
              <View style={pm.planBadge}>
                <Text style={pm.planBadgeText}>{plan?.label} — UGX {plan?.price?.toLocaleString()}</Text>
              </View>

              {!yoSent ? (
                <>
                  {phoneNumber?.trim() ? (
                    /* Individual vendor — phone known, auto-initiating */
                    <>
                      <View style={pm.phoneReadonlyBox}>
                        <Text style={pm.fieldLabel}>Sending request to</Text>
                        <Text style={pm.phoneReadonlyValue}>{yoPhone || phoneNumber}</Text>
                      </View>
                      {yoLoading && (
                        <View style={pm.loadingBox}>
                          <ActivityIndicator color={COLORS.primary} size="large" />
                          <Text style={pm.loadingText}>Sending payment request…</Text>
                        </View>
                      )}
                      {yoError && !yoLoading && (
                        <>
                          <View style={pm.errorBox}>
                            <Text style={pm.errorText}>⚠️ {yoError}</Text>
                          </View>
                          <TouchableOpacity style={pm.primaryBtn} onPress={() => handleYoPay(phoneNumber.trim())} disabled={yoLoading}>
                            <Text style={pm.primaryBtnText}>Retry</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </>
                  ) : (
                    /* Commercial vendor — collect phone first */
                    <>
                      <View style={pm.fieldNoteBox}>
                        <Text style={pm.fieldNoteText}>
                          Enter the mobile money number to receive the payment request.
                        </Text>
                      </View>
                      <Text style={pm.fieldLabel}>Mobile Money Phone Number *</Text>
                      <TextInput
                        style={pm.input}
                        value={localPhone}
                        onChangeText={setLocalPhone}
                        placeholder="+256 700 000 000"
                        keyboardType="phone-pad"
                        placeholderTextColor="#aaa"
                      />
                      {yoError && (
                        <View style={pm.errorBox}>
                          <Text style={pm.errorText}>⚠️ {yoError}</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={[pm.primaryBtn, (yoLoading || !localPhone.trim()) && { opacity: 0.5 }]}
                        onPress={() => handleYoPay(localPhone.trim())}
                        disabled={yoLoading || !localPhone.trim()}
                      >
                        {yoLoading
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={pm.primaryBtnText}>Send Payment Request</Text>
                        }
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : (
                /* Success state */
                <>
                  <View style={pm.successBox}>
                    <Text style={pm.successIcon}>✅</Text>
                    <Text style={pm.successTitle}>Payment Request Sent!</Text>
                    <Text style={pm.successSub}>
                      A mobile money prompt has been sent to{' '}
                      <Text style={{ fontWeight: '700' }}>{yoPhone || phoneNumber || localPhone}</Text>.{'\n'}
                      Enter your PIN on your phone to approve{' '}
                      <Text style={{ fontWeight: '700' }}>UGX {plan?.price?.toLocaleString()}</Text>.
                    </Text>
                  </View>
                  <TouchableOpacity style={pm.primaryBtn} onPress={() => onConfirm({})}>
                    <Text style={pm.primaryBtnText}>I've entered my PIN — Submit Application</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[pm.cancelBtn, { marginTop: 8 }]}
                    onPress={async () => {
                      await AsyncStorage.removeItem(PENDING_PAYMENT_KEY).catch(() => {});
                      setYoSent(false);
                      handleYoPay(phoneNumber?.trim() || localPhone.trim());
                    }}
                  >
                    <Text style={pm.cancelBtnText}>Didn't receive the prompt? Resend</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {/* ── Bank Account ── */}
          {method?.key === 'bank_account' && (
            <>
              <Text style={pm.title}>🏦 Bank Transfer</Text>
              <Text style={pm.sub}>Transfer the subscription amount to the account below, then submit.</Text>
              <View style={pm.planBadge}>
                <Text style={pm.planBadgeText}>{plan?.label} — UGX {plan?.price?.toLocaleString()}</Text>
              </View>
              <View style={pm.bankBox}>
                {[
                  ['Account Number', bankDetails?.bank_account_number],
                  ['Bank Name', bankDetails?.bank_name],
                  ['Account Holder', bankDetails?.bank_account_holder],
                  ['Branch', bankDetails?.bank_branch],
                ].map(([lbl, val]) => val ? (
                  <View key={lbl} style={pm.bankRow}>
                    <Text style={pm.bankLabel}>{lbl}</Text>
                    <TouchableOpacity onPress={() => { Clipboard.setStringAsync(val); Alert.alert('Copied', `${lbl} copied.`); }}>
                      <Text style={pm.bankValue}>{val} <Text style={pm.copyHint}>(tap to copy)</Text></Text>
                    </TouchableOpacity>
                  </View>
                ) : null)}
              </View>
              <TouchableOpacity style={pm.primaryBtn} onPress={() => onConfirm({})}>
                <Text style={pm.primaryBtnText}>I have transferred — Submit Application</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Mastercard / Visa ── */}
          {(method?.key === 'mastercard' || method?.key === 'visa') && (
            <>
              <Text style={pm.title}>{method.key === 'visa' ? '💳 Visa' : '💳 Mastercard'} Payment</Text>
              <Text style={pm.sub}>Provide your card details. The subscription fee will be charged by the admin.</Text>
              <View style={pm.planBadge}>
                <Text style={pm.planBadgeText}>{plan?.label} — UGX {plan?.price?.toLocaleString()}</Text>
              </View>
              <Text style={pm.fieldLabel}>Card Holder Name</Text>
              <TextInput style={pm.input} value={cardHolder} onChangeText={setCardHolder} placeholder="Name on card" placeholderTextColor="#aaa" autoCapitalize="words" />
              <Text style={pm.fieldLabel}>Card Number</Text>
              <TextInput
                style={pm.input}
                value={cardNumber}
                onChangeText={t => setCardNumber(t.replace(/[^0-9 ]/g, ''))}
                placeholder="1234 5678 9012 3456"
                keyboardType="number-pad"
                maxLength={19}
                placeholderTextColor="#aaa"
              />
              <Text style={pm.fieldLabel}>Expiry Date</Text>
              <TextInput
                style={[pm.input, { width: 120 }]}
                value={cardExpiry}
                onChangeText={t => {
                  const clean = t.replace(/[^0-9]/g, '');
                  setCardExpiry(clean.length > 2 ? clean.slice(0,2) + '/' + clean.slice(2,4) : clean);
                }}
                placeholder="MM/YY"
                keyboardType="number-pad"
                maxLength={5}
                placeholderTextColor="#aaa"
              />
              <TouchableOpacity style={pm.primaryBtn} onPress={handleCardConfirm}>
                <Text style={pm.primaryBtnText}>Submit Application</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Cash ── */}
          {method?.key === 'cash' && (
            <>
              <Text style={pm.title}>💵 Cash Payment</Text>
              <Text style={pm.sub}>You have selected to pay in cash. Your application will be submitted and the admin will contact you to arrange payment.</Text>
              <View style={pm.planBadge}>
                <Text style={pm.planBadgeText}>{plan?.label} — UGX {plan?.price?.toLocaleString()}</Text>
              </View>
              <TouchableOpacity style={pm.primaryBtn} onPress={() => onConfirm({})}>
                <Text style={pm.primaryBtnText}>Submit Application</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={pm.cancelBtn} onPress={onCancel}>
            <Text style={pm.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function VendorApplyScreen({ navigation }) {
  const [step, setStep]               = useState(0); // 0=type, 1=details, 2=subscription, 3=payment
  const [vendorType, setVendorType]   = useState(null); // 'commercial' | 'individual'

  // Shared
  const [idFront, setIdFront]         = useState(null);
  const [idBack, setIdBack]           = useState(null);
  const [categories, setCategories]   = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedPlan, setSelectedPlan]   = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [fetchingCats, setFetchingCats] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState(ALL_PAYMENT_METHODS);
  const [bankDetails, setBankDetails]   = useState({});
  const [showPayModal, setShowPayModal] = useState(false);

  // Commercial fields
  const [businessName, setBusinessName]   = useState('');
  const [businessLocation, setBusinessLocation] = useState('');
  const [businessLogo, setBusinessLogo]         = useState(null);
  const [regCert, setRegCert]                   = useState(null);
  const [bizLicence, setBizLicence]             = useState(null);

  // Individual fields
  const [phoneNumber, setPhoneNumber]     = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [receipt, setReceipt]             = useState(null);

  // Load active payment methods on mount
  useEffect(() => {
    client.get('/settings').then(r => {
      const active = r.data?.settings?.active_payment_methods;
      if (Array.isArray(active) && active.length > 0) {
        setPaymentMethods(ALL_PAYMENT_METHODS.filter(m => active.includes(m.key)));
      }
      // Store bank details for bank transfer flow
      const s = r.data?.settings ?? {};
      setBankDetails({
        bank_account_number: s.bank_account_number,
        bank_name: s.bank_name,
        bank_account_holder: s.bank_account_holder,
        bank_branch: s.bank_branch,
      });
    }).catch(() => {});
  }, []);

  // Load categories when entering details step
  useEffect(() => {
    if (step === 1 && allCategories.length === 0) {
      setFetchingCats(true);
      client.get('/categories')
        .then(r => setAllCategories(r.data.data || r.data))
        .catch(() => {})
        .finally(() => setFetchingCats(false));
    }
  }, [step]);

  const toggleCategory = (id) => {
    setCategories(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // â”€â”€ Validation per step â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const validateStep1 = () => {
    if (!idFront) { Alert.alert('Required', 'Please upload your ID (front).'); return false; }
    if (!idBack)  { Alert.alert('Required', 'Please upload your ID (back).'); return false; }
    if (categories.length === 0) { Alert.alert('Required', 'Select at least one category.'); return false; }

    if (vendorType === 'commercial') {
      if (!businessName.trim())     { Alert.alert('Required', 'Business name is required.'); return false; }
      if (!businessLocation.trim()) { Alert.alert('Required', 'Business location is required.'); return false; }
    } else {
      if (!phoneNumber.trim())      { Alert.alert('Required', 'Phone number is required.'); return false; }
      if (!physicalAddress.trim())  { Alert.alert('Required', 'Physical address is required.'); return false; }
      if (!receipt)                 { Alert.alert('Required', 'Please upload a personal receipt/invoice.'); return false; }
    }
    return true;
  };

  const validateStep2 = () => {
    if (!selectedPlan) { Alert.alert('Required', 'Please select a subscription plan.'); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (!paymentMethod) { Alert.alert('Required', 'Please select a payment method.'); return false; }
    return true;
  };

  const next = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  // â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const submit = async (extraPaymentFields = {}) => {
    setShowPayModal(false);
    setLoading(true);
    try {
      const form = new FormData();
      form.append('vendor_type', vendorType);
      form.append('subscription_plan', selectedPlan);
      form.append('payment_method', paymentMethod);
      form.append('selected_categories', JSON.stringify(categories));

      if (extraPaymentFields.cardHolder)   form.append('card_holder_name', extraPaymentFields.cardHolder);
      if (extraPaymentFields.cardNumber)    form.append('card_number',      extraPaymentFields.cardNumber);
      if (extraPaymentFields.cardExpiry)    form.append('card_expiry', extraPaymentFields.cardExpiry);

      const appendImage = (key, asset) => {
        if (!asset) return;
        const ext = asset.uri.split('.').pop();
        form.append(key, { uri: asset.uri, name: `${key}.${ext}`, type: `image/${ext}` });
      };

      appendImage('id_front', idFront);
      appendImage('id_back',  idBack);

      if (vendorType === 'commercial') {
        form.append('business_name', businessName);
        form.append('business_location', businessLocation);
        if (phoneNumber.trim()) form.append('phone_number', phoneNumber.trim());
        appendImage('business_logo', businessLogo);
        appendImage('business_registration_cert', regCert);
        appendImage('business_licence', bizLicence);
      } else {
        form.append('phone_number', phoneNumber);
        form.append('physical_address', physicalAddress);
        appendImage('personal_receipt', receipt);
      }

      await client.post('/vendor/apply', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Payment was used — clear the pending entry so no stale data remains
      AsyncStorage.removeItem(PENDING_PAYMENT_KEY).catch(() => {});

      Alert.alert(
        'ðŸŽ‰ Application Submitted',
        'Your application is under review. The admin team will verify your details within 24-48 hours.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // â”€â”€ Step 0: Vendor Type Selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderStep0 = () => (
    <View>
      <Text style={styles.title}>Join as a Vendor</Text>
      <Text style={styles.sub}>Select the type of vendor account you want to open.</Text>

      <TouchableOpacity
        style={[styles.typeCard, vendorType === 'commercial' && styles.typeCardActive]}
        onPress={() => setVendorType('commercial')}
      >
        <Text style={styles.typeIcon}>ðŸª</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.typeName}>Commercial Vendor</Text>
          <Text style={styles.typeDesc}>
            For registered businesses. Requires business name, location, registration certificate, and business licence.
          </Text>
        </View>
        {vendorType === 'commercial' && <Text style={styles.typeCheck}>âœ“</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.typeCard, vendorType === 'individual' && styles.typeCardActive]}
        onPress={() => setVendorType('individual')}
      >
        <Text style={styles.typeIcon}>ðŸ‘¤</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.typeName}>Individual Vendor</Text>
          <Text style={styles.typeDesc}>
            For individuals selling personal items. Requires your ID, phone number, address, and a receipt/invoice.
          </Text>
        </View>
        {vendorType === 'individual' && <Text style={styles.typeCheck}>âœ“</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navBtn, !vendorType && { opacity: 0.4 }]}
        onPress={() => vendorType && setStep(1)}
        disabled={!vendorType}
      >
        <Text style={styles.navBtnText}>Continue â†’</Text>
      </TouchableOpacity>
    </View>
  );

  // â”€â”€ Step 1: Details form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderStep1 = () => (
    <View>
      <Text style={styles.title}>{vendorType === 'commercial' ? 'ðŸª Business Details' : 'ðŸ‘¤ Personal Details'}</Text>
      <Text style={styles.sub}>Fill in the required information for your vendor account.</Text>

      {vendorType === 'commercial' ? (
        <>
          <SectionTitle>Business Information</SectionTitle>
          <FieldLabel required>Business Name</FieldLabel>
          <TextBox value={businessName} onChange={setBusinessName} placeholder="e.g. ABC Electronics Ltd" />
          <FieldLabel required>Business Location</FieldLabel>
          <TextBox value={businessLocation} onChange={setBusinessLocation} placeholder="e.g. Kampala, Nakasero Road" />
          <FieldLabel>Business Phone Number</FieldLabel>
          <TextBox value={phoneNumber} onChange={setPhoneNumber} placeholder="+256 700 000 000" keyboardType="phone-pad" />
          <Text style={styles.catHint}>Required if you intend to pay via Yo! Uganda mobile money</Text>
          <ImageUploadBox label="Business Logo" asset={businessLogo} onPick={() => pickImage(setBusinessLogo)} />
          <ImageUploadBox label="Business Registration Certificate" required asset={regCert} onPick={() => pickImage(setRegCert)} />
          <ImageUploadBox label="Business Licence" required asset={bizLicence} onPick={() => pickImage(setBizLicence)} />
        </>
      ) : (
        <>
          <SectionTitle>Personal Information</SectionTitle>
          <FieldLabel required>Registered Phone Number (as on ID)</FieldLabel>
          <TextBox value={phoneNumber} onChange={setPhoneNumber} placeholder="+256 700 000 000" keyboardType="phone-pad" />
          <FieldLabel required>Physical Address / Location</FieldLabel>
          <TextBox value={physicalAddress} onChange={setPhysicalAddress} placeholder="Street, Parish, District" multiline />
          <ImageUploadBox label="Personal Receipt / Invoice" required asset={receipt} onPick={() => pickImage(setReceipt)} />
        </>
      )}

      <SectionTitle>Identity Documents</SectionTitle>
      <ImageUploadBox label="National ID â€” Front" required asset={idFront} onPick={() => pickImage(setIdFront)} />
      <ImageUploadBox label="National ID â€” Back" required asset={idBack} onPick={() => pickImage(setIdBack)} />

      <SectionTitle>Product Categories</SectionTitle>
      <Text style={styles.catHint}>Choose categories you will sell in (select all that apply).</Text>
      {fetchingCats
        ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 10 }} />
        : (
          <View style={styles.catGrid}>
            {allCategories.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.catPill, categories.includes(c.id) && styles.catPillActive]}
                onPress={() => toggleCategory(c.id)}
              >
                <Text style={[styles.catPillText, categories.includes(c.id) && { color: '#fff' }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )
      }

      <View style={styles.stepNav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
          <Text style={styles.backBtnText}>â† Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={next}>
          <Text style={styles.navBtnText}>Next â†’</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // â”€â”€ Step 2: Subscription selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderStep2 = () => (
    <View>
      <Text style={styles.title}>ðŸ’³ Choose a Plan</Text>
      <Text style={styles.sub}>Select the subscription that suits your selling needs.</Text>

      {SUBSCRIPTION_PLANS.map(plan => {
        const color   = PLAN_COLORS[plan.key];
        const active  = selectedPlan === plan.key;
        return (
          <TouchableOpacity
            key={plan.key}
            style={[styles.planCard, active && { borderColor: color, borderWidth: 2 }]}
            onPress={() => setSelectedPlan(plan.key)}
          >
            <View style={styles.planHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planName, { color }]}>{plan.label}</Text>
                <Text style={styles.planDuration}>{plan.days} days</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.planPrice}>UGX {plan.price.toLocaleString()}</Text>
                {active && (
                  <View style={[styles.selectedPill, { backgroundColor: color }]}>
                    <Text style={styles.selectedPillText}>Selected âœ“</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ gap: 4, marginTop: 8 }}>
              {plan.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={[styles.featureIcon, { color }]}>âœ“</Text>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.stepNav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
          <Text style={styles.backBtnText}>â† Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, !selectedPlan && { opacity: 0.4 }]} onPress={next} disabled={!selectedPlan}>
          <Text style={styles.navBtnText}>Next â†’</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // â”€â”€ Step 3: Payment method â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderStep3 = () => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.key === selectedPlan);
    const selectedMethod = paymentMethods.find(m => m.key === paymentMethod);
    return (
      <View>
        <Text style={styles.title}>Payment Method</Text>
        <Text style={styles.sub}>Select how you will pay for your subscription.</Text>

        {plan && (
          <View style={[styles.summaryBox, { borderColor: PLAN_COLORS[plan.key] }]}>
            <Text style={styles.summaryLabel}>Selected Plan</Text>
            <Text style={[styles.summaryPlan, { color: PLAN_COLORS[plan.key] }]}>{plan.label}</Text>
            <Text style={styles.summaryPrice}>UGX {plan.price.toLocaleString()} / {plan.days} days</Text>
          </View>
        )}

        <View style={styles.payGrid}>
          {paymentMethods.map(pm => (
            <TouchableOpacity
              key={pm.key}
              style={[styles.payCard, paymentMethod === pm.key && styles.payCardActive]}
              onPress={() => setPaymentMethod(pm.key)}
            >
              {pm.key === 'yo_uganda'
                ? <Image source={require('../../../assets/Yo Uganda.png')} style={styles.payCardImg} resizeMode="contain" />
                : <Text style={styles.payCardIcon}>{pm.icon}</Text>
              }
              <Text style={[styles.payCardLabel, paymentMethod === pm.key && { color: COLORS.primary }]}>{pm.label}</Text>
              <Text style={styles.payCardDesc}>{pm.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.stepNav}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}><MaterialCommunityIcons name="arrow-left" size={16} color={COLORS.primary} /><Text style={styles.backBtnText}>Back</Text></View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, (loading || !paymentMethod) && { opacity: 0.5 }]}
            onPress={() => { if (!paymentMethod) { Alert.alert('Required', 'Please select a payment method.'); return; } setShowPayModal(true); }}
            disabled={loading || !paymentMethod}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Text style={styles.navBtnText}>Proceed to Pay</Text><MaterialCommunityIcons name="check" size={16} color="#fff" /></View>
            }
          </TouchableOpacity>
        </View>

        <PaymentFlowModal
          visible={showPayModal}
          method={selectedMethod}
          plan={plan}
          phoneNumber={phoneNumber}
          bankDetails={bankDetails}
          onConfirm={(extra) => submit(extra)}
          onCancel={() => setShowPayModal(false)}
        />
      </View>
    );
  };

  // â”€â”€ Step indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const STEPS = ['Type', 'Details', 'Plan', 'Payment'];
  const renderSteps = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((s, i) => (
        <View key={i} style={styles.stepItem}>
          <View style={[styles.stepDot, i <= step && { backgroundColor: COLORS.primary }]}>
            <Text style={styles.stepDotText}>{i + 1}</Text>
          </View>
          <Text style={[styles.stepLabel, i === step && { color: COLORS.primary, fontWeight: '700' }]}>{s}</Text>
        </View>
      ))}
    </View>
  );

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {renderSteps()}
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const styles = StyleSheet.create({
  container  : { flex: 1, backgroundColor: '#fff' },
  inner      : { padding: 20, paddingBottom: 50 },

  // Step indicator
  stepIndicator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  stepItem     : { alignItems: 'center', flex: 1 },
  stepDot      : { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepDotText  : { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepLabel    : { fontSize: 10, color: '#aaa', textAlign: 'center' },

  title      : { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  sub        : { color: '#888', marginBottom: 20, fontSize: 14, lineHeight: 20 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginTop: 22, marginBottom: 8, borderBottomWidth: 1, borderColor: '#f0f0f0', paddingBottom: 6 },
  label      : { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginTop: 12, marginBottom: 4 },
  input      : { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#f5f5f5', color: '#1a1a1a' },

  // Upload box
  uploadBox    : { marginTop: 12 },
  uploadBtn    : { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, borderStyle: 'dashed', height: 90, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9', overflow: 'hidden' },
  uploadBtnText: { color: '#888', fontSize: 14 },
  uploadPreview: { width: '100%', height: '100%', borderRadius: 10 },

  // Type cards
  typeCard     : { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  typeCardActive: { borderColor: COLORS.primary, backgroundColor: '#fff8f0' },
  typeIcon     : { fontSize: 28 },
  typeName     : { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  typeDesc     : { fontSize: 13, color: '#666', lineHeight: 18 },
  typeCheck    : { fontSize: 20, color: COLORS.primary, fontWeight: '800' },

  // Categories
  catHint   : { fontSize: 13, color: '#888', marginBottom: 10 },
  catGrid   : { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catPill   : { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  catPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catPillText: { fontSize: 12, color: '#555' },

  // Plan cards
  planCard     : { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#eee' },
  planHeader   : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName     : { fontSize: 18, fontWeight: '800' },
  planDuration : { fontSize: 12, color: '#888', marginTop: 2 },
  planPrice    : { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  selectedPill : { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  selectedPillText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  featureRow   : { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureIcon  : { fontSize: 13, fontWeight: '700' },
  featureText  : { fontSize: 13, color: '#555' },

  // Payment radio
  payOption       : { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#f3f4f6', gap: 12 },
  payOptionActive : { backgroundColor: '#fff8f0' },
  radioOuter      : { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  radioInner      : { width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.primary },
  payOptionText   : { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },

  // Summary box
  summaryBox   : { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 14, borderWidth: 1.5, marginBottom: 16 },
  summaryLabel : { fontSize: 12, color: '#888', marginBottom: 2 },
  summaryPlan  : { fontSize: 18, fontWeight: '800' },
  summaryPrice : { fontSize: 14, color: '#555', marginTop: 2 },

  // Navigation buttons
  stepNav  : { flexDirection: 'row', gap: 10, marginTop: 28 },
  backBtn  : { flex: 1, borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  backBtnText: { color: '#888', fontWeight: '600', fontSize: 15 },
  navBtn   : { flex: 2, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  navBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  submitBtn: { flex: 2, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },

  // Payment method grid
  payGrid    : { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  payCard    : { width: '47%', borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, padding: 16, alignItems: 'center', gap: 6, backgroundColor: '#fafafa' },
  payCardActive: { borderColor: COLORS.primary, backgroundColor: '#fff8f0' },
  payCardIcon  : { fontSize: 28 },
  payCardImg   : { width: 80, height: 38, resizeMode: 'contain' },
  payCardLabel : { fontSize: 14, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  payCardDesc  : { fontSize: 11, color: '#888', textAlign: 'center' },
});

// ── Payment modal styles ───────────────────────────────────────────────────────
const pm = StyleSheet.create({
  overlay  : { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet    : { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  handle   : { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title    : { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  sub      : { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 },
  planBadge: { backgroundColor: '#fff8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 18, alignSelf: 'flex-start' },
  planBadgeText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginBottom: 6, marginTop: 10 },
  phoneReadonlyBox: { backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4, marginTop: 6 },
  phoneReadonlyValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', letterSpacing: 0.5 },
  input    : { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#f5f5f5', color: '#1a1a1a', marginBottom: 4 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn : { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  cancelBtnText: { color: '#888', fontWeight: '600', fontSize: 14 },
  bankBox  : { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, marginBottom: 8, gap: 10 },
  bankRow  : { gap: 2 },
  bankLabel: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase' },
  bankValue: { fontSize: 15, color: '#1a1a1a', fontWeight: '700' },
  copyHint : { fontSize: 11, color: COLORS.primary, fontWeight: '400' },
  successBox: { alignItems: 'center', padding: 20, gap: 8 },
  successIcon: { fontSize: 48 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#16a34a' },
  successSub: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },
  loadingBox: { alignItems: 'center', paddingVertical: 20, gap: 12 },
  loadingText: { fontSize: 14, color: '#555', fontWeight: '600' },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginVertical: 6, borderWidth: 1, borderColor: '#fecaca' },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500' },
  fieldNoteBox: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 12, marginBottom: 8 },
  fieldNoteText: { color: '#1d4ed8', fontSize: 13, lineHeight: 18 },
});

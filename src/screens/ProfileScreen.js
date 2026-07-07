import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

export default function ProfileScreen({ navigation }) {
  const { user, refreshUser, logout } = useAuth();
  const [form, setForm]     = useState({ name: '', phone: '', email: '', age: '', country: '' });
  const [avatarUri, setAvatarUri] = useState(null);
  const [saving, setSaving]    = useState(false);
  const [fbModal, setFbModal]       = useState(false);
  const [fbSubject, setFbSubject]   = useState('');
  const [fbMessage, setFbMessage]   = useState('');
  const [fbCategory, setFbCategory] = useState('general');
  const [fbSuccess, setFbSuccess]   = useState(false);
  const [sending, setSending]       = useState(false);

  const FB_CATEGORIES = [
    { value: 'general',    icon: 'chat-outline', label: 'General'    },
    { value: 'bug',        icon: 'bug-outline', label: 'Bug Report' },
    { value: 'suggestion', icon: 'lightbulb-outline', label: 'Suggestion' },
    { value: 'delivery',   icon: 'truck-outline', label: 'Delivery'   },
    { value: 'payment',    icon: 'credit-card-outline', label: 'Payment'    },
  ];

  useEffect(() => {
    if (user) setForm({ name: user.name || '', phone: user.phone || '', email: user.email || '', age: String(user.age || ''), country: user.country || '' });
  }, [user]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Please allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaType.images, allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled && result.assets?.length > 0) setAvatarUri(result.assets[0].uri);
  };

  const save = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (avatarUri) fd.append('profile_picture', { uri: avatarUri, name: 'avatar.jpg', type: 'image/jpeg' });
      await client.post('/auth/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not save profile.');
    } finally { setSaving(false); }
  };

  const handleLogout = async () => {
    await logout();
  };

  const closeFbModal = () => { setFbModal(false); setFbSuccess(false); setFbSubject(''); setFbMessage(''); setFbCategory('general'); };

  const sendFeedback = async () => {
    if (!fbMessage.trim()) return;
    setSending(true);
    try {
      const prefix = fbCategory !== 'general' ? `[${fbCategory.charAt(0).toUpperCase() + fbCategory.slice(1)}] ` : '';
      const subject = (prefix + fbSubject.trim()) || null;
      await client.post('/feedback', { subject, message: fbMessage.trim() });
      setFbSuccess(true); setFbSubject(''); setFbMessage('');
    } catch { Alert.alert('Error', 'Could not send feedback. Please try again.'); }
    finally { setSending(false); }
  };

  const getInitials = (name) => (name || 'U').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const getAvatarBg = (gender) => gender === 'male' ? { backgroundColor: 'rgba(255,161,0,0.2)' } : gender === 'female' ? { backgroundColor: 'rgba(236,72,153,0.15)' } : { backgroundColor: '#f1f5f9' };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Avatar placeholder */}
        <View style={styles.avatarWrap}>
            <TouchableOpacity onPress={pickAvatar} style={styles.avatarCircle}>
              {(avatarUri || user?.profile_picture) ? (
                <Image
                  source={{ uri: avatarUri || (user?.profile_picture?.startsWith('http') ? user.profile_picture : `${client.defaults.baseURL.replace('/api', '')}/storage/${user.profile_picture}`) }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={[styles.avatarInitials, getAvatarBg(user?.gender)]}>
                  <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
                </View>
              )}
              <View style={styles.avatarCameraBtn}>
                <MaterialCommunityIcons name="camera" size={12} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          <Text style={styles.avatarRole}>{user?.role?.toUpperCase()}</Text>
        </View>

        {[
          ['name',    'Full Name',    'default', false],
          ['phone',   'Phone',        'phone-pad', false],
          ['email',   'Email',        'email-address', false],
          ['age',     'Age',          'numeric', false],
          ['country', 'Country',      'default', false],
        ].map(([key, label, type]) => (
          <View key={key}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={form[key]}
              onChangeText={v => set(key, v)}
              placeholder={label}
              keyboardType={type}
              autoCapitalize="none"
              placeholderTextColor="#aaa"
            />
          </View>
        ))}

        <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Changes</Text>}
        </TouchableOpacity>

        {/* Feedback */}
        <TouchableOpacity style={styles.fbBtn} onPress={() => setFbModal(true)}>
          <MaterialCommunityIcons name="chat-outline" size={16} color="#fff" />
          <Text style={styles.fbBtnText}>Give Feedback</Text>
        </TouchableOpacity>

        {/* My Offers shortcut */}
        <TouchableOpacity style={styles.fbBtn} onPress={() => navigation.navigate('MyOffers')}>
          <MaterialCommunityIcons name="tag-multiple-outline" size={16} color="#fff" />
          <Text style={styles.fbBtnText}>My Price Offers</Text>
        </TouchableOpacity>

        {/* About Us */}
        <TouchableOpacity style={styles.fbBtn} onPress={() => navigation.navigate('About')}>
          <MaterialCommunityIcons name="information-outline" size={16} color="#fff" />
          <Text style={styles.fbBtnText}>About Us</Text>
        </TouchableOpacity>

        {/* Policies */}
        <TouchableOpacity style={styles.fbBtn} onPress={() => navigation.navigate('Policies')}>
          <MaterialCommunityIcons name="shield-outline" size={16} color="#fff" />
          <Text style={styles.fbBtnText}>Policies</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Feedback modal */}
        <Modal visible={fbModal} transparent animationType="slide" onRequestClose={closeFbModal}>
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalBox}>
              {/* Handle bar */}
              <View style={styles.modalHandle} />

              {fbSuccess ? (
                /* Success state */
                <View style={styles.fbSuccessWrap}>
                  <MaterialCommunityIcons name="check-circle" size={48} color={COLORS.primary} />
                  <Text style={styles.fbSuccessTitle}>Thank you!</Text>
                  <Text style={styles.fbSuccessSub}>Your feedback has been received and we'll review it soon.</Text>
                  <TouchableOpacity style={styles.fbDoneBtn} onPress={closeFbModal}>
                    <Text style={styles.fbDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.modalHeader}>
                    <View style={styles.fbHeaderIcon}>
                      <MaterialCommunityIcons name="chat-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>Share Feedback</Text>
                      <Text style={styles.modalSub}>Goes directly to our admin team</Text>
                    </View>
                    <TouchableOpacity style={styles.fbCloseBtn} onPress={closeFbModal}>
                      <MaterialCommunityIcons name="close" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Category chips */}
                  <Text style={styles.fbLabel}>Type</Text>
                  <View style={styles.fbChipsRow}>
                    {FB_CATEGORIES.map(c => (
                      <TouchableOpacity
                        key={c.value}
                        style={[styles.fbChip, fbCategory === c.value && styles.fbChipActive]}
                        onPress={() => setFbCategory(c.value)}
                      >
                        <MaterialCommunityIcons name={c.icon} size={14} color={fbCategory === c.value ? '#fff' : COLORS.primary} />
                        <Text style={[styles.fbChipText, fbCategory === c.value && { color: '#fff' }]}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fbLabel}>Subject <Text style={styles.fbOptional}>(optional)</Text></Text>
                  <TextInput
                    style={styles.fbInput}
                    value={fbSubject}
                    onChangeText={setFbSubject}
                    placeholder="e.g. Checkout, Search, Orders…"
                    placeholderTextColor="#aaa"
                    maxLength={120}
                  />

                  <View style={styles.fbLabelRow}>
                    <Text style={styles.fbLabel}>Message <Text style={{ color: '#ef4444' }}>*</Text></Text>
                    <Text style={styles.fbCharCount}>{fbMessage.length}/500</Text>
                  </View>
                  <TextInput
                    style={[styles.fbInput, styles.fbTextarea]}
                    value={fbMessage}
                    onChangeText={setFbMessage}
                    placeholder="Tell us what's on your mind — a bug, suggestion, or general thought…"
                    placeholderTextColor="#aaa"
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />

                  <View style={styles.fbActionsRow}>
                    <TouchableOpacity style={styles.fbCancelBtn} onPress={closeFbModal}>
                      <Text style={styles.fbCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.fbSendBtn, (!fbMessage.trim() || sending) && { opacity: 0.45 }]}
                      onPress={sendFeedback}
                      disabled={!fbMessage.trim() || sending}
                    >
                      {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.fbSendText}>Send Feedback</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container  : { flex: 1, backgroundColor: '#fff' },
  inner      : { padding: 20, paddingBottom: 40 },
  avatarWrap     : { alignItems: 'center', marginBottom: 24, paddingTop: 20 },
  avatarCircle   : { position: 'relative', marginBottom: 2 },
  avatarImg      : { width: 80, height: 80, borderRadius: 40 },
  avatarInitials : { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarText     : { fontSize: 28, fontWeight: '800', color: '#fff' },
  avatarCameraBtn: { position: 'absolute', bottom: 0, right: -2, backgroundColor: '#fff', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: '#e2e8f0' },
  avatarName     : { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginTop: 10 },
  avatarRole     : { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  label      : { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginTop: 14, marginBottom: 4 },
  input      : { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#f9f9f9', color: '#1a1a1a' },
  btn        : { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  btnText    : { color: '#fff', fontSize: 16, fontWeight: '700' },
  fbBtn      : { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  fbBtnText  : { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  logoutBtn  : { borderWidth: 2, borderColor: '#ef4444', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  logoutText : { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  modalOverlay  : { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalBox      : { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  modalHandle   : { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 16 },
  modalHeader   : { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  modalTitle    : { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  modalSub      : { fontSize: 12, color: '#64748b', marginTop: 1 },
  fbHeaderIcon  : { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  fbCloseBtn    : { width: 32, height: 32, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  fbCloseBtnText: { fontSize: 14, color: '#94a3b8' },
  fbLabel       : { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  fbOptional    : { fontWeight: '400', textTransform: 'none', color: '#94a3b8', letterSpacing: 0 },
  fbLabelRow    : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fbCharCount   : { fontSize: 11, color: '#94a3b8' },
  fbChipsRow    : { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  fbChip        : { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  fbChipActive  : { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  fbChipText    : { fontSize: 12.5, fontWeight: '600', color: '#475569' },
  fbInput       : { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: '#f8fafc', color: '#0f172a', marginBottom: 12 },
  fbTextarea    : { height: 110, textAlignVertical: 'top' },
  fbActionsRow  : { flexDirection: 'row', gap: 10, marginTop: 4 },
  fbCancelBtn   : { flex: 1, borderRadius: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  fbCancelBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  fbSendBtn     : { flex: 2, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  fbSendText    : { color: '#fff', fontWeight: '700', fontSize: 14 },
  fbSuccessWrap : { alignItems: 'center', paddingVertical: 32, gap: 10 },
  fbSuccessIcon : { fontSize: 52 },
  fbSuccessTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  fbSuccessSub  : { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  fbDoneBtn     : { marginTop: 8, paddingVertical: 11, paddingHorizontal: 36, borderRadius: 12, backgroundColor: '#f1f5f9' },
  fbDoneBtnText : { color: '#0f172a', fontWeight: '700', fontSize: 14 },
});

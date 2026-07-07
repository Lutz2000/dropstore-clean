import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

const PLAN_COLORS = {
  weekly: '#3b82f6',
  monthly: COLORS.primary,
  quarterly: '#8b5cf6',
};

export default function VendorDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNewVendor, setIsNewVendor] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [fbModal, setFbModal] = useState(false);
  const [fbSubject, setFbSubject] = useState('');
  const [fbMessage, setFbMessage] = useState('');
  const [fbCategory, setFbCategory] = useState('general');
  const [fbSuccess, setFbSuccess] = useState(false);
  const [sending, setSending] = useState(false);

  // Weekly survey state
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyWeekLabel, setSurveyWeekLabel] = useState('');
  const [surveyStock, setSurveyStock] = useState('');
  const [surveySales, setSurveySales] = useState('');
  const [surveySubmitting, setSurveySubmitting] = useState(false);

  // Broadcast messages state
  const [bcastQueue, setBcastQueue] = useState([]);
  const [bcastIdx, setBcastIdx] = useState(0);
  const [bcastOpen, setBcastOpen] = useState(false);

  const FB_CATEGORIES = [
    { value: 'general', icon: 'chat-outline', label: 'General' },
    { value: 'bug', icon: 'bug', label: 'Bug' },
    { value: 'suggestion',icon: 'lightbulb-outline', label: 'Suggestion'},
    { value: 'products', icon: 'package-outline', label: 'Products' },
    { value: 'payment', icon: 'credit-card', label: 'Payment' },
  ];

  const closeFbModal = () => { setFbModal(false); setFbSuccess(false); setFbSubject(''); setFbMessage(''); setFbCategory('general'); };

  const handleLogout = () => { // <-- ADDED THIS
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout }
    ])
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadStats();
      checkSurvey();
      loadBroadcastMessages();
      checkIsNewVendor();
    });
    return unsubscribe;
  }, [navigation, loadBroadcastMessages]);

  const checkIsNewVendor = async () => {
    try {
      if (user?.created_at) {
        const createdTime = new Date(user.created_at).getTime();
        const now = Date.now();
        const diffMinutes = (now - createdTime) / (1000 * 60);
        if (diffMinutes < 60) {
          const storageKey = `vd_seen_${user.id}`;
          const hasSeen = await AsyncStorage.getItem(storageKey);
          if (!hasSeen) {
            setIsNewVendor(true);
            setShowDisclaimer(true);
          }
        }
      }
    } catch (_) {}
  };

  const checkSurvey = async () => {
    try {
      const res = await client.get('/vendor/weekly-survey/pending');
      if (res.data.pending) {
        const fmt = (d) => new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
        setSurveyWeekLabel(`${fmt(res.data.week_start)} – ${fmt(res.data.week_end)}`);
        setSurveyOpen(true);
      }
    } catch (_) {}
  };

  const loadBroadcastMessages = useCallback(async () => {
    try {
      const res = await client.get('/broadcast-messages');
      const msgs = Array.isArray(res.data)? res.data : (res.data?.data || []);
      const seenKey = `ds_seen_msgs_${user?.id || 'guest'}`;
      const seenRaw = await AsyncStorage.getItem(seenKey);
      const seen = new Set((seenRaw || '').split(',').filter(Boolean));
      const unseen = msgs.filter(m =>!seen.has(String(m.id)));
      if (unseen.length) {
        setBcastQueue(unseen);
        setBcastIdx(0);
        setBcastOpen(true);
      }
    } catch (e) {
      console.warn('[DropStore] Broadcast messages error:', e?.response?.status, e?.message);
    }
  }, [user]);

  const dismissBcast = async () => {
    const msg = bcastQueue[bcastIdx];
    const seenKey = `ds_seen_msgs_${user?.id || 'guest'}`;
    if (msg) {
      const seenRaw = await AsyncStorage.getItem(seenKey);
      const seenArr = (seenRaw || '').split(',').filter(Boolean);
      if (!seenArr.includes(String(msg.id))) {
        seenArr.push(String(msg.id));
        await AsyncStorage.setItem(seenKey, seenArr.join(','));
      }
    }
    if (bcastIdx + 1 < bcastQueue.length) {
      setBcastIdx(bcastIdx + 1);
    } else {
      setBcastOpen(false);
    }
  };

  const submitSurvey = async () => {
    if (surveyStock === '' || surveySales === '') {
      Alert.alert('Required', 'Please answer both questions before continuing.');
      return;
    }
    setSurveySubmitting(true);
    try {
      await client.post('/vendor/weekly-survey', {
        stock_count: parseInt(surveyStock) || 0,
        sales_count: parseInt(surveySales) || 0,
      });
      setSurveyOpen(false);
      setSurveyStock('');
      setSurveySales('');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Could not submit. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSurveySubmitting(false);
    }
  };

  const closeDisclaimer = async () => {
    try {
      const storageKey = `vd_seen_${user.id}`;
      await AsyncStorage.setItem(storageKey, 'true');
    } catch (_) {}
    setShowDisclaimer(false);
  };

  const loadStats = async () => {
    try {
      const res = await client.get('/vendor/stats');
      setStats(res.data);
    } catch (e) {
    } finally { setLoading(false); }
  };

  const sendFeedback = async () => {
    if (!fbMessage.trim()) return;
    setSending(true);
    try {
      const prefix = fbCategory!== 'general'? `[${fbCategory.charAt(0).toUpperCase() + fbCategory.slice(1)}] ` : '';
      const subject = (prefix + fbSubject.trim()) || null;
      await client.post('/feedback', { subject, message: fbMessage.trim() });
      setFbSuccess(true); setFbSubject(''); setFbMessage('');
    } catch { Alert.alert('Error', 'Could not send feedback. Please try again.'); }
    finally { setSending(false); }
  };

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;

  const tiles = [
    { label: 'Products', value: stats?.total_products?? 0, icon: 'package-outline', sub: (stats?.sold_out_products?? 0) > 0? `${stats.sold_out_products} sold out` : `${stats?.active_products?? 0} active` },
    { label: 'Clicks', value: stats?.total_clicks?? 0, icon: 'eye-outline' },
    { label: 'Deliveries', value: (stats?.pending_deliveries?? 0) + (stats?.completed_deliveries?? 0), icon: 'truck-outline' },
    { label: 'Plan', value: stats?.subscription_plan? (stats.subscription_plan.charAt(0).toUpperCase() + stats.subscription_plan.slice(1)) : 'Free', icon: 'star-outline' },
  ];

  const hasSub = stats?.subscription_plan && stats.subscription_plan!== 'free';
  const planColor = PLAN_COLORS[stats?.subscription_plan] || '#888';
  const daysLeft = stats?.days_remaining?? 0;
  const isVerified = stats?.verified_badge;
  const hasApplied = stats?.has_application || stats?.has_store;
  const hasStore = stats?.has_store;

 // return (
    //... ALL YOUR JSX REMAINS THE SAME...
  //);
}

// MERGED INTO ONE STYLESHEET
const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: '#f9f9f9' },
  header : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting : { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  sub : { fontSize: 13, color: '#888', marginTop: 2 },
  logoutLink : { color: '#ef4444', fontWeight: '600' },

  // Disclaimer Modal Styles
  disclaimerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  disclaimerContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '90%',
  },
  disclaimerHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  disclaimerHeaderText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4
  },
  disclaimerHeaderSub: {
    fontSize: 13,
    color: '#888'
  },
  disclaimerSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12
  },
  disclaimerRulesSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  disclaimerRule: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  disclaimerRuleIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  disclaimerRuleIconText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12
  },
  disclaimerRuleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4
  },
  disclaimerRuleDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18
  },
  disclaimerFreemiumSection: {
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  disclaimerFreemiumText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 8
  },
  disclaimerFreemiumList: {
    marginBottom: 12
  },
  disclaimerFreemiumItem: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4
  },
  disclaimerFreemiumUpsell: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
    fontStyle: 'italic'
  },
  disclaimerPlansSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  disclaimerPlanCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary
  },
  disclaimerPlanTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6
  },
  disclaimerPlanPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 2
  },
  disclaimerPlanDuration: {
    fontSize: 11,
    color: '#888',
    marginBottom: 8
  },
  disclaimerPlanFeature: {
    fontSize: 12,
    color: '#333',
    marginBottom: 3
  },
  disclaimerSecuritySection: {
    padding: 20,
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  disclaimerSecurityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  disclaimerSecurityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary
  },
  disclaimerSecurityText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18
  },
  disclaimerCloseBtn: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  disclaimerCloseBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14
  },

  subCard : { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, elevation: 2, borderLeftWidth: 4 },
  subCardRow : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  subBadge : { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  subBadgeText : { color: '#fff', fontSize: 11, fontWeight: '800' },
  subCardRight : { fontSize: 13, color: '#888', fontWeight: '600' },
  subCardDetail : { fontSize: 12, color: '#555' },

  upgradeCard : { backgroundColor: '#fff8f0', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#ffe8c0' },
  upgradeTitle : { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  upgradeSub : { fontSize: 13, color: '#555', marginBottom: 6 },
  upgradeLink : { fontSize: 13, color: COLORS.primary, fontWeight: '700' },

  expiredCard : { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#fecaca' },
  expiredCardTop : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  expiredBadge : { backgroundColor: '#fee2e2', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  expiredBadgeText: { fontSize: 11, fontWeight: '800', color: '#dc2626' },
  expiredDays : { fontSize: 12, color: '#ef4444', fontWeight: '700' },
  expiredMsg : { fontSize: 13, color: '#7f1d1d', lineHeight: 19, marginBottom: 12 },
  renewBtn : { backgroundColor: '#ef4444', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  renewBtnText : { color: '#fff', fontWeight: '800', fontSize: 14 },

  stockCard : { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', elevation: 2 },
  stockCardHeader : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  stockCardTitle : { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  lowStockBadge : { backgroundColor: '#fef3c7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#fde68a' },
  lowStockBadgeText: { fontSize: 11, color: '#d97706', fontWeight: '700' },
  stockRow : { flexDirection: 'row', alignItems: 'center' },
  stockStat : { flex: 1, alignItems: 'center' },
  stockDivider : { width: 1, height: 36, backgroundColor: '#e2e8f0' },
  stockVal : { fontSize: 22, fontWeight: '800', color: '#0f172a', lineHeight: 26 },
  stockLbl : { fontSize: 10, color: '#94a3b8', marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  grid : { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  tile : { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 2 },
  tileIcon : { fontSize: 28, marginBottom: 6 },
  tileValue : { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  tileLabel : { fontSize: 12, color: '#888', marginTop: 2 },
  tileSub : { fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: '600' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  actionBtn : { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, elevation: 1 },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  actionBtnPremium: { backgroundColor: '#fffbeb', borderWidth: 1.5, borderColor: '#fde68a' },
  actionBtnTextPremium: { color: '#92400e', fontWeight: '800' },
  offerBadge : { backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center' },
  offerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  applyCard : { backgroundColor: COLORS.primary, borderRadius: 14, padding: 20, marginTop: 16 },
  applyTitle : { fontSize: 18, fontWeight: '800', color: '#fff' },
  applySub : { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6 },
  applyBtn : { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 14 },
  applyBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },

  feedbackBtn : { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, elevation: 1 },
  feedbackBtnText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },

  modalOverlay : { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalBox : { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  modalHandle : { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 16 },
  modalHeader : { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  modalTitle : { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  modalSub : { fontSize: 12, color: '#64748b', marginTop: 1 },
  fbHeaderIcon : { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  fbCloseBtn : { width: 32, height: 32, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  fbCloseBtnText: { fontSize: 14, color: '#94a3b8' },
  fbLabel : { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  fbOptional : { fontWeight: '400', textTransform: 'none', color: '#94a3b8', letterSpacing: 0 },
  fbLabelRow : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fbCharCount : { fontSize: 11, color: '#94a3b8' },
  fbChipsRow : { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  fbChip : { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  fbChipActive : { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  fbChipText : { fontSize: 12.5, fontWeight: '600', color: '#475569' },
  fbInput : { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, backgroundColor: '#f8fafc', color: '#0f172a', marginBottom: 12 },
  fbTextarea : { height: 110, textAlignVertical: 'top' },
  fbActionsRow : { flexDirection: 'row', gap: 10, marginTop: 4 },
  fbCancelBtn : { flex: 1, borderRadius: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  fbCancelBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  fbSendBtn : { flex: 2, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  fbSendText : { color: '#fff', fontWeight: '700', fontSize: 14 },
  fbSuccessWrap : { alignItems: 'center', paddingVertical: 32, gap: 10 },
  fbSuccessIcon : { fontSize: 52 },
  fbSuccessTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  fbSuccessSub : { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  fbDoneBtn : { marginTop: 8, paddingVertical: 11, paddingHorizontal: 36, borderRadius: 12, backgroundColor: '#f1f5f9' },
  fbDoneBtnText : { color: '#0f172a', fontWeight: '700', fontSize: 14 },

  // Weekly Survey Modal
  surveyOverlay : { flex: 1, backgroundColor: 'rgba(15,23,42,0.8)', justifyContent: 'center', padding: 20 },
  surveyBox : { backgroundColor: '#fff', borderRadius: 22, padding: 24 },
  surveyEmoji : { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  surveyTitle : { fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 4 },
  surveySub : { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 14 },
  surveyNote : { backgroundColor: '#fefce8', borderRadius: 10, padding: 10, marginBottom: 18, borderWidth: 1, borderColor: '#fde68a' },
  surveyNoteText : { fontSize: 12, color: '#92400e', lineHeight: 18 },
  surveyQuestion : { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8, lineHeight: 20 },
  surveyInput : { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4, textAlign: 'center' },
  surveyBtn : { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  surveyBtnText : { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Verified badge card
  verifiedCard : { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: '#22c55e', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verifiedCardLeft : { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  verifiedCardBadge: { fontSize: 28 },
  verifiedCardTitle: { fontSize: 16, fontWeight: '800', color: '#15803d' },
  verifiedCardSub : { fontSize: 12, color: '#4ade80', marginTop: 2 },
  verifiedCardPill : { backgroundColor: '#22c55e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  verifiedCardPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Verification progress card
  verifyProgressCard : { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  verifyProgressTitle : { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  verifyProgressSub : { fontSize: 12, color: '#888', marginBottom: 14 },
  verifySteps : { gap: 0 },
  verifyStepRow : { flexDirection: 'row', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' },
  verifyStepDot : { width: 26, height: 26, borderRadius: 13, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  verifyStepDotDone : { backgroundColor: '#22c55e' },
  verifyStepDotPending: { backgroundColor: '#f59e0b' },
  verifyStepDotText : { fontSize: 12, fontWeight: '800', color: '#fff' },
  verifyStepLine : { position: 'absolute', left: 12, top: 26, width: 2, height: 18, backgroundColor: '#e5e7eb' },
  verifyStepLineDone : { backgroundColor: '#22c55e' },
  verifyStepLabel : { fontSize: 13, color: '#888', flex: 1, paddingVertical: 4 },
  verifyStepLabelDone : { color: '#15803d', fontWeight: '700' },
  verifyStepLabelPending: { color: '#b45309', fontWeight: '600' },
  verifyActionBtn : { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 12 },
  verifyActionText : { color: '#fff', fontWeight: '700', fontSize: 13 },
  verifyWaiting : { fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 10 },

  // Broadcast message popup
  bcastOverlay : { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  bcastCard : { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, overflow: 'hidden', elevation: 10 },
  bcastHeader : { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 20, paddingBottom: 0 },
  bcastIconWrap : { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff7ed', borderWidth: 1.5, borderColor: '#fed7aa', alignItems: 'center', justifyContent: 'center' },
  bcastIconEmoji: { fontSize: 22 },
  bcastTitleBlock: { flex: 1 },
  bcastFrom : { fontSize: 10, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.7 },
  bcastTitle : { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 2, lineHeight: 22 },
  bcastBody : { padding: 16, paddingTop: 12 },
  bcastContent : { fontSize: 14, color: '#374151', lineHeight: 22 },
  bcastDate : { fontSize: 11, color: '#94a3b8', marginTop: 8 },
  bcastFooter : { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 0, justifyContent: 'flex-end', gap: 10 },
  bcastCounter : { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginRight: 'auto' },
  bcastBtn : { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 22 },
  bcastBtnText : { color: '#fff', fontWeight: '700', fontSize: 14 },
});
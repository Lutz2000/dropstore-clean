import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Dimensions,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PLAN_COLORS = {
  weekly:    '#3b82f6',
  monthly:   COLORS.primary,
  quarterly: '#8b5cf6',
};

export default function VendorDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNewVendor, setIsNewVendor] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [fbModal, setFbModal]       = useState(false);
  const [fbSubject, setFbSubject]   = useState('');
  const [fbMessage, setFbMessage]   = useState('');
  const [fbCategory, setFbCategory] = useState('general');
  const [fbSuccess, setFbSuccess]   = useState(false);
  const [sending, setSending]       = useState(false);

  // Weekly survey state
  const [surveyOpen, setSurveyOpen]       = useState(false);
  const [surveyWeekLabel, setSurveyWeekLabel] = useState('');
  const [surveyStock, setSurveyStock]     = useState('');
  const [surveySales, setSurveySales]     = useState('');
  const [surveySubmitting, setSurveySubmitting] = useState(false);

  // Broadcast messages state
  const [bcastQueue, setBcastQueue] = useState([]);
  const [bcastIdx,   setBcastIdx]   = useState(0);
  const [bcastOpen,  setBcastOpen]  = useState(false);

  const FB_CATEGORIES = [
    { value: 'general',   icon: 'chat-outline', label: 'General'   },
    { value: 'bug',       icon: 'bug', label: 'Bug'       },
    { value: 'suggestion',icon: 'lightbulb-outline', label: 'Suggestion'},
    { value: 'products',  icon: 'package-variant-closed', label: 'Products'  },
    { value: 'payment',   icon: 'credit-card-outline', label: 'Payment'   },
  ];

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const closeFbModal = () => { setFbModal(false); setFbSuccess(false); setFbSubject(''); setFbMessage(''); setFbCategory('general'); };

  const loadBroadcastMessages = useCallback(async () => {
    try {
      const res     = await client.get('/broadcast-messages');
      const msgs    = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const seenKey = `ds_seen_msgs_${user?.id || 'guest'}`;
      const seenRaw = await AsyncStorage.getItem(seenKey);
      const seen    = new Set((seenRaw || '').split(',').filter(Boolean));
      const unseen  = msgs.filter(m => !seen.has(String(m.id)));
      if (unseen.length) {
        setBcastQueue(unseen);
        setBcastIdx(0);
        setBcastOpen(true);
      }
    } catch (e) {
      console.warn('[DropStore] Broadcast messages error:', e?.response?.status, e?.message);
    }
  }, [user]);

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

  const dismissBcast = async () => {
    const msg     = bcastQueue[bcastIdx];
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
      const prefix = fbCategory !== 'general' ? `[${fbCategory.charAt(0).toUpperCase() + fbCategory.slice(1)}] ` : '';
      const subject = (prefix + fbSubject.trim()) || null;
      await client.post('/feedback', { subject, message: fbMessage.trim() });
      setFbSuccess(true); setFbSubject(''); setFbMessage('');
    } catch { Alert.alert('Error', 'Could not send feedback. Please try again.'); }
    finally { setSending(false); }
  };

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;

  const tiles = [
    { label: 'Products',   value: stats?.total_products   ?? 0, icon: 'package-variant-closed', sub: (stats?.sold_out_products ?? 0) > 0 ? `${stats.sold_out_products} sold out` : `${stats?.active_products ?? 0} active` },
    { label: 'Clicks',     value: stats?.total_clicks     ?? 0, icon: 'eye-outline' },
    { label: 'Deliveries', value: (stats?.pending_deliveries ?? 0) + (stats?.completed_deliveries ?? 0), icon: 'truck-outline' },
    { label: 'Plan',       value: stats?.subscription_plan ? (stats.subscription_plan.charAt(0).toUpperCase() + stats.subscription_plan.slice(1)) : 'Free', icon: 'star-outline' },
  ];

  const hasSub       = stats?.subscription_plan && stats.subscription_plan !== 'free';
  const planColor    = PLAN_COLORS[stats?.subscription_plan] || '#888';
  const daysLeft     = stats?.days_remaining ?? 0;
  const isVerified   = stats?.verified_badge;
  const hasApplied   = stats?.has_application || stats?.has_store;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.greeting}>
              Hello, {user?.name?.split(' ')[0]}
            </Text>
            {isVerified && <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.primary} />}
          </View>
          <Text style={styles.sub}>Vendor Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutLink}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Subscription status card */}
      {hasSub && daysLeft > 0 ? (
        <TouchableOpacity
          style={[styles.subCard, { borderLeftColor: planColor }]}
          onPress={() => navigation.navigate('VendorSubscription')}
        >
          <View style={styles.subCardRow}>
            <View style={[styles.subBadge, { backgroundColor: planColor }]}>
              <Text style={styles.subBadgeText}>{stats.subscription_plan.toUpperCase()}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.primary} />
              <Text style={styles.subCardRight}>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</Text>
            </View>
          </View>
          <Text style={styles.subCardDetail}>
            {isVerified ? 'Verified Vendor' : 'Pending admin approval'} • {stats.images_per_product} images/product  •  Promo banners active
          </Text>
        </TouchableOpacity>
      ) : hasSub && daysLeft <= 0 ? (
        <View style={styles.expiredCard}>
          <View style={styles.expiredCardTop}>
            <View style={styles.expiredBadge}>
              <Text style={styles.expiredBadgeText}>{stats.subscription_plan.toUpperCase()} — EXPIRED</Text>
            </View>
            <Text style={styles.expiredDays}>0 days left</Text>
          </View>
          <Text style={styles.expiredMsg}>
            Your subscription has ended. Choose a plan and complete payment to reactivate your verified badge and features.
          </Text>
          <TouchableOpacity
            style={styles.renewBtn}
            onPress={() => navigation.navigate('VendorSubscription')}
          >
            <Text style={styles.renewBtnText}>🔄 Choose a Plan &amp; Renew</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.upgradeCard}
          onPress={() => navigation.navigate('VendorSubscription')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <MaterialCommunityIcons name="lock-open-outline" size={20} color={COLORS.primary} />
            <Text style={styles.upgradeTitle}>Unlock More Features</Text>
          </View>
          <Text style={styles.upgradeSub}>Subscribe from UGX 11,000/week — verified badge, more images & promo banners.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <Text style={styles.upgradeLink}>View Plans</Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color={COLORS.primary} />
          </View>
        </TouchableOpacity>
      )}

      {/* Verification status card */}
      {isVerified ? (
        <View style={styles.verifiedCard}>
          <View style={styles.verifiedCardLeft}>
            <MaterialCommunityIcons name="medal" size={24} color={COLORS.primary} style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.verifiedCardTitle}>Verified Vendor</Text>
              <Text style={styles.verifiedCardSub}>Your store is verified &amp; trusted by DropStore</Text>
            </View>
          </View>
          <View style={styles.verifiedCardPill}>
            <Text style={styles.verifiedCardPillText}>VERIFIED</Text>
          </View>
        </View>
      ) : (
        <View style={styles.verifyProgressCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <MaterialCommunityIcons name="medal" size={20} color={COLORS.primary} />
            <Text style={styles.verifyProgressTitle}>Verified Badge Progress</Text>
          </View>
          <Text style={styles.verifyProgressSub}>Complete all steps to get your verified badge</Text>
          <View style={styles.verifySteps}>
            {[
              { label: 'Account Registered',   done: true },
              { label: 'Applied for Store',     done: hasApplied },
              { label: 'Subscribed to a Plan',  done: hasSub },
              { label: 'Admin Approval',        done: false, pending: hasApplied && hasSub },
              { label: 'Verified Badge Granted', done: false },
            ].map((step, i) => (
              <View key={i} style={styles.verifyStepRow}>
                <View style={[
                  styles.verifyStepDot,
                  step.done    && styles.verifyStepDotDone,
                  step.pending && styles.verifyStepDotPending,
                ]}>
                  {step.done ? (
                    <MaterialCommunityIcons name="check" size={14} color="#fff" />
                  ) : step.pending ? (
                    <MaterialCommunityIcons name="clock" size={14} color="#fff" />
                  ) : (
                    <Text style={styles.verifyStepDotText}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[
                  styles.verifyStepLabel,
                  step.done    && styles.verifyStepLabelDone,
                  step.pending && styles.verifyStepLabelPending,
                ]}>
                  {step.label}{step.pending ? ' — Pending' : ''}
                </Text>
              </View>
            ))}
          </View>
          {!hasApplied && (
            <TouchableOpacity style={styles.verifyActionBtn} onPress={() => navigation.navigate('VendorApply')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={styles.verifyActionText}>Apply for Store</Text><MaterialCommunityIcons name="arrow-right" size={14} color={COLORS.primary} /></View>
            </TouchableOpacity>
          )}
          {hasApplied && !hasSub && (
            <TouchableOpacity style={styles.verifyActionBtn} onPress={() => navigation.navigate('VendorSubscription')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={styles.verifyActionText}>Subscribe Now</Text><MaterialCommunityIcons name="arrow-right" size={14} color={COLORS.primary} /></View>
            </TouchableOpacity>
          )}
          {hasApplied && hasSub && (
            <Text style={styles.verifyWaiting}>Waiting for admin review — we'll notify you once approved.</Text>
          )}
        </View>
      )}

      {/* Stats grid */}
      <View style={styles.grid}>
        {tiles.map(t => (
          <View key={t.label} style={styles.tile}>
            <View style={styles.tileHeader}>
              <MaterialCommunityIcons name={t.icon} size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.tileValue}>{t.value}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
            {t.sub ? <Text style={[styles.tileSub, t.sub.includes('sold out') && { color: '#dc2626' }]}>{t.sub}</Text> : null}
          </View>
        ))}
      </View>

      {/* Stock & Sales Summary */}
      {((stats?.total_stock ?? 0) > 0 || (stats?.total_sold ?? 0) > 0) && (
        <View style={styles.stockCard}>
          <View style={styles.stockCardHeader}>
            <Text style={styles.stockCardTitle}>📦 Stock &amp; Sales</Text>
            {(stats?.low_stock_products ?? 0) > 0 && (
              <View style={styles.lowStockBadge}>
                <Text style={styles.lowStockBadgeText}>⚠️ {stats.low_stock_products} low</Text>
              </View>
            )}
          </View>
          <View style={styles.stockRow}>
            <View style={styles.stockStat}>
              <Text style={styles.stockVal}>{stats?.total_stock ?? 0}</Text>
              <Text style={styles.stockLbl}>Added</Text>
            </View>
            <View style={styles.stockDivider} />
            <View style={styles.stockStat}>
              <Text style={[styles.stockVal, { color: '#f59e0b' }]}>{stats?.total_sold ?? 0}</Text>
              <Text style={styles.stockLbl}>Sold</Text>
            </View>
            <View style={styles.stockDivider} />
            <View style={styles.stockStat}>
              <Text style={[styles.stockVal, { color: (stats?.available_stock ?? 0) <= 5 ? '#ef4444' : '#16a34a' }]}>
                {stats?.available_stock ?? 0}
              </Text>
              <Text style={styles.stockLbl}>Available</Text>
            </View>
            <View style={styles.stockDivider} />
            <View style={styles.stockStat}>
              <Text style={[styles.stockVal, { color: '#6366f1' }]}>
                {(stats?.total_stock ?? 0) > 0 ? Math.round(((stats?.total_sold ?? 0) / stats.total_stock) * 100) : 0}%
              </Text>
              <Text style={styles.stockLbl}>Sold Out</Text>
            </View>
          </View>
        </View>
      )}

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      {[
        { icon: 'package-variant-closed', label: 'My Products',  screen: 'VendorProducts' },
        { icon: 'chat-outline',            label: 'Price Offers', screen: 'VendorOffers',       badge: stats?.unread_offers },
        { icon: 'bell-outline',            label: 'Notifications',screen: 'VendorNotifications', badge: stats?.unread_notifications },
        { icon: 'message-outline',         label: 'Messages',     screen: 'ChatList',            badge: stats?.unread_chat },
        { icon: 'credit-card-outline',     label: 'Subscription', screen: 'VendorSubscription' },
        { icon: 'truck-outline',           label: 'Deliveries',   screen: 'Deliveries' },
        { icon: 'account-outline',         label: 'Profile',      screen: 'Profile' },
        stats?.premium_subscription?.status === 'active'
          ? { icon: 'diamond', label: 'Premium Dashboard', screen: 'VendorPremiumDashboard', highlight: true }
          : { icon: 'diamond-outline', label: 'Go Premium',        screen: 'VendorPremiumPackages',  highlight: true },
      ].map(a => (
        <TouchableOpacity key={a.screen} style={[styles.actionBtn, a.highlight && styles.actionBtnPremium]} onPress={() => navigation.navigate(a.screen)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <MaterialCommunityIcons name={a.icon} size={20} color={a.highlight ? '#d97706' : COLORS.primary} />
            <Text style={[styles.actionBtnText, a.highlight && styles.actionBtnTextPremium]}>{a.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {a.badge > 0 && (
              <View style={styles.offerBadge}>
                <Text style={styles.offerBadgeText}>{a.badge}</Text>
              </View>
            )}
            <MaterialCommunityIcons name="chevron-right" size={18} color={a.highlight ? '#d97706' : '#cbd5e1'} />
          </View>
        </TouchableOpacity>
      ))}

      {/* Store application prompt */}
      {!stats?.has_store && (
        <View style={styles.applyCard}>
          <Text style={styles.applyTitle}>Start Selling Today</Text>
          <Text style={styles.applySub}>Apply to open your store and list products on DropStore.</Text>
          <TouchableOpacity style={styles.applyBtn} onPress={() => navigation.navigate('VendorApply')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Text style={styles.applyBtnText}>Apply for Store</Text>
              <MaterialCommunityIcons name="arrow-right" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.feedbackBtn} onPress={() => setFbModal(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MaterialCommunityIcons name="chat-outline" size={18} color="#475569" />
          <Text style={styles.feedbackBtnText}>Give Feedback</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#cbd5e1" />
      </TouchableOpacity>

      {/* ── Broadcast Message Popup ── */}
      <Modal visible={bcastOpen} transparent animationType="fade" onRequestClose={dismissBcast}>
        <View style={styles.bcastOverlay}>
          <View style={styles.bcastCard}>
            <View style={styles.bcastHeader}>
              <View style={styles.bcastIconWrap}>
                <MaterialCommunityIcons name="bullhorn-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.bcastTitleBlock}>
                <Text style={styles.bcastFrom}>Message from DropStore</Text>
                <Text style={styles.bcastTitle} numberOfLines={2}>
                  {bcastQueue[bcastIdx]?.title}
                </Text>
              </View>
            </View>
            <View style={styles.bcastBody}>
              <Text style={styles.bcastContent}>{bcastQueue[bcastIdx]?.content}</Text>
              {bcastQueue[bcastIdx]?.created_at && (
                <Text style={styles.bcastDate}>
                  {new Date(bcastQueue[bcastIdx].created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              )}
            </View>
            <View style={styles.bcastFooter}>
              {bcastQueue.length > 1 && (
                <Text style={styles.bcastCounter}>{bcastIdx + 1} / {bcastQueue.length}</Text>
              )}
              <TouchableOpacity style={styles.bcastBtn} onPress={dismissBcast}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  <Text style={styles.bcastBtnText}>Got it</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Weekly Survey Modal ── */}
      <Modal visible={surveyOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <KeyboardAvoidingView style={styles.surveyOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.surveyBox}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="note-text-outline" size={38} color={COLORS.primary} />
            </View>
            <Text style={styles.surveyTitle}>Weekly Check-In</Text>
            <Text style={styles.surveySub}>{surveyWeekLabel}</Text>
            <View style={styles.surveyNote}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="information-outline" size={16} color="#0066cc" />
                <Text style={styles.surveyNoteText}>This helps DropStore support your business. You must answer to continue using your dashboard.</Text>
              </View>
            </View>

            <Text style={styles.surveyQuestion}>
              How many products do you currently have left in stock?
            </Text>
            <TextInput
              style={styles.surveyInput}
              keyboardType="numeric"
              placeholder="e.g. 15"
              value={surveyStock}
              onChangeText={setSurveyStock}
              maxLength={6}
            />

            <Text style={[styles.surveyQuestion, { marginTop: 14 }]}>
              How many sales did you make this week (Mon – Sun)?
            </Text>
            <TextInput
              style={styles.surveyInput}
              keyboardType="numeric"
              placeholder="e.g. 5"
              value={surveySales}
              onChangeText={setSurveySales}
              maxLength={6}
            />

            <TouchableOpacity
              style={[styles.surveyBtn, surveySubmitting && { opacity: 0.55 }]}
              onPress={submitSurvey}
              disabled={surveySubmitting}
            >
              {surveySubmitting
                ? <ActivityIndicator color="#fff" />
                : <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Text style={styles.surveyBtnText}>Submit & Continue</Text><MaterialCommunityIcons name="arrow-right" size={14} color="#fff" /></View>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Feedback Modal */}
      <Modal visible={fbModal} transparent animationType="slide" onRequestClose={closeFbModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBox}>
            <View style={styles.modalHandle} />

            {fbSuccess ? (
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
                  <View style={styles.fbHeaderIcon}><MaterialCommunityIcons name="chat-outline" size={20} color={COLORS.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Share Feedback</Text>
                    <Text style={styles.modalSub}>Goes directly to our admin team</Text>
                  </View>
                  <TouchableOpacity style={styles.fbCloseBtn} onPress={closeFbModal}>
                    <MaterialCommunityIcons name="close" size={22} color="#64748b" />
                  </TouchableOpacity>
                </View>

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
                  placeholder="e.g. Products, Payments, Deliveries…"
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

      {/* Vendor Disclaimer Modal */}
      <Modal visible={showDisclaimer} transparent animationType="fade" onRequestClose={closeDisclaimer}>
        <View style={styles.disclaimerOverlay}>
          <ScrollView 
            style={styles.disclaimerContent} 
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.disclaimerHeader}>
              <Text style={styles.disclaimerHeaderText}>Welcome, Vendor!</Text>
              <Text style={styles.disclaimerHeaderSub}>Please review our community guidelines</Text>
            </View>

            <View style={styles.disclaimerRulesSection}>
              <Text style={styles.disclaimerSectionTitle}>Community Rules</Text>
              {[
                { title: '🚫 No Fraud', description: 'Sell only genuine products. Fake items will result in account suspension.', color: '#ef4444' },
                { title: '🤐 No Defamations', description: 'Respect competitors & customers. Abusive behavior leads to immediate ban.', color: '#f97316' },
                { title: '🛡️ No Con Men', description: 'Don\'t scam customers. Refund or resolve disputes honestly.', color: '#a855f7' }
              ].map((rule, idx) => (
                <View key={idx} style={styles.disclaimerRule}>
                  <View style={[styles.disclaimerRuleIcon, { backgroundColor: rule.color }]}>
                    <Text style={styles.disclaimerRuleIconText}>{rule.title.split(' ')[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.disclaimerRuleTitle}>{rule.title}</Text>
                    <Text style={styles.disclaimerRuleDesc}>{rule.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.disclaimerCloseBtnWrap}>
              <TouchableOpacity style={styles.disclaimerCloseBtn} onPress={closeDisclaimer}>
                <Text style={styles.disclaimerCloseBtnText}>I Understand & Accept</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: '#f8fafc' },
  header      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting    : { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  sub         : { fontSize: 13, color: '#64748b', marginTop: 2 },
  logoutLink  : { color: '#ef4444', fontWeight: '700', fontSize: 13 },

  // Upgrade & Sub Cards
  upgradeCard : { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  upgradeTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  upgradeSub  : { fontSize: 13, color: '#475569', lineHeight: 18 },
  upgradeLink : { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  subCard     : { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderLeftWidth: 5, elevation: 2 },
  subCardRow  : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subBadge    : { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  subBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  subCardRight: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  subCardDetail: { fontSize: 12, color: '#64748b', lineHeight: 18 },

  expiredCard : { backgroundColor: '#fef2f2', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#fca5a5' },
  expiredCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  expiredBadge: { backgroundColor: '#dc2626', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  expiredBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  expiredDays : { color: '#dc2626', fontWeight: '800', fontSize: 12 },
  expiredMsg  : { fontSize: 12, color: '#991b1b', lineHeight: 18, marginBottom: 12 },
  renewBtn    : { backgroundColor: '#dc2626', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  renewBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Verification
  verifiedCard: { backgroundColor: '#f0fdf4', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verifiedCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  verifiedCardTitle: { fontSize: 15, fontWeight: '800', color: '#166534' },
  verifiedCardSub: { fontSize: 11, color: '#15803d', marginTop: 2 },
  verifiedCardPill: { backgroundColor: '#16a34a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  verifiedCardPillText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  verifyProgressCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  verifyProgressTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  verifyProgressSub: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  verifySteps : { gap: 10, marginBottom: 12 },
  verifyStepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verifyStepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  verifyStepDotDone: { backgroundColor: '#16a34a' },
  verifyStepDotPending: { backgroundColor: '#f59e0b' },
  verifyStepDotText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  verifyStepLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  verifyStepLabelDone: { color: '#15803d', fontWeight: '700' },
  verifyStepLabelPending: { color: '#b45309', fontWeight: '700' },
  verifyActionBtn: { backgroundColor: '#f0fdf4', paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: '#bbf7d0', marginTop: 6 },
  verifyActionText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  verifyWaiting: { fontSize: 12, color: '#b45309', fontStyle: 'italic', marginTop: 4 },

  // Stats Grid
  grid        : { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  tile        : { width: (SCREEN_WIDTH - 44) / 2, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  tileHeader  : { marginBottom: 8 },
  tileValue   : { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  tileLabel   : { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 2 },
  tileSub     : { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  // Stock
  stockCard   : { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  stockCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stockCardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  lowStockBadge: { backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#fca5a5' },
  lowStockBadgeText: { color: '#dc2626', fontSize: 10, fontWeight: '800' },
  stockRow    : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stockStat   : { alignItems: 'center', flex: 1 },
  stockVal    : { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  stockLbl    : { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '600' },
  stockDivider: { width: 1, height: 24, backgroundColor: '#e2e8f0' },

  // Quick Actions
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  actionBtn   : { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0' },
  actionBtnPremium: { backgroundColor: '#fffbe3', borderColor: '#fef08a' },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  actionBtnTextPremium: { color: '#b45309' },
  offerBadge  : { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  offerBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  applyCard   : { backgroundColor: '#0f172a', borderRadius: 16, padding: 18, marginBottom: 16, marginTop: 6 },
  applyTitle  : { fontSize: 16, fontWeight: '800', color: '#fff' },
  applySub    : { fontSize: 12, color: '#94a3b8', marginTop: 4, marginBottom: 14, lineHeight: 18 },
  applyBtn    : { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  feedbackBtn : { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginTop: 4, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0' },
  feedbackBtnText: { fontSize: 14, fontWeight: '700', color: '#475569' },

  // Modals & Overlays
  bcastOverlay : { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  bcastCard    : { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, overflow: 'hidden', elevation: 10 },
  bcastHeader  : { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 20, paddingBottom: 0 },
  bcastIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  bcastTitleBlock: { flex: 1 },
  bcastFrom    : { fontSize: 10, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase' },
  bcastTitle   : { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  bcastBody    : { padding: 20 },
  bcastContent : { fontSize: 14, color: '#334155', lineHeight: 22 },
  bcastDate    : { fontSize: 11, color: '#94a3b8', marginTop: 10 },
  bcastFooter  : { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 0, justifyContent: 'flex-end', gap: 10 },
  bcastCounter : { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginRight: 'auto' },
  bcastBtn     : { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  bcastBtnText : { color: '#fff', fontWeight: '700', fontSize: 13 },

  surveyOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  surveyBox    : { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 400 },
  surveyTitle  : { fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  surveySub    : { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 2, marginBottom: 14 },
  surveyNote   : { backgroundColor: '#eff6ff', borderRadius: 10, padding: 12, marginBottom: 16 },
  surveyNoteText: { fontSize: 11, color: '#1e40af', flex: 1, lineHeight: 16 },
  surveyQuestion: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  surveyInput  : { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a' },
  surveyBtn    : { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  surveyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox    : { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  modalHandle : { width: 36, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1', alignSelf: 'center', marginBottom: 16 },
  fbSuccessWrap: { alignItems: 'center', paddingVertical: 20 },
  fbSuccessTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 12 },
  fbSuccessSub: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  fbDoneBtn   : { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10 },
  fbDoneBtnText: { color: '#fff', fontWeight: '800' },
  modalHeader : { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  fbHeaderIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  modalTitle  : { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalSub    : { fontSize: 12, color: '#64748b' },
  fbCloseBtn  : { padding: 4 },
  fbLabel     : { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 10 },
  fbOptional  : { color: '#94a3b8', fontWeight: '400' },
  fbChipsRow  : { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  fbChip      : { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f8fafc' },
  fbChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  fbChipText  : { fontSize: 12, color: '#475569', fontWeight: '600' },
  fbInput     : { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' },
  fbLabelRow  : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fbCharCount : { fontSize: 11, color: '#94a3b8' },
  fbTextarea  : { height: 90 },
  fbActionsRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  fbCancelBtn : { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  fbCancelBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  fbSendBtn   : { flex: 2, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  fbSendText  : { color: '#fff', fontWeight: '800', fontSize: 13 },

  disclaimerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  disclaimerContent: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '85%', width: '100%', maxWidth: 420 },
  disclaimerHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  disclaimerHeaderText: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  disclaimerHeaderSub: { fontSize: 12, color: '#64748b' },
  disclaimerSectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  disclaimerRulesSection: { padding: 20 },
  disclaimerRule: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  disclaimerRuleIcon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  disclaimerRuleIconText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  disclaimerRuleTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  disclaimerRuleDesc: { fontSize: 11, color: '#64748b', lineHeight: 16 },
  disclaimerCloseBtnWrap: { paddingHorizontal: 20, paddingBottom: 10 },
  disclaimerCloseBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  disclaimerCloseBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});

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
    { value: 'products',  icon: 'package-outline', label: 'Products'  },
    { value: 'payment',   icon: 'credit-card', label: 'Payment'   },
  ];

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const closeFbModal = () => { setFbModal(false); setFbSuccess(false); setFbSubject(''); setFbMessage(''); setFbCategory('general'); };

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
    { label: 'Products',   value: stats?.total_products   ?? 0, icon: 'package-outline', sub: (stats?.sold_out_products ?? 0) > 0 ? `${stats.sold_out_products} sold out` : `${stats?.active_products ?? 0} active` },
    { label: 'Clicks',     value: stats?.total_clicks     ?? 0, icon: 'eye-outline' },
    { label: 'Deliveries', value: (stats?.pending_deliveries ?? 0) + (stats?.completed_deliveries ?? 0), icon: 'truck-outline' },
    { label: 'Plan',       value: stats?.subscription_plan ? (stats.subscription_plan.charAt(0).toUpperCase() + stats.subscription_plan.slice(1)) : 'Free', icon: 'star-outline' },
  ];

  const hasSub       = stats?.subscription_plan && stats.subscription_plan !== 'free';
  const planColor    = PLAN_COLORS[stats?.subscription_plan] || '#888';
  const daysLeft     = stats?.days_remaining ?? 0;
  const isVerified   = stats?.verified_badge;
  const hasApplied   = stats?.has_application || stats?.has_store;
  const hasStore     = stats?.has_store;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {isVerified ? (
                <>
                  <MaterialCommunityIcons name="check-circle" size={14} color={COLORS.primary} />
                  <Text>Verified Vendor</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="clock-outline" size={14} color="#f59e0b" />
                  <Text>Pending admin approval</Text>
                </>
              )}
            </View> • {stats.images_per_product} images/product  •  Promo banners active
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <MaterialCommunityIcons name="lock-open-outline" size={20} color={COLORS.primary} />
            <Text style={styles.upgradeTitle}>Unlock More Features</Text>
          </View>
          <Text style={styles.upgradeSub}>Subscribe from UGX 11,000/week — verified badge, more images & promo banners.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={styles.upgradeLink}>View Plans</Text><MaterialCommunityIcons name="arrow-right" size={14} color={COLORS.primary} /></View>
        </TouchableOpacity>
      )}

      {/* Verification status card */}
      {isVerified ? (
        <View style={styles.verifiedCard}>
          <View style={styles.verifiedCardLeft}>
            <MaterialCommunityIcons name="medal" size={24} color={COLORS.primary} style={{ marginRight: 4 }} />
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
                    <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  ) : step.pending ? (
                    <MaterialCommunityIcons name="clock" size={16} color="#fff" />
                  ) : (
                    <Text style={styles.verifyStepDotText}>{i + 1}</Text>
                  )}
                </View>
                {i < 4 && <View style={[styles.verifyStepLine, step.done && styles.verifyStepLineDone]} />}
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
            <Text style={styles.tileIcon}>{t.icon}</Text>
            <Text style={styles.tileValue}>{t.value}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
            {t.sub ? <Text style={[styles.tileSub, t.sub.includes('sold out') && { color: '#dc2626' }]}>{t.sub}</Text> : null}
          </View>
        ))}
      </View>

      {/* Stock & Sales Summary (only if vendor has any stock-tracked products) */}
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
        { icon: 'package-outline', label: 'My Products',      screen: 'VendorProducts' },
        { icon: 'chat-outline', label: 'Price Offers',     screen: 'VendorOffers',       badge: stats?.unread_offers },
        { icon: 'bell-outline', label: 'Notifications',    screen: 'VendorNotifications', badge: stats?.unread_notifications },
        { icon: 'message-outline', label: 'Messages',         screen: 'ChatList',            badge: stats?.unread_chat },
        { icon: 'credit-card', label: 'Subscription',     screen: 'VendorSubscription' },
        { icon: 'truck-outline', label: 'Deliveries',       screen: 'Deliveries' },
        { icon: 'account-outline', label: 'Profile',          screen: 'Profile' },
        stats?.premium_subscription?.status === 'active'
          ? { icon: 'diamond', label: 'Premium Dashboard', screen: 'VendorPremiumDashboard', highlight: true }
          : { icon: 'diamond-outline', label: 'Go Premium',        screen: 'VendorPremiumPackages',  highlight: true },
      ].map(a => (
        <TouchableOpacity key={a.screen} style={[styles.actionBtn, a.highlight && styles.actionBtnPremium]} onPress={() => navigation.navigate(a.screen)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name={a.icon} size={16} color={a.highlight ? '#d97706' : COLORS.primary} />
            <Text style={[styles.actionBtnText, a.highlight && styles.actionBtnTextPremium]}>{a.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {a.badge > 0 && (
              <View style={styles.offerBadge}>
                <Text style={styles.offerBadgeText}>{a.badge}</Text>
              </View>
            )}
            <Text style={{ color: a.highlight ? '#d97706' : '#aaa' }}>›</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Store application prompt */}
      {!stats?.has_store && (
        <View style={styles.applyCard}>
          <Text style={styles.applyTitle}>Start Selling Today</Text>
          <Text style={styles.applySub}>Apply to open your store and list products on DropStore.</Text>
          <TouchableOpacity style={styles.applyBtn} onPress={() => navigation.navigate('VendorApply')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Text style={styles.applyBtnText}>Apply for Store</Text><MaterialCommunityIcons name="arrow-right" size={14} color="#fff" /></View>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.feedbackBtn} onPress={() => setFbModal(true)}>
        <MaterialCommunityIcons name="chat-outline" size={16} color="#fff" />
        <Text style={styles.feedbackBtnText}>Give Feedback</Text>
        <Text style={{ color: '#aaa' }}>›</Text>
      </TouchableOpacity>

      {/* ── Broadcast Message Popup ── */}
      <Modal visible={bcastOpen} transparent animationType="fade" onRequestClose={dismissBcast}>
        <View style={styles.bcastOverlay}>
          <View style={styles.bcastCard}>
            {/* Header */}
            <View style={styles.bcastHeader}>
              <View style={styles.bcastIconWrap}>
                <MaterialCommunityIcons name="speaker-multiple" size={20} color="#fff" />
              </View>
              <View style={styles.bcastTitleBlock}>
                <Text style={styles.bcastFrom}>Message from DropStore</Text>
                <Text style={styles.bcastTitle} numberOfLines={2}>
                  {bcastQueue[bcastIdx]?.title}
                </Text>
              </View>
            </View>
            {/* Body */}
            <View style={styles.bcastBody}>
              <Text style={styles.bcastContent}>{bcastQueue[bcastIdx]?.content}</Text>
              {bcastQueue[bcastIdx]?.created_at && (
                <Text style={styles.bcastDate}>
                  {new Date(bcastQueue[bcastIdx].created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              )}
            </View>
            {/* Footer */}
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

      {/* ── Weekly Survey Modal (blocking – cannot be dismissed) ── */}
      <Modal visible={surveyOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <KeyboardAvoidingView style={styles.surveyOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.surveyBox}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons name="note-outline" size={40} color={COLORS.primary} />
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

      {/* Feedback modal */}
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
                    <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
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
            {/* Header */}
            <View style={styles.disclaimerHeader}>
              <Text style={styles.disclaimerHeaderText}>Welcome, Vendor!</Text>
              <Text style={styles.disclaimerHeaderSub}>Please review our community guidelines</Text>
            </View>

            {/* Rules */}
            <View style={styles.disclaimerRulesSection}>
              <Text style={styles.disclaimerSectionTitle}>Community Rules</Text>
              
              {[
                {
                  title: '🚫 No Fraud',
                  description: 'Sell only genuine products. Fake items will result in account suspension.',
                  color: '#ef4444'
                },
                {
                  title: '🤐 No Defamations',
                  description: 'Respect competitors & customers. Abusive behavior leads to immediate ban.',
                  color: '#f97316'
                },
                {
                  title: '🛡️ No Con Men',
                  description: 'Don\'t scam customers. Refund or resolve disputes honestly.',
                  color: '#a855f7'
                }
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

            {/* Freemium Info */}
            <View style={styles.disclaimerFreemiumSection}>
              <Text style={styles.disclaimerSectionTitle}>Freemium Plan</Text>
              <Text style={styles.disclaimerFreemiumText}>
                On the free plan, you can upload:
              </Text>
              <View style={styles.disclaimerFreemiumList}>
                <Text style={styles.disclaimerFreemiumItem}>• Up to 2 products</Text>
                <Text style={styles.disclaimerFreemiumItem}>• Up to 2 images per product</Text>
              </View>
              <Text style={styles.disclaimerFreemiumUpsell}>
                Upgrade to unlock unlimited products, images, promotional banners, verified badge, and more!
              </Text>
            </View>

            {/* Subscription Plans */}
            <View style={styles.disclaimerPlansSection}>
              <Text style={styles.disclaimerSectionTitle}>Upgrade Your Plan</Text>
              
              <View style={styles.disclaimerPlanCard}>
                <Text style={styles.disclaimerPlanTitle}>📦 No Promo</Text>
                <Text style={styles.disclaimerPlanPrice}>Free</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ 2 products</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ 2 images/product</Text>
              </View>

              <View style={styles.disclaimerPlanCard}>
                <Text style={styles.disclaimerPlanTitle}>⭐ TOP Promo</Text>
                <Text style={styles.disclaimerPlanPrice}>UGX 11,000</Text>
                <Text style={styles.disclaimerPlanDuration}>per week</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ Unlimited products</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ Unlimited images</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ Verified badge</Text>
              </View>

              <View style={styles.disclaimerPlanCard}>
                <Text style={styles.disclaimerPlanTitle}>🔥 Boost Premium</Text>
                <Text style={styles.disclaimerPlanPrice}>UGX 20,000</Text>
                <Text style={styles.disclaimerPlanDuration}>per month</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ All TOP features</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ Promo banners</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ Featured listings</Text>
              </View>

              <View style={styles.disclaimerPlanCard}>
                <Text style={styles.disclaimerPlanTitle}>👑 Go Premium</Text>
                <Text style={styles.disclaimerPlanPrice}>UGX 50,000</Text>
                <Text style={styles.disclaimerPlanDuration}>per quarter</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ All Boost features</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ Priority support</Text>
                <Text style={styles.disclaimerPlanFeature}>✓ Custom storefront</Text>
              </View>
            </View>

            {/* Security Warning */}
            <View style={styles.disclaimerSecuritySection}>
              <View style={styles.disclaimerSecurityHeader}>
                <MaterialCommunityIcons name="lock" size={20} color={COLORS.primary} />
                <Text style={styles.disclaimerSecurityTitle}>Security Reminder</Text>
              </View>
              <Text style={styles.disclaimerSecurityText}>
                Never share your password or login credentials with anyone. DropStore admins will never ask for your password.
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity style={styles.disclaimerCloseBtn} onPress={closeDisclaimer}>
              <Text style={styles.disclaimerCloseBtnText}>I Understand & Accept</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: '#f9f9f9' },
  header      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting    : { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  sub         : { fontSize: 13, color: '#888', marginTop: 2 },
  logoutLink  : { color: '#ef4444', fontWeight: '600' },

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
});

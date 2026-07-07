import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, Linking,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client from '../../api/client';
import { COLORS, SIZES } from '../../constants/theme';

const GOLD = '#d97706';
const GOLD_LIGHT = '#fbbf24';

export default function VendorPremiumDashboardScreen({ navigation }) {
  const [stats, setStats]         = useState(null);
  const [carts, setCarts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadingCarts, setLoadingCarts] = useState(true);
  const [callModal, setCallModal] = useState(null);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadAll);
    return unsub;
  }, [navigation]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const res = await client.get('/premium/stats');
      setStats(res.data);
      // load carts in background
      loadCarts();
    } catch (e) {
      if (e?.response?.status === 403) {
        Alert.alert('Premium Required', 'This dashboard is only for active premium subscribers.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } finally { setLoading(false); }
  };

  const loadCarts = async () => {
    setLoadingCarts(true);
    try {
      const res = await client.get('/premium/abandoned-carts');
      setCarts(Array.isArray(res.data) ? res.data : []);
    } catch { setCarts([]); }
    finally { setLoadingCarts(false); }
  };

  const formatUGX = (n) => `UGX ${Number(n).toLocaleString('en-UG')}`;

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const timeAgo = (d) => {
    if (!d) return '';
    const mins = Math.floor((Date.now() - new Date(d)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  if (loading) return <ActivityIndicator color={GOLD} style={{ flex: 1 }} />;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 60 }}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><MaterialCommunityIcons name="diamond" size={16} color="#fff" /><Text style={styles.headerBadge}>PREMIUM</Text></View>
          <Text style={styles.headerTitle}>Premium Dashboard</Text>
        </View>
        <View style={styles.planBadge}>
          <Text style={styles.planLabel}>{stats?.plan_label || 'Premium'}</Text>
        </View>
      </View>

      {/* Stat cards: 5-column grid */}
      <Text style={styles.sectionTitle}>Performance</Text>
      <View style={styles.statsGrid}>
        {[
          { icon: '👁️', label: 'Clicks', value: stats?.total_clicks || 0 },
          { icon: '🛍️', label: 'Cart Adds', value: stats?.total_cart_adds || 0 },
          { icon: '💰', label: 'Sales', value: formatUGX(stats?.total_sales || 0) },
          { icon: '⏱️', label: 'Avg Time', value: `${stats?.avg_time_on_product || 0}s` },
          { icon: '📊', label: 'Conv. Rate', value: `${stats?.conversion_rate || 0}%` },
        ].map(stat => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Click trend chart (simple bar chart) */}
      {stats?.click_trend && stats.click_trend.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Clicks Trend (Last 7 Days)</Text>
          <View style={styles.chartCard}>
            <View style={styles.chart}>
              {stats.click_trend.map((val, i) => {
                const maxVal = Math.max(...stats.click_trend);
                const height = maxVal ? (val / maxVal) * 120 : 10;
                return (
                  <View key={i} style={styles.barContainer}>
                    <View style={[styles.bar, { height }]} />
                    <Text style={styles.barLabel}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      )}

      {/* Top products */}
      {stats?.top_products && stats.top_products.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Top Products by Clicks</Text>
          <View style={styles.productsCard}>
            {stats.top_products.map((prod, i) => (
              <View key={prod.id} style={[styles.prodRow, i < stats.top_products.length - 1 && styles.prodRowBorder]}>
                <View style={styles.prodRank}>
                  <Text style={styles.prodRankText}>#{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prodName}>{prod.name}</Text>
                  <Text style={styles.prodSku}>{prod.sku}</Text>
                </View>
                <View style={styles.prodStat}>
                  <Text style={styles.prodClicks}>{prod.clicks}</Text>
                  <Text style={styles.prodClicksLabel}>clicks</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Abandoned carts */}
      <Text style={styles.sectionTitle}>Abandoned Carts</Text>
      {loadingCarts ? (
        <ActivityIndicator color={GOLD} />
      ) : carts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyText}>No abandoned carts yet</Text>
        </View>
      ) : (
        <View style={styles.cartsCard}>
          {carts.slice(0, 10).map((cart, i) => (
            <View key={cart.id} style={[styles.cartRow, i < Math.min(10, carts.length) - 1 && styles.cartRowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.buyerName}>{cart.buyer_name || 'Guest'}</Text>
                <Text style={styles.cartValue}>{formatUGX(cart.cart_value || 0)}</Text>
                <Text style={styles.cartTime}>{timeAgo(cart.abandoned_at)}</Text>
              </View>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => {
                  if (cart.buyer_phone) {
                    Linking.openURL(`tel:${cart.buyer_phone}`);
                  } else {
                    Alert.alert('No phone', 'Buyer phone not available.');
                  }
                }}
              >
                <MaterialCommunityIcons name="phone" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {carts.length > 10 && <Text style={styles.moreText}>+{carts.length - 10} more</Text>}
        </View>
      )}

      {/* Expiry reminder */}
      {stats?.days_remaining !== undefined && (
        <View style={[styles.reminderCard, stats.days_remaining <= 7 && styles.reminderCardWarning]}>
          <Text style={styles.reminderIcon}>⏰</Text>
          <View>
            <Text style={styles.reminderTitle}>
              {stats.days_remaining <= 0 ? '⚠️ Subscription Expired' : `${stats.days_remaining} days remaining`}
            </Text>
            <Text style={styles.reminderSub}>
              {stats.days_remaining <= 0
                ? 'Renew now to keep your premium features'
                : `Renew ${stats.plan_label || 'Premium'} to continue enjoying analytics`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.renewBtn}
            onPress={() => navigation.navigate('VendorPremiumPackages')}
          >
            <Text style={styles.renewBtnText}>Renew</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fafaf8' },

  // Header
  header: { backgroundColor: GOLD, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerBadge: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.8, marginBottom: 4 },
  headerTitle: { color: '#fff', fontWeight: '900', fontSize: 22 },
  planBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 },
  planLabel: { color: '#fff', fontWeight: '800', fontSize: 12 },

  // Section
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginHorizontal: 16, marginTop: 20, marginBottom: 10 },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, marginBottom: 12, gap: 6 },
  statCard: { flex: 0.5, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderLeftWidth: 3, borderLeftColor: GOLD },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

  // Chart
  chartCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 160 },
  barContainer: { alignItems: 'center', flex: 1 },
  bar: { width: '70%', backgroundColor: GOLD, borderRadius: 4, marginBottom: 6 },
  barLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

  // Products
  productsCard: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, marginHorizontal: 16, marginBottom: 12 },
  prodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  prodRowBorder: { borderBottomWidth: 1, borderColor: '#f1f5f9' },
  prodRank: { width: 32, height: 32, backgroundColor: GOLD_LIGHT, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  prodRankText: { color: '#92400e', fontWeight: '900', fontSize: 13 },
  prodName: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  prodSku: { fontSize: 11, color: '#94a3b8' },
  prodStat: { alignItems: 'flex-end' },
  prodClicks: { fontSize: 16, fontWeight: '900', color: GOLD },
  prodClicksLabel: { fontSize: 10, color: '#94a3b8' },

  // Carts
  cartsCard: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, marginHorizontal: 16, marginBottom: 12 },
  cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  cartRowBorder: { borderBottomWidth: 1, borderColor: '#f1f5f9' },
  buyerName: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  cartValue: { fontSize: 13, fontWeight: '800', color: GOLD, marginBottom: 2 },
  cartTime: { fontSize: 11, color: '#94a3b8' },
  callBtn: { backgroundColor: GOLD, width: 44, height: 44, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  callBtnText: { fontSize: 20 },
  moreText: { textAlign: 'center', fontSize: 12, color: '#94a3b8', paddingVertical: 10, fontWeight: '600' },

  // Empty
  emptyCard: { backgroundColor: '#fff', borderRadius: 14, padding: 32, marginHorizontal: 16, marginBottom: 12, alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },

  // Reminder
  reminderCard: { backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 32, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 3, borderLeftColor: '#10b981' },
  reminderCardWarning: { backgroundColor: '#fef3c7', borderLeftColor: '#d97706' },
  reminderIcon: { fontSize: 24 },
  reminderTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  reminderSub: { fontSize: 12, color: '#64748b', lineHeight: 18 },
  renewBtn: { marginLeft: 'auto', backgroundColor: '#10b981', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  renewBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});

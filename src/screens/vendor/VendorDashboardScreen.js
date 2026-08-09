import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';
import { deleteAccount } from '../../api/accountDeletion';

export default function VendorDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    productsCount: 0,
    clicksCount: 0,
    deliveriesCount: 0,
    planType: 'Free',
    isVerified: true,
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await client.get('/vendor/dashboard-stats');
      if (res.data) {
        setStats(res.data);
      }
    } catch (e) {
      // Graceful fallback for dashboard stats load failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleLogout = async () => {
    await logout();
  };

  // Redirect to web portal for store billing & plans (Apple IAP compliant)
  const handleOpenSubscriptionWeb = async () => {
    const webPortalUrl = 'https://dropstore.click/';
    try {
      const supported = await Linking.canOpenURL(webPortalUrl);
      if (supported) {
        await Linking.openURL(webPortalUrl);
      } else {
        Alert.alert('Error', `Unable to open browser. Please visit ${webPortalUrl}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open the vendor web portal.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and will permanently remove your vendor profile and data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await deleteAccount({ role: 'vendor', logout });

              Alert.alert(
                'Account Deleted',
                result?.message || 'Your vendor account has been removed from this device and your session has been cleared.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert('Error', error.message || 'Unable to complete account deletion at this time. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.inner}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.helloText}>Hello, {user?.name?.split(' ')[0] || 'Vendor'}</Text>
          <MaterialCommunityIcons name="check-decagram" size={20} color="#eab308" style={{ marginLeft: 6 }} />
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.signOutHeaderBtn}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subHeader}>Vendor Dashboard</Text>

      {/* Unlock More Features Banner */}
      <View style={styles.promoBanner}>
        <View style={styles.promoBannerHeader}>
          <MaterialCommunityIcons name="lock-open-outline" size={20} color="#d97706" />
          <Text style={styles.promoTitle}>Unlock More Features</Text>
        </View>
        <Text style={styles.promoText}>
          Subscribe from UGX 11,000/week — verified badge, more images & promo banners.
        </Text>
        <TouchableOpacity style={styles.viewPlansBtn} onPress={handleOpenSubscriptionWeb}>
          <Text style={styles.viewPlansText}>View Plans</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color="#d97706" />
        </TouchableOpacity>
      </View>

      {/* Verified Vendor Card */}
      <View style={styles.verifiedCard}>
        <View style={styles.verifiedLeft}>
          <MaterialCommunityIcons name="medal-outline" size={26} color="#d97706" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.verifiedTitle}>Verified Vendor</Text>
            <Text style={styles.verifiedSub}>Your store is verified & trusted by DropStore</Text>
          </View>
        </View>
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
        </View>
      </View>

      {/* Stats Overview */}
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary || '#eab308'} style={{ marginVertical: 20 }} />
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="package-variant" size={22} color="#eab308" />
            <Text style={styles.statNumber}>{stats.productsCount || 0}</Text>
            <Text style={styles.statLabel}>Products</Text>
            <Text style={styles.statSub}>{stats.productsCount || 0} active</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialCommunityIcons name="eye-outline" size={22} color="#eab308" />
            <Text style={styles.statNumber}>{stats.clicksCount || 0}</Text>
            <Text style={styles.statLabel}>Clicks</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialCommunityIcons name="truck-outline" size={22} color="#eab308" />
            <Text style={styles.statNumber}>{stats.deliveriesCount || 0}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialCommunityIcons name="star-outline" size={22} color="#eab308" />
            <Text style={styles.statNumber}>{stats.planType || 'Free'}</Text>
            <Text style={styles.statLabel}>Plan</Text>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsList}>
        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('VendorProducts')}>
          <MaterialCommunityIcons name="package-variant" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>My Products</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('VendorOffers')}>
          <MaterialCommunityIcons name="message-processing-outline" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>Price Offers</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('VendorNotifications')}>
          <MaterialCommunityIcons name="bell-outline" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>Notifications</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('ChatList')}>
          <MaterialCommunityIcons name="message-outline" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>Messages</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={handleOpenSubscriptionWeb}>
          <MaterialCommunityIcons name="credit-card-outline" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>Subscription</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Deliveries')}>
          <MaterialCommunityIcons name="truck-outline" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>Deliveries</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Profile')}>
          <MaterialCommunityIcons name="account-outline" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>Profile</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionItem, styles.premiumActionItem]} onPress={handleOpenSubscriptionWeb}>
          <MaterialCommunityIcons name="diamond-outline" size={20} color="#b45309" style={styles.actionIcon} />
          <Text style={styles.premiumActionTitle}>Go Premium</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#b45309" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Feedback')}>
          <MaterialCommunityIcons name="message-draw" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>Give Feedback</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>
      </View>

      {/* Account Options */}
      <Text style={styles.sectionTitle}>Account Options</Text>
      <View style={styles.accountOptions}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={18} color="#ef4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <MaterialCommunityIcons name="delete-outline" size={18} color="#ef4444" />
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  helloText: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  signOutHeaderBtn: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
  subHeader: { fontSize: 13, color: '#64748b', marginBottom: 16, marginTop: -2 },
  promoBanner: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 12,
  },
  promoBannerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  promoTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginLeft: 8 },
  promoText: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 10 },
  viewPlansBtn: { flexDirection: 'row', alignItems: 'center' },
  viewPlansText: { fontSize: 13, fontWeight: '700', color: '#d97706', marginRight: 4 },
  verifiedCard: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dcfce7',
    marginBottom: 16,
  },
  verifiedLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  verifiedTitle: { fontSize: 14, fontWeight: '700', color: '#166534' },
  verifiedSub: { fontSize: 11, color: '#15803d', marginTop: 1, flexWrap: 'wrap' },
  verifiedBadge: { backgroundColor: '#16a34a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'flex-start',
  },
  statNumber: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginTop: 8 },
  statLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 2 },
  statSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12, marginTop: 4 },
  actionsList: { gap: 10, marginBottom: 20 },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  actionIcon: { marginRight: 12 },
  actionTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e293b' },
  premiumActionItem: { backgroundColor: '#fffbeb', borderColor: '#fef3c7' },
  premiumActionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#b45309' },
  accountOptions: { gap: 10 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: '#fff',
  },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    paddingVertical: 13,
  },
  deleteBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
});

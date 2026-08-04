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

export default function VendorDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalSales: 0,
    pendingOffers: 0,
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await client.get('/vendor/dashboard-stats');
      if (res.data) {
        setStats(res.data);
      }
    } catch (e) {
      // Gracefully handle errors or fallbacks
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

  // Web redirect for Payments and Billing
  const handleOpenWebPayments = async () => {
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

  // Email-based deletion request handler
  const handleDeleteAccount = () => {
    Alert.alert(
      'Request Account Deletion',
      'To delete your vendor account, an email request will be sent to our support team. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          style: 'destructive',
          onPress: async () => {
            const supportEmail = 'support@dropoffcouriers.com';
            const subject = encodeURIComponent('Vendor Account Deletion Request');
            const body = encodeURIComponent(
              `Hello Support Team,\n\nI would like to request the permanent deletion of my vendor account.\n\nVendor Details:\nName: ${user?.name || 'N/A'}\nEmail: ${user?.email || 'N/A'}\nPhone: ${user?.phone || 'N/A'}\n\nThank you.`
            );

            const mailtoUrl = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

            try {
              const canOpen = await Linking.canOpenURL(mailtoUrl);
              if (canOpen) {
                await Linking.openURL(mailtoUrl);
              } else {
                Alert.alert(
                  'Error',
                  'Unable to open your email client. Please email support@dropoffcouriers.com directly.'
                );
              }
            } catch (error) {
              Alert.alert('Error', 'Could not open the mail application.');
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
      {/* Vendor Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.vendorName}>{user?.name || 'Vendor Partner'}</Text>
        </View>
        <TouchableOpacity style={styles.profileBadge} onPress={() => navigation.navigate('Profile')}>
          <MaterialCommunityIcons name="account-circle" size={38} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats Overview */}
      <Text style={styles.sectionTitle}>Overview</Text>
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="package-variant" size={24} color={COLORS.primary} />
            <Text style={styles.statNumber}>{stats.totalProducts || 0}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={24} color="#3b82f6" />
            <Text style={styles.statNumber}>{stats.totalOrders || 0}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="tag-multiple-outline" size={24} color="#eab308" />
            <Text style={styles.statNumber}>{stats.pendingOffers || 0}</Text>
            <Text style={styles.statLabel}>Pending Offers</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="cash-multiple" size={24} color="#22c55e" />
            <Text style={styles.statNumber}>${stats.totalSales || 0}</Text>
            <Text style={styles.statLabel}>Total Sales</Text>
          </View>
        </View>
      )}

      {/* Quick Actions & Management */}
      <Text style={styles.sectionTitle}>Management & Actions</Text>
      <View style={styles.actionsList}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('VendorProducts')}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#eff6ff' }]}>
            <MaterialCommunityIcons name="cube-outline" size={22} color="#3b82f6" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Manage Products</Text>
            <Text style={styles.actionSub}>Add, update or remove store items</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('VendorOffers')}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#fefce8' }]}>
            <MaterialCommunityIcons name="tag-outline" size={22} color="#eab308" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Customer Price Offers</Text>
            <Text style={styles.actionSub}>Review pending negotiation requests</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('VendorOrders')}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#f0fdf4' }]}>
            <MaterialCommunityIcons name="truck-delivery-outline" size={22} color="#22c55e" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Orders & Deliveries</Text>
            <Text style={styles.actionSub}>Track & process customer orders</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleOpenWebPayments}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#fdf4ff' }]}>
            <MaterialCommunityIcons name="open-in-new" size={22} color="#c084fc" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Payments & Web Portal</Text>
            <Text style={styles.actionSub}>Manage store billing and payouts on dropstore.click</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#94a3b8" />
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
          <Text style={styles.deleteBtnText}>Request Account Deletion</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  welcomeText: { fontSize: 14, color: '#64748b' },
  vendorName: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  profileBadge: { padding: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
    marginTop: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'flex-start',
  },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  actionsList: { gap: 10, marginBottom: 20 },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justify: 'center',
    marginRight: 12,
  },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  actionSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  accountOptions: { gap: 12, marginTop: 4 },
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

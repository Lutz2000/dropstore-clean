import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as SecureStore from 'expo-secure-store';
import client, { TOKEN_KEY } from '../../api/client';
import { clearAllCache } from '../../api/cache';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    await clearAllCache();
    await logout();
  };

  // Immediate In-App Buyer Account Deletion (Apple Guideline 5.1.1(v) Compliant)
  const handleDeleteBuyerAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? All your personal preferences, order history, and saved data will be removed. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              // 1. Call backend endpoint for buyer account deletion
              const res = await client.delete('/user/account');

              if (res.status === 200 || res.status === 204) {
                // 2. Clear secure auth token and local app cache
                await SecureStore.deleteItemAsync(TOKEN_KEY);
                await clearAllCache();

                Alert.alert(
                  'Account Deleted',
                  'Your account has been permanently deleted.',
                  [
                    {
                      text: 'OK',
                      onPress: async () => {
                        await logout();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Error', res.data?.message || 'Failed to delete account.');
              }
            } catch (error) {
              Alert.alert(
                'Error',
                error.response?.data?.message ||
                  'Unable to complete account deletion at this time. Please try again later.'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Header Profile Section */}
      <View style={styles.profileHeader}>
        <MaterialCommunityIcons
          name="account-circle-outline"
          size={72}
          color={COLORS.primary || '#eab308'}
        />
        <Text style={styles.userName}>{user?.name || 'Customer'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      {/* Account Settings / Navigation Links */}
      <Text style={styles.sectionTitle}>Account Settings</Text>
      <View style={styles.actionsList}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <MaterialCommunityIcons name="account-edit-outline" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>Edit Profile</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('Orders')}
        >
          <MaterialCommunityIcons name="shopping-outline" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>My Orders</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('Notifications')}
        >
          <MaterialCommunityIcons name="bell-outline" size={20} color="#eab308" style={styles.actionIcon} />
          <Text style={styles.actionTitle}>Notifications</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
        </TouchableOpacity>
      </View>

      {/* Account Actions (Sign Out & Delete Account) */}
      <Text style={styles.sectionTitle}>Account Options</Text>
      <View style={styles.accountOptions}>
        {loading ? (
          <ActivityIndicator size="small" color="#ef4444" style={{ marginVertical: 10 }} />
        ) : (
          <>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <MaterialCommunityIcons name="logout" size={18} color="#ef4444" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteBuyerAccount}>
              <MaterialCommunityIcons name="delete-outline" size={18} color="#ef4444" />
              <Text style={styles.deleteBtnText}>Delete Account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { padding: 16, paddingBottom: 40 },
  profileHeader: {
    alignItems: 'center',
    marginVertical: 20,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 8,
  },
  userEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    marginTop: 12,
  },
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

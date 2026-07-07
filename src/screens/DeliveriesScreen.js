import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const STATUS_COLOR = {
  pending  : '#f59e0b',
  confirmed: '#3b82f6',
  picked_up: '#8b5cf6',
  enroute  : '#f97316',
  delivered: '#22c55e',
  cancelled: '#ef4444',
};

export default function DeliveriesScreen({ navigation }) {
  const { user }          = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isVendor = user?.role === 'vendor';

  const load = useCallback(async () => {
    try {
      const endpoint = isVendor ? '/deliveries/vendor' : '/deliveries/buyer';
      const res = await client.get(endpoint);
      setItems(res.data.data || res.data);
    } catch (e) {
    } finally { setLoading(false); }
  }, [isVendor]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const updateStatus = async (id, status) => {
    try {
      await client.patch(`/deliveries/${id}/status`, { status });
      load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update status.');
    }
  };

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={<Text style={styles.empty}>No deliveries yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>Order #{item.id}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] || '#888' }]}>
                <Text style={styles.badgeText}>{item.status?.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.product}>{item.product?.name || 'Product'}</Text>
            {item.delivery_address && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.primary} /><Text style={styles.addr}>{item.delivery_address}</Text></View>}
            {item.delivery_contact && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><MaterialCommunityIcons name="phone" size={14} color={COLORS.primary} /><Text style={styles.addr}>{item.delivery_contact}</Text></View>}
            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>

            {/* Vendor action buttons */}
            {isVendor && (
              <View style={styles.vendorActions}>
                {item.status === 'pending'   && <ActionBtn label="Confirm"   onPress={() => updateStatus(item.id, 'confirmed')} color={COLORS.primary} />}
                {item.status === 'confirmed' && <ActionBtn label="Picked Up" onPress={() => updateStatus(item.id, 'picked_up')} color="#8b5cf6" />}
                {item.status === 'picked_up' && <ActionBtn label="En Route"  onPress={() => updateStatus(item.id, 'enroute')}   color="#f97316" />}
                {item.status === 'enroute'   && <ActionBtn label="Delivered" onPress={() => updateStatus(item.id, 'delivered')} color="#22c55e" />}
                {(item.status === 'pending' || item.status === 'confirmed') &&
                  <ActionBtn label="Cancel" onPress={() => updateStatus(item.id, 'cancelled')} color="#ef4444" outline />}
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

function ActionBtn({ label, onPress, color, outline }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, outline ? { borderWidth: 1, borderColor: color } : { backgroundColor: color }]}
      onPress={onPress}
    >
      <Text style={[styles.actionBtnText, outline && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: '#f9f9f9' },
  card        : { backgroundColor: '#fff', borderRadius: 12, padding: 14, elevation: 2 },
  cardHeader  : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderId     : { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  badge       : { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText   : { color: '#fff', fontSize: 11, fontWeight: '700' },
  product     : { fontSize: 14, color: '#333', marginBottom: 4 },
  addr        : { fontSize: 12, color: '#666', marginBottom: 2 },
  date        : { fontSize: 11, color: '#aaa', marginTop: 4 },
  vendorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtn   : { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty       : { textAlign: 'center', color: '#aaa', marginTop: 60, fontSize: 16 },
});

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native';
// Import TouchableOpacity from gesture-handler to fix iPad touch unresponsiveness
import { TouchableOpacity } from 'react-native-gesture-handler';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client, { BASE_URL } from '../api/client';
import { COLORS } from '../constants/theme';

const STATUS_COLOR = {
  open:      '#3b82f6',
  countered: '#f59e0b',
  accepted:  '#16a34a',
  declined:  '#ef4444',
};

const STATUS_LABEL = {
  open:      'Open',
  countered: 'Counter Received',
  accepted:  'Accepted',
  declined:  'Declined',
};

export default function BuyerOffersScreen({ navigation }) {
  const [threads, setThreads]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/offers');
      setThreads(res.data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;

  const renderItem = ({ item }) => {
    const imgUri    = item.product?.primary_image ?? `${BASE_URL}/images/placeholder.png`;
    const unread    = item.unread_for_me ?? 0;
    const latest    = item.latest_message;
    const statusClr = STATUS_COLOR[item.status] || '#888';
    const statusLbl = STATUS_LABEL[item.status] || item.status;

    return (
      <TouchableOpacity
        style={[styles.card, unread > 0 && styles.cardUnread]}
        onPress={() => navigation.navigate('OfferChat', { threadId: item.id, productName: item.product?.name })}
      >
        <Image source={{ uri: imgUri }} style={styles.thumb} resizeMode="cover" />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.productName} numberOfLines={1}>{item.product?.name}</Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread}</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="store" size={14} color={COLORS.primary} />
            <Text style={styles.vendorName}>{item.vendor?.name || 'Vendor'}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Listed: </Text>
            <Text style={styles.priceVal}>UGX {Number(item.product_price).toLocaleString()}</Text>
            <Text style={styles.priceLabel}>  My Offer: </Text>
            <Text style={[styles.priceVal, { color: '#1e40af' }]}>
              UGX {Number(item.offered_price).toLocaleString()}
            </Text>
          </View>

          <View style={styles.cardBottom}>
            <View style={[styles.statusPill, { backgroundColor: statusClr }]}>
              <Text style={styles.statusText}>{statusLbl}</Text>
            </View>
            {item.status === 'accepted' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={styles.acceptHint}>Tap to add to cart</Text><MaterialCommunityIcons name="arrow-right" size={14} color={COLORS.primary} /></View>
            )}
          </View>

          {latest && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons
                name={latest.sender_id === item.vendor_id ? 'store' : 'account'}
                size={14}
                color="#64748b"
              />
              <Text style={styles.lastMsg} numberOfLines={1}>
                {latest.message}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={threads}
        keyExtractor={i => String(i.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 24 }}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="message-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No price offers yet.</Text>
            <Text style={styles.emptySub}>
              Browse products and tap "Make an Offer" to negotiate a price directly with the vendor.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: '#f9f9f9' },

  // Added width: '100%' to enforce proper card scaling boundaries on wide tablet viewports
  card        : { backgroundColor: '#fff', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 12, elevation: 2, width: '100%' },
  cardUnread  : { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  thumb       : { width: 62, height: 62, borderRadius: 8, backgroundColor: '#f0f0f0' },
  cardBody    : { flex: 1 },
  cardTop     : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  productName : { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 6 },
  unreadBadge : { backgroundColor: COLORS.primary, borderRadius: 10, minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center' },
  unreadText  : { color: '#fff', fontSize: 11, fontWeight: '800' },
  vendorName  : { fontSize: 12, color: '#555', marginBottom: 4 },
  priceRow    : { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  priceLabel  : { fontSize: 11, color: '#888' },
  priceVal    : { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  cardBottom  : { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  statusPill  : { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusText  : { color: '#fff', fontSize: 10, fontWeight: '700' },
  acceptHint  : { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  lastMsg     : { fontSize: 12, color: '#888', fontStyle: 'italic' },

  empty       : { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyIcon   : { fontSize: 48, marginBottom: 12 },
  emptyText   : { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub    : { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },
});

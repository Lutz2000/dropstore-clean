import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import client, { BASE_URL } from '../../api/client';
import { COLORS } from '../../constants/theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const STATUS_COLOR = {
  open:     '#3b82f6',
  countered:'#f59e0b',
  accepted: '#16a34a',
  declined: '#ef4444',
};

export default function VendorOffersScreen({ navigation }) {
  const [threads, setThreads]     = useState([]);
  const [loading, setLoading]     = useState(true);
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

    return (
      <TouchableOpacity
        style={styles.card}
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

          <View style={styles.cardMeta}>
            <Text style={styles.buyerName}>Buyer: {item.buyer?.name}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusClr }]}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Listed: </Text>
            <Text style={styles.priceVal}>UGX {Number(item.product_price).toLocaleString()}</Text>
            <Text style={styles.priceLabel}>  Offer: </Text>
            <Text style={[styles.priceVal, { color: '#1e40af' }]}>UGX {Number(item.offered_price).toLocaleString()}</Text>
          </View>

          {latest && (
            <Text style={styles.lastMsg} numberOfLines={1}>
              <MaterialCommunityIcons name={latest.sender_id === item.buyer_id ? 'account' : 'store'} size={12} color="#888" /> {latest.message}
            </Text>
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
        contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 20 }}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="chat-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No offer conversations yet.</Text>
            <Text style={styles.emptySub}>When buyers make price offers on your products, they'll appear here.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: '#f9f9f9' },

  card        : { backgroundColor: '#fff', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 12, elevation: 2 },
  thumb       : { width: 62, height: 62, borderRadius: 8, backgroundColor: '#f0f0f0' },
  cardBody    : { flex: 1 },
  cardTop     : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  productName : { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 6 },
  unreadBadge : { backgroundColor: COLORS.primary, borderRadius: 10, minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center' },
  unreadText  : { color: '#fff', fontSize: 11, fontWeight: '800' },
  cardMeta    : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  buyerName   : { fontSize: 12, color: '#555' },
  statusPill  : { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusText  : { color: '#fff', fontSize: 10, fontWeight: '700' },
  priceRow    : { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  priceLabel  : { fontSize: 11, color: '#888' },
  priceVal    : { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  lastMsg     : { fontSize: 12, color: '#888', fontStyle: 'italic' },

  empty       : { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyIcon   : { fontSize: 48, marginBottom: 12 },
  emptyText   : { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub    : { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },
});

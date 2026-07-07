import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client from '../../api/client';
import { COLORS } from '../../constants/theme';

export default function VendorNotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/vendor/notifications');
      setNotifications(res.data.data || res.data);
    } catch (e) {
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markRead = async (n) => {
    if (n.is_read) return;
    try { await client.put(`/vendor/notifications/${n.id}/read`); }
    catch (_) {}
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
  };

  const markAllRead = async () => {
    try { await client.put('/vendor/notifications/read-all'); }
    catch (_) {}
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
  };

  const unread = notifications.filter(n => !n.is_read).length;

  const formatTime = (ts) => {
    if (!ts) return '';
    const d   = new Date(ts);
    const now = new Date();
    const min = Math.floor((now - d) / 60000);
    if (min < 1)  return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return d.toLocaleDateString();
  };

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      {unread > 0 && (
        <View style={styles.toolbar}>
          <Text style={styles.toolbarText}>{unread} unread</Text>
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}><MaterialCommunityIcons name="check" size={14} color={COLORS.primary} /><Text style={styles.markAllText}>Mark all read</Text></View>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={i => String(i.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="bell-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>You'll see alerts here when buyers add or remove your products from their carts.</Text>
          </View>
        }
        renderItem={({ item: n }) => (
          <TouchableOpacity
            style={[styles.card, !n.is_read && styles.cardUnread]}
            onPress={() => markRead(n)}
            activeOpacity={0.8}
          >
            <View style={[styles.dot, n.type === 'cart_add' ? styles.dotAdd : styles.dotRemove]}>
              <MaterialCommunityIcons name={n.type === 'cart_add' ? 'cart-outline' : 'trash-can-outline'} size={16} color="#fff" />
            </View>
            <View style={styles.body}>
              <Text style={styles.itemTitle}>{n.title}</Text>
              <Text style={styles.itemBody}>{n.body}</Text>
              {n.buyer_phone ? (
                <TouchableOpacity
                  style={styles.phoneRow}
                  onPress={() => Linking.openURL(`tel:${n.buyer_phone.replace(/\s/g,'')}`)}
                >
                  <MaterialCommunityIcons name="phone" size={14} color={COLORS.primary} />
                  <Text style={styles.phoneText}>{n.buyer_phone}</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.time}>{formatTime(n.created_at)}</Text>
            </View>
            {!n.is_read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container  : { flex: 1, backgroundColor: '#f9f9f9' },
  toolbar    : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' },
  toolbarText: { fontSize: 13, color: '#555', fontWeight: '600' },
  markAllBtn : { backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  markAllText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  emptyWrap  : { alignItems: 'center', marginTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyIcon  : { fontSize: 48 },
  emptyTitle : { fontSize: 16, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  emptySub   : { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
  card       : { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, elevation: 1, gap: 12, position: 'relative' },
  cardUnread : { backgroundColor: '#fffbf0', borderWidth: 1, borderColor: '#fed7aa' },
  dot        : { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dotAdd     : { backgroundColor: '#f0fdf4' },
  dotRemove  : { backgroundColor: '#fef2f2' },
  body       : { flex: 1 },
  itemTitle  : { fontSize: 13.5, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  itemBody   : { fontSize: 12.5, color: '#475569', lineHeight: 18, marginBottom: 6 },
  phoneRow   : { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  phoneText  : { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  time       : { fontSize: 11, color: '#94a3b8' },
  unreadDot  : { position: 'absolute', top: 12, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.primary },
});

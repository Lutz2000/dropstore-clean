import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, TextInput,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client, { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES } from '../constants/theme';

// ─── Vendor contact card (for buyer's vendor list) ────────────────────────────
function VendorCard({ item, onPress }) {
  const logo = item.business_logo
    ? `${BASE_URL}/storage/${item.business_logo}`
    : `${BASE_URL}/images/vendor-placeholder.png`;

  const priceRange = item.min_price != null
    ? `UGX ${Number(item.min_price).toLocaleString()} – ${Number(item.max_price).toLocaleString()}`
    : 'No products listed';

  return (
    <TouchableOpacity style={styles.contactCard} onPress={onPress}>
      <Image source={{ uri: logo }} style={styles.avatar} resizeMode="cover" />
      <View style={styles.contactBody}>
        <View style={styles.contactTop}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.business_name || item.name}
          </Text>
          {item.is_verified && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialCommunityIcons name="check-circle" size={12} color={COLORS.primary} />
              <Text style={styles.verifiedBadge}>Verified</Text>
            </View>
          )}
        </View>
        <Text style={styles.contactSub} numberOfLines={1}>
          {item.categories?.join(' · ') || 'General'}
        </Text>
        <Text style={styles.contactSub}>{priceRange}</Text>
      </View>
      <Text style={styles.chatArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Buyer contact card (for vendor's buyer list) ─────────────────────────────
function BuyerCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.contactCard} onPress={onPress}>
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Text style={styles.avatarInitial}>{(item.name || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.contactBody}>
        <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
        {!!item.phone    && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <MaterialCommunityIcons name="phone-outline" size={12} color={COLORS.primary} />
            <Text style={styles.contactSub}>{item.phone}</Text>
          </View>
        )}
        {!!item.country  && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <MaterialCommunityIcons name="earth" size={12} color={COLORS.primary} />
            <Text style={styles.contactSub}>{item.country}</Text>
          </View>
        )}
        {!!item.location && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <MaterialCommunityIcons name="map-marker-outline" size={12} color={COLORS.primary} />
            <Text style={styles.contactSub}>{item.location}</Text>
          </View>
        )}
      </View>
      <Text style={styles.chatArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Active thread row ────────────────────────────────────────────────────────
function ThreadRow({ item, role, onPress }) {
  const other  = item.other_user || {};
  const unread = item.unread || 0;
  const latest = item.last_message?.body || (item.last_message?.image_path ? '�️ Image' : '');
  const time   = item.last_message_at
    ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const logo = role === 'buyer' && other.business_logo
    ? `${BASE_URL}/storage/${other.business_logo}`
    : null;

  return (
    <TouchableOpacity
      style={[styles.threadRow, unread > 0 && styles.threadUnread]}
      onPress={onPress}
    >
      {logo ? (
        <Image source={{ uri: logo }} style={styles.avatar} resizeMode="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{(other.name || '?')[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.contactBody}>
        <View style={styles.contactTop}>
          <Text style={[styles.contactName, unread > 0 && styles.bold]} numberOfLines={1}>
            {role === 'buyer'
              ? (other.business_name || other.name)
              : other.name}
          </Text>
          <Text style={styles.timeText}>{time}</Text>
        </View>
        <Text style={[styles.contactSub, unread > 0 && styles.bold]} numberOfLines={1}>
          {latest || 'No messages yet'}
        </Text>
      </View>
      {unread > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const isVendor = user?.role === 'vendor';

  const [tab, setTab]           = useState('chats');   // 'chats' | 'contacts'
  const [threads, setThreads]   = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loadingThreads,  setLoadingThreads]  = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]     = useState('');

  // Contacts tab: vendor sees buyers only if verified
  const canSeeContacts = !isVendor || user?.is_verified;

  const loadThreads = useCallback(async () => {
    try {
      const res = await client.get('/chat/threads');
      setThreads(res.data);
    } catch (_) {}
    finally { setLoadingThreads(false); }
  }, []);

  const loadContacts = useCallback(async () => {
    if (!canSeeContacts) return;
    setLoadingContacts(true);
    try {
      const endpoint = isVendor ? '/chat/buyers' : '/chat/vendors';
      const res = await client.get(endpoint);
      setContacts(res.data);
    } catch (_) {}
    finally { setLoadingContacts(false); }
  }, [isVendor, canSeeContacts]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      loadThreads();
      if (tab === 'contacts') loadContacts();
    });
    return unsub;
  }, [navigation, loadThreads, loadContacts, tab]);

  useEffect(() => {
    if (tab === 'contacts' && contacts.length === 0) loadContacts();
  }, [tab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadThreads();
    if (tab === 'contacts') await loadContacts();
    setRefreshing(false);
  };

  // Navigate to chat — always start/get thread first
  const openVendorChat = async (vendorId, vendorName) => {
    try {
      const res = await client.post('/chat/threads', { vendor_id: vendorId });
      navigation.navigate('Chat', { threadId: res.data.id, otherName: vendorName });
    } catch (e) {
      alert(e?.response?.data?.message || 'Could not open chat.');
    }
  };

  const openBuyerChat = async (buyerId, buyerName) => {
    try {
      const res = await client.post('/chat/threads', { buyer_id: buyerId });
      navigation.navigate('Chat', { threadId: res.data.id, otherName: buyerName });
    } catch (e) {
      alert(e?.response?.data?.message || 'Could not open chat.');
    }
  };

  // Filter helpers
  const filteredThreads = threads.filter(t => {
    const name = isVendor
      ? (t.other_user?.name || '')
      : (t.other_user?.business_name || t.other_user?.name || '');
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredContacts = contacts.filter(c => {
    const name = isVendor
      ? (c.name || '')
      : (c.business_name || c.name || '');
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <View style={styles.container}>

      {/* Tab bar */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'chats' && styles.tabActive]}
          onPress={() => setTab('chats')}
        >
          <Text style={[styles.tabText, tab === 'chats' && styles.tabTextActive]}>
            Chats {threads.length > 0 ? `(${threads.length})` : ''}
          </Text>
        </TouchableOpacity>

        {canSeeContacts && (
          <TouchableOpacity
            style={[styles.tab, tab === 'contacts' && styles.tabActive]}
            onPress={() => setTab('contacts')}
          >
            <Text style={[styles.tabText, tab === 'contacts' && styles.tabTextActive]}>
              {isVendor ? 'Buyers' : 'Vendors'}
            </Text>
          </TouchableOpacity>
        )}

        {isVendor && !canSeeContacts && (
          <View style={[styles.tab, { opacity: 0.5 }]}>
            <Text style={styles.tabText}>Buyers (Verified only)</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${tab === 'chats' ? 'conversations' : (isVendor ? 'buyers' : 'vendors')}…`}
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Chats tab */}
      {tab === 'chats' && (
        loadingThreads
          ? <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />
          : <FlatList
              data={filteredThreads}
              keyExtractor={i => String(i.id)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
              renderItem={({ item }) => (
                <ThreadRow
                  item={item}
                  role={user?.role}
                  onPress={() => {
                    const other = item.other_user || {};
                    const name  = isVendor ? other.name : (other.business_name || other.name);
                    navigation.navigate('Chat', { threadId: item.id, otherName: name });
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <MaterialCommunityIcons name="message-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyTitle}>No conversations yet</Text>
                  <Text style={styles.emptySub}>
                    {isVendor
                      ? 'Buyers will message you when they are interested in your products.'
                      : 'Go to the Vendors tab and start a conversation.'}
                  </Text>
                </View>
              }
            />
      )}

      {/* Contacts tab */}
      {tab === 'contacts' && (
        loadingContacts
          ? <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />
          : <FlatList
              data={filteredContacts}
              keyExtractor={i => String(i.id)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
              renderItem={({ item }) =>
                isVendor
                  ? <BuyerCard item={item} onPress={() => openBuyerChat(item.id, item.name)} />
                  : <VendorCard item={item} onPress={() => openVendorChat(item.id, item.business_name || item.name)} />
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <MaterialCommunityIcons name="magnify" size={48} color="#ccc" />
                  <Text style={styles.emptyTitle}>No contacts found</Text>
                </View>
              }
            />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container    : { flex: 1, backgroundColor: '#fff' },

  // Tabs
  tabs         : { flexDirection: 'row', borderBottomWidth: 1, borderColor: COLORS.border },
  tab          : { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive    : { borderBottomWidth: 3, borderColor: COLORS.primary },
  tabText      : { fontSize: SIZES.sm, color: '#888', fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },

  // Search
  searchWrap   : { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderColor: COLORS.border },
  searchInput  : { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, fontSize: SIZES.md, color: '#111' },

  // Contact / vendor card
  contactCard  : { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  avatar       : { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eee' },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary },
  avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 18 },
  contactBody  : { flex: 1, marginHorizontal: 12 },
  contactTop   : { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactName  : { fontSize: SIZES.md, fontWeight: '600', color: '#111', flex: 1 },
  contactSub   : { fontSize: SIZES.xs, color: '#777', marginTop: 2 },
  verifiedBadge: { fontSize: 10, color: '#16a34a', fontWeight: '700', backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  chatArrow    : { fontSize: 22, color: '#ccc' },

  // Thread row
  threadRow    : { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  threadUnread : { backgroundColor: '#fff8ee' },
  timeText     : { fontSize: SIZES.xs, color: '#aaa', flexShrink: 0 },
  bold         : { fontWeight: '700', color: '#111' },

  // Unread badge
  unreadBadge  : { backgroundColor: COLORS.primary, borderRadius: 12, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, marginLeft: 8 },
  unreadText   : { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Empty
  empty        : { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon    : { fontSize: 48, marginBottom: 16 },
  emptyTitle   : { fontSize: SIZES.lg, fontWeight: '700', color: '#111', marginBottom: 8 },
  emptySub     : { fontSize: SIZES.md, color: '#888', textAlign: 'center', lineHeight: 22 },
});

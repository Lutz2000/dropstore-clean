import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image,
  TextInput, ActivityIndicator, RefreshControl, ScrollView, Modal,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client, { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function CategoryPill({ item, selected, onPress }) {
  return (
    <TouchableOpacity style={[styles.pill, selected && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillText, selected && styles.pillTextActive]}>{item.name}</Text>
    </TouchableOpacity>
  );
}

function ProductCard({ item, navigation }) {
  const imgUri = item.primary_image || `${BASE_URL}/images/placeholder.png`;
  const img = { uri: imgUri };
  const price = item.discount_price ?? item.price;
  return (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ProductDetail', { id: item.id })}>
      <View>
        <Image source={img} style={[styles.cardImg, item.is_sold_out && { opacity: 0.55 }]} resizeMode="cover" />
        {item.is_sold_out ? (
          <View style={styles.soldBadge}><Text style={styles.soldBadgeText}>SOLD</Text></View>
        ) : item.discount_percent > 0 ? (
          <View style={styles.badge}><Text style={styles.badgeText}>-{item.discount_percent}%</Text></View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.cardPrice}>UGX {Number(price).toLocaleString()}</Text>
        {item.discount_price && (
          <Text style={styles.cardOriginal}>UGX {Number(item.price).toLocaleString()}</Text>
        )}
        <View style={styles.vendorRow}>
          <Text style={styles.cardVendor} numberOfLines={1}>{item.vendor?.name || ''}</Text>
          {item.vendor?.is_verified && (
            <View style={styles.verifiedBadge}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><MaterialCommunityIcons name="medal" size={12} color="#f59e0b" /><Text style={styles.verifiedText}>Verified</Text></View>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [products, setProducts]     = useState([]);
  const [catId, setCatId]           = useState(null);
  const [search, setSearch]         = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage]             = useState(1);
  const [lastPage, setLastPage]     = useState(1);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [trending, setTrending] = useState([]);
  const [bcastQueue, setBcastQueue] = useState([]);
  const [bcastIdx,   setBcastIdx]   = useState(0);
  const [bcastOpen,  setBcastOpen]  = useState(false);
  const inputRef = useRef(null);

  const fetchCategories = async () => {
    try {
      const res = await client.get('/categories');
      setCategories([{ id: null, name: 'All' }, ...(res.data.data || res.data)]);
    } catch (_) {}
  };

  const fetchProducts = useCallback(async ({ reset = false, currentPage, currentCatId, currentSearch } = {}) => {
    setLoading(true);
    try {
      const p = reset ? 1 : currentPage;
      const res = await client.get('/products', {
        params: { category_id: currentCatId, search: currentSearch, page: p, per_page: 20 },
      });
      const data = res.data.data || [];
      setProducts(prev => reset ? data : [...prev, ...data]);
      setPage(p + 1);
      setLastPage(res.data.last_page || 1);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  const fetchRecommendations = async () => {
    try {
      const res = await client.get('/recommendations');
      setRecommendations(res.data.recommended || []);
      setTrending(res.data.trending || []);
    } catch (e) {
      console.warn('[DropStore] Recommendations error:', e?.response?.status, e?.message);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchRecommendations();
    const unsubscribe = navigation.addListener('focus', () => {
      if (!user) return;
      loadBroadcastMessages();
    });
    return unsubscribe;
  }, [navigation, user]);

  const loadBroadcastMessages = async () => {
    if (!user) return;
    try {
      const res     = await client.get('/broadcast-messages');
      const msgs    = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const seenKey = `ds_seen_msgs_${user.id}`;
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
  };

  const dismissBcast = async () => {
    const msg     = bcastQueue[bcastIdx];
    const seenKey = `ds_seen_msgs_${user?.id || 'guest'}`;
    if (msg && user) {
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

  // Fetch when category or submittedSearch changes
  useEffect(() => {
    setPage(1);
    setProducts([]);
    fetchProducts({ reset: true, currentPage: 1, currentCatId: catId, currentSearch: submittedSearch });
  }, [catId, submittedSearch]);

  // ── SIMPLE SEARCH ──
  const doSearch = () => {
    setSubmittedSearch(search);
  };

  const doClear = () => {
    setSearch('');
    setSubmittedSearch('');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    setProducts([]);
    await fetchProducts({ reset: true, currentPage: 1, currentCatId: catId, currentSearch: submittedSearch });
    fetchRecommendations();
    setRefreshing(false);
  };

  const showHeader = !catId && !submittedSearch;

  const renderRecommendationRow = ({ item }) => {
    const subcategory = item.subcategory;
    const products = item.products || [];
    return (
      <View style={styles.recSection}>
        <View style={styles.recHeader}>
          <View style={styles.recTitleRow}>
            <View style={styles.recTitleDot} />
            <Text style={styles.recTitle}>{subcategory?.name || 'Category'}</Text>
          </View>
          <TouchableOpacity onPress={() => null}>
            <Text style={styles.recSeeAll}>See all <MaterialCommunityIcons name="chevron-right" size={14} /></Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recScroll}>
          {products.slice(0, 8).map((product, i) => (
            <TouchableOpacity key={i} style={styles.recCard} onPress={() => navigation.navigate('ProductDetail', { id: product.id })}>
              <View style={styles.recImgWrap}>
                <Image source={{ uri: product.primary_image || `${BASE_URL}/images/placeholder.png` }} style={styles.recImg} />
                {product.is_sold_out ? (
                  <View style={styles.recSoldBadge}><Text style={styles.recSoldText}>SOLD</Text></View>
                ) : product.discount_percent > 0 ? (
                  <View style={styles.recBadge}><Text style={styles.recBadgeText}>-{product.discount_percent}%</Text></View>
                ) : null}
              </View>
              <View style={styles.recCardBody}>
                <Text style={styles.recCardName} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.recCardPrice}>UGX {Number(product.final_price || product.price).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderTrendingItem = ({ item }) => {
    return (
      <TouchableOpacity style={styles.trendCard} onPress={() => navigation.navigate('ProductDetail', { id: item.id })}>
        <View>
          <Image source={{ uri: item.primary_image || `${BASE_URL}/images/placeholder.png` }} style={styles.trendImg} />
          {item.is_sold_out ? (
            <View style={styles.trendSoldBadge}><Text style={styles.trendSoldText}>SOLD</Text></View>
          ) : item.discount_percent > 0 ? (
            <View style={styles.trendBadge}><Text style={styles.trendBadgeText}>-{item.discount_percent}%</Text></View>
          ) : null}
        </View>
        <View style={styles.trendCardBody}>
          <Text style={styles.trendCardName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.trendCardPrice}>UGX {Number(item.final_price || item.price).toLocaleString()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const loadMore = () => {
    if (page <= lastPage && !loading) {
      fetchProducts({ reset: false, currentPage: page, currentCatId: catId, currentSearch: submittedSearch });
    }
  };

  return (
    <View style={styles.container}>
      {/* ─── SIMPLE SEARCH BAR ─── */}
      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <TextInput
            ref={inputRef}
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search products..."
            placeholderTextColor="#aaa"
            returnKeyType="search"
            onSubmitEditing={doSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={doClear} style={styles.clearBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={18} color="#999" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={doSearch} style={styles.searchBtn} activeOpacity={0.7}>
            <MaterialCommunityIcons name="magnify" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── CATEGORY PILLS ─── */}
      <View style={styles.catsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cats} contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingVertical: 12 }}>
          {categories.map(c => (
            <CategoryPill key={String(c.id)} item={c} selected={catId === c.id} onPress={() => setCatId(c.id)} />
          ))}
        </ScrollView>
      </View>

      {/* ─── PRODUCTS ─── */}
      <FlatList
        data={products}
        keyExtractor={i => String(i.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 10 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 20 }}
        renderItem={({ item }) => <ProductCard item={item} navigation={navigation} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListFooterComponent={() => loading ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={() => !loading ? <Text style={styles.empty}>No products found.</Text> : null}
        ListHeaderComponent={
          showHeader ? (
            <View>
              {recommendations.length > 0 && (
                <View>
                  <View style={styles.recSectionTitle}>
                    <MaterialCommunityIcons name="star-four" size={18} color={COLORS.primary} />
                    <Text style={styles.recSectionTitleText}>Recommended for You</Text>
                  </View>
                  {recommendations.slice(0, 3).map((rec, idx) => (
                    <View key={idx}>{renderRecommendationRow({ item: rec })}</View>
                  ))}
                </View>
              )}
              {trending.length > 0 && (
                <View style={styles.trendsSection}>
                  <View style={styles.recSectionTitle}>
                    <MaterialCommunityIcons name="fire" size={18} color="#ef4444" />
                    <Text style={[styles.recSectionTitleText, { color: '#ef4444' }]}>Trends</Text>
                  </View>
                  <View style={styles.trendsGrid}>
                    {trending.slice(0, 12).map((item, idx) => (
                      <View key={idx}>{renderTrendingItem({ item })}</View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : null
        }
      />

      {/* ─── BROADCAST MODAL ─── */}
      <Modal visible={bcastOpen} transparent animationType="fade" onRequestClose={dismissBcast}>
        <View style={styles.bcastOverlay}>
          <View style={styles.bcastCard}>
            <View style={styles.bcastHeader}>
              <View style={styles.bcastIconWrap}>
                <MaterialCommunityIcons name="bell-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.bcastTitleBlock}>
                <Text style={styles.bcastFrom}>Message from DropStore</Text>
                <Text style={styles.bcastTitle} numberOfLines={2}>
                  {bcastQueue[bcastIdx]?.title}
                </Text>
              </View>
            </View>
            <View style={styles.bcastBody}>
              <Text style={styles.bcastContent}>{bcastQueue[bcastIdx]?.content}</Text>
              {bcastQueue[bcastIdx]?.created_at && (
                <Text style={styles.bcastDate}>
                  {new Date(bcastQueue[bcastIdx].created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              )}
            </View>
            <View style={styles.bcastFooter}>
              {bcastQueue.length > 1 && (
                <Text style={styles.bcastCounter}>{bcastIdx + 1} / {bcastQueue.length}</Text>
              )}
              <TouchableOpacity style={styles.bcastBtn} onPress={dismissBcast}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}><MaterialCommunityIcons name="check" size={16} color="#fff" /><Text style={styles.bcastBtnText}>Got it</Text></View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container    : { flex: 1, backgroundColor: '#f2f4f8' },
  searchWrap   : { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f2f8', elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  searchRow    : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f6f7fb', borderRadius: 14, paddingHorizontal: 14, gap: 4, borderWidth: 1.5, borderColor: '#e8eaf2' },
  search       : { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1a1a1a' },
  searchBtn    : { padding: 8 },
  clearBtn     : { padding: 6, marginRight: 2 },
  catsContainer: { backgroundColor: '#fff', borderBottomWidth: 1.5, borderBottomColor: '#e8eaf2', elevation: 2 },
  cats         : { backgroundColor: '#fff' },
  pill         : { borderWidth: 2, borderColor: '#d1d5db', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 18, backgroundColor: '#f9fafb', minHeight: 44 },
  pillActive   : { backgroundColor: COLORS.primary, borderColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
  pillText     : { fontSize: 14, color: '#374151', fontWeight: '600' },
  pillTextActive: { color: '#fff', fontWeight: '800' },
  card         : { flex: 1, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: '#0f172a', shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  cardImg      : { width: '100%', aspectRatio: 0.85 },
  badge        : { position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText    : { color: '#fff', fontSize: 10, fontWeight: '800' },
  soldBadge    : { position: 'absolute', top: 8, left: 8, backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  soldBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  cardBody     : { padding: 11 },
  cardName     : { fontSize: 13, fontWeight: '600', color: '#1a1a1a', lineHeight: 19 },
  cardPrice    : { fontSize: 15, fontWeight: '800', color: COLORS.primary, marginTop: 5 },
  cardOriginal : { fontSize: 11, color: '#bbb', textDecorationLine: 'line-through' },
  vendorRow    : { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5, flexWrap: 'wrap' },
  cardVendor   : { fontSize: 11, color: '#94a3b8' },
  verifiedBadge: { backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#86efac' },
  verifiedText : { fontSize: 9, color: '#16a34a', fontWeight: '800' },
  empty        : { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 15 },
  bcastOverlay  : { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  bcastCard     : { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, overflow: 'hidden', elevation: 10 },
  bcastHeader   : { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 20, paddingBottom: 0 },
  bcastIconWrap : { width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff7ed', borderWidth: 1.5, borderColor: '#fed7aa', alignItems: 'center', justifyContent: 'center' },
  bcastTitleBlock: { flex: 1 },
  bcastFrom     : { fontSize: 10, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.7 },
  bcastTitle    : { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 2, lineHeight: 22 },
  bcastBody     : { padding: 16, paddingTop: 12 },
  bcastContent  : { fontSize: 14, color: '#374151', lineHeight: 22 },
  bcastDate     : { fontSize: 11, color: '#94a3b8', marginTop: 8 },
  bcastFooter   : { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 0, justifyContent: 'flex-end', gap: 10 },
  bcastCounter  : { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginRight: 'auto' },
  bcastBtn      : { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 22 },
  bcastBtnText  : { color: '#fff', fontWeight: '700', fontSize: 14 },
  recSectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 16 },
  recSectionTitleText: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginLeft: 4 },
  recSection: { marginBottom: 20 },
  recHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 12 },
  recTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recTitleDot: { width: 4, height: 18, borderRadius: 4, backgroundColor: COLORS.primary },
  recTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  recSeeAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary, flexDirection: 'row', alignItems: 'center', gap: 2 },
  recScroll: { paddingHorizontal: 14, gap: 14 },
  recCard: { width: 160, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  recImgWrap: { position: 'relative' },
  recImg: { width: '100%', aspectRatio: 4/3 },
  recBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  recBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  recSoldBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#dc2626', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  recSoldText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  recCardBody: { padding: 8 },
  recCardName: { fontSize: 11, fontWeight: '600', color: '#1e293b', lineHeight: 15, marginBottom: 4 },
  recCardPrice: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  trendsSection: { marginTop: 8, marginBottom: 20 },
  trendsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, gap: 10 },
  trendCard: { width: (SCREEN_WIDTH - 40) / 2, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  trendImg: { width: '100%', aspectRatio: 1 },
  trendBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  trendBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  trendSoldBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#dc2626', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  trendSoldText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  trendCardBody: { padding: 8 },
  trendCardName: { fontSize: 12, fontWeight: '600', color: '#1e293b', lineHeight: 16, marginBottom: 4 },
  trendCardPrice: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
});

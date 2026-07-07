import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import client, { BASE_URL } from '../api/client';
import { COLORS } from '../constants/theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function WishlistScreen({ navigation }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/wishlist');
      setItems(res.data.data || res.data);
    } catch (e) {
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggle = async (productId) => {
    try {
      await client.post('/wishlist/toggle', { product_id: productId });
      setItems(prev => prev.filter(i => i.product_id !== productId));
    } catch (_) {}
  };

  const addToCart = async (productId) => {
    try {
      await client.post('/cart', { product_id: productId, quantity: 1 });
      Alert.alert('Added', 'Added to cart!');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed.');
    }
  };

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 10 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={<Text style={styles.empty}>Your wishlist is empty.</Text>}
        renderItem={({ item }) => {
          const p = item.product;
          if (!p) return null;
          const price = p.discount_price ?? p.price;
          // primary_image is a full URL string from the API
          const imgUri = p.primary_image || `${BASE_URL}/images/placeholder.png`;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('ProductDetail', { id: p.id })}
              activeOpacity={0.9}
            >
              <Image source={{ uri: imgUri }} style={styles.img} resizeMode="cover" />
              <TouchableOpacity style={styles.heartBtn} onPress={() => toggle(p.id)}>
                <MaterialCommunityIcons name="heart" size={20} color="#ef4444" />
              </TouchableOpacity>
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.price}>UGX {Number(price).toLocaleString()}</Text>
                <TouchableOpacity style={styles.cartBtn} onPress={() => addToCart(p.id)}>
                  <Text style={styles.cartBtnText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: '#f9f9f9' },
  card      : { flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 2 },
  img       : { width: '100%', aspectRatio: 1 },
  heartBtn  : { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 20, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  body      : { padding: 10 },
  name      : { fontSize: 13, fontWeight: '600', color: '#1a1a1a', lineHeight: 18 },
  price     : { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
  cartBtn   : { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 6, alignItems: 'center', marginTop: 8 },
  cartBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty     : { textAlign: 'center', color: '#aaa', marginTop: 60, fontSize: 16 },
});

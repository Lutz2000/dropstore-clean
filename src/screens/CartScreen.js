import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Alert, RefreshControl, Modal, Linking,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client, { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

export default function CartScreen({ navigation }) {
  const { user } = useAuth();
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveryPhone, setDeliveryPhone] = useState('+256 700 000 000');
  const [deliveryModal, setDeliveryModal] = useState({ open: false, item: null });
  const [removeModal, setRemoveModal]     = useState({ open: false, item: null, loading: false });
  const [confirmingId, setConfirmingId]   = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/cart');
      setItems(res.data.data || res.data);
    } catch (e) {
    } finally { setLoading(false); }
  }, []);

  const loadDeliveryPhone = useCallback(async () => {
    try {
      const res = await client.get('/settings');
      if (res.data?.settings?.delivery_phone) setDeliveryPhone(res.data.settings.delivery_phone);
    } catch (_) {}
  }, []);

  useEffect(() => { load(); loadDeliveryPhone(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const updateQty = async (id, qty) => {
    if (qty < 1) return;
    try {
      await client.put(`/cart/${id}`, { quantity: qty });
      setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
    } catch (_) {}
  };

  const confirmRemove = (item) => {
    setRemoveModal({ open: true, item, loading: false });
  };

  const doRemove = async () => {
    const item = removeModal.item;
    setRemoveModal(prev => ({ ...prev, loading: true }));
    try {
      await client.delete(`/cart/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
      setRemoveModal({ open: false, item: null, loading: false });
    } catch (_) {
      setRemoveModal(prev => ({ ...prev, loading: false }));
      Alert.alert('Error', 'Could not remove item. Please try again.');
    }
  };

  const openDeliveryModal = (item) => {
    setDeliveryModal({ open: true, item });
  };

  const doConfirmPurchase = async (item) => {
    setConfirmingId(item.id);
    try {
      await client.post(`/cart/${item.id}/confirm-purchase`);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'purchased' } : i));
      Alert.alert('Purchase Confirmed!', 'The vendor has been notified of your purchase.');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Could not confirm purchase. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setConfirmingId(null);
    }
  };

  const callDelivery = () => {
    const tel = deliveryPhone.replace(/\s/g, '');
    Linking.openURL(`tel:${tel}`);
  };

  const total = items.reduce((sum, i) => sum + (i.product?.discount_price ?? i.product?.price ?? 0) * i.quantity, 0);

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Your cart is empty.</Text>}
        renderItem={({ item }) => {
          const price = item.product?.discount_price ?? item.product?.price ?? 0;
          const imgUri = item.product?.primary_image || `${BASE_URL}/images/placeholder.png`;
          return (
            <View style={styles.card}>
              <Image source={{ uri: imgUri }} style={styles.img} resizeMode="cover" />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={2}>{item.product?.name}</Text>
                <Text style={styles.vendor} numberOfLines={1}>{item.product?.vendor_name || ''}</Text>
                <Text style={styles.price}>UGX {Number(price).toLocaleString()}</Text>
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity - 1)}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity + 1)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.subtotal}>Subtotal: UGX {Number(price * item.quantity).toLocaleString()}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <TouchableOpacity style={styles.deliveryBtn} onPress={() => openDeliveryModal(item)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialCommunityIcons name="truck-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.deliveryBtnText}>Ask to Deliver</Text>
                    </View>
                  </TouchableOpacity>
                  {item.status === 'active' ? (
                    <TouchableOpacity
                      style={[styles.confirmBtn, confirmingId === item.id && { opacity: 0.5 }]}
                      onPress={() => doConfirmPurchase(item)}
                      disabled={confirmingId === item.id}
                    >
                      {confirmingId === item.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}><MaterialCommunityIcons name="check" size={16} color="#fff" /><Text style={styles.confirmBtnText}>Confirm</Text></View>
                      }
                    </TouchableOpacity>
                  ) : item.status === 'purchased' ? (
                    <View style={styles.purchasedBadge}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MaterialCommunityIcons name="check" size={12} color={COLORS.primary} /><Text style={styles.purchasedBadgeText}>Purchased</Text></View>
                    </View>
                  ) : null}
                  <TouchableOpacity style={styles.removeBtn} onPress={() => confirmRemove(item)}>
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={items.length > 0 ? (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>UGX {Number(total).toLocaleString()}</Text>
          </View>
        ) : null}
      />

      {/* ── Delivery Modal ── */}
      <Modal
        visible={deliveryModal.open}
        transparent
        animationType="slide"
        onRequestClose={() => setDeliveryModal({ open: false, item: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="truck-outline" size={20} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Request Delivery</Text>
              </View>
              <TouchableOpacity onPress={() => setDeliveryModal({ open: false, item: null })}>
                <MaterialCommunityIcons name="close" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalProduct} numberOfLines={2}>
              {deliveryModal.item?.product?.name}
            </Text>
            <View style={styles.deliveryCard}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <MaterialCommunityIcons name="phone-outline" size={16} color={COLORS.primary} />
                <Text style={styles.deliveryLabel}>
                  Call our delivery partner to arrange pickup &amp; drop-off:
                </Text>
              </View>
              <TouchableOpacity style={styles.phoneBtn} onPress={callDelivery}>
                <MaterialCommunityIcons name="phone" size={14} color={COLORS.primary} />
                <Text style={styles.phoneBtnText}>{deliveryPhone}</Text>
              </TouchableOpacity>
              <Text style={styles.deliveryHint}>
                Give them your address and the product name above. Delivery fees are agreed directly with the courier.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalOkBtn}
              onPress={() => setDeliveryModal({ open: false, item: null })}
            >
              <Text style={styles.modalOkText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Remove Confirm Modal ── */}
      <Modal
        visible={removeModal.open}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveModal({ open: false, item: null, loading: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 340 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={COLORS.danger} />
                <Text style={styles.modalTitle}>Remove Item?</Text>
              </View>
              <TouchableOpacity onPress={() => setRemoveModal({ open: false, item: null, loading: false })}>
                <MaterialCommunityIcons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalProduct}>
              Remove <Text style={{ fontWeight: '700' }}>{removeModal.item?.product?.name}</Text> from your cart?
            </Text>
            <Text style={styles.modalNote}>The vendor will be notified.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { flex: 1 }]}
                onPress={() => setRemoveModal({ open: false, item: null, loading: false })}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { flex: 1 }, removeModal.loading && { opacity: 0.5 }]}
                onPress={doRemove}
                disabled={removeModal.loading}
              >
                {removeModal.loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.modalConfirmText}>Yes, Remove</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: '#f9f9f9' },
  card        : { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 2 },
  img         : { width: 100, height: 110 },
  info        : { flex: 1, padding: 10 },
  name        : { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  vendor      : { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  price       : { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  qtyRow      : { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  qtyBtn      : { backgroundColor: '#f0f0f0', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText  : { fontSize: 18, fontWeight: '700', color: '#333' },
  qty         : { fontSize: 15, fontWeight: '700', color: '#1a1a1a', minWidth: 20, textAlign: 'center' },
  subtotal    : { fontSize: 12, color: '#888', marginTop: 4 },
  deliveryBtn : { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  deliveryBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  confirmBtn  : { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  purchasedBadge: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, justifyContent: 'center' },
  purchasedBadgeText: { color: '#15803d', fontSize: 12, fontWeight: '700' },
  removeBtn   : { borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  removeBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
  empty       : { textAlign: 'center', color: '#aaa', marginTop: 60, fontSize: 16 },
  totalCard   : { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  totalLabel  : { fontSize: 16, fontWeight: '600', color: '#555' },
  totalValue  : { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  // Modals
  modalOverlay   : { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox       : { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalHeader    : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle     : { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  modalProduct   : { fontSize: 13.5, color: '#475569', marginBottom: 16 },
  modalNote      : { fontSize: 12, color: '#94a3b8', marginTop: -12 },
  deliveryCard   : { backgroundColor: '#f8fafc', borderRadius: 14, padding: 16, gap: 12, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  deliveryLabel  : { fontSize: 13, color: '#64748b' },
  phoneBtn       : { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  phoneBtnText   : { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  deliveryHint   : { fontSize: 12, color: '#94a3b8', lineHeight: 18 },
  modalOkBtn     : { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalOkText    : { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalCancelBtn : { backgroundColor: '#f1f5f9', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  modalConfirmBtn: { backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

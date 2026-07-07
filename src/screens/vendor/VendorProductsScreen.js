import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image,
  Modal, TextInput, ActivityIndicator, Alert, RefreshControl, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client, { BASE_URL } from '../../api/client';
import { COLORS } from '../../constants/theme';

const BLANK_FORM = { name: '', description: '', price: '', stock: '', condition: 'new', category_id: '' };

export default function VendorProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(BLANK_FORM);
  const [saving, setSaving]     = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/vendor/products');
      setProducts(res.data.data || res.data);
    } catch (e) {
    } finally { setLoading(false); }
  }, [navigation]);

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openAdd  = () => { setEditing(null); setForm(BLANK_FORM); setSelectedImages([]); setModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || '', price: String(p.price), stock: String(p.stock || ''), condition: p.condition || 'new', category_id: String(p.category_id || '') });
    setSelectedImages([]);
    setModal(true);
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setSelectedImages(prev => [...prev, ...result.assets]);
    }
  };

  const save = async () => {
    if (!form.name || !form.price) { Alert.alert('Error', 'Name and price are required.'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description || '');
      fd.append('price', String(parseFloat(form.price)));
      fd.append('stock', String(parseInt(form.stock) || 0));
      fd.append('condition', form.condition);
      if (form.category_id) fd.append('category_id', form.category_id);
      selectedImages.forEach((img, i) => {
        fd.append('images[]', {
          uri: img.uri,
          name: `photo_${i}.jpg`,
          type: img.mimeType || 'image/jpeg',
        });
      });
      if (editing) {
        fd.append('_method', 'PUT');
        await client.post(`/products/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await client.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setModal(false); load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Save failed.');
    } finally { setSaving(false); }
  };

  const remove = (id) => {
    Alert.alert('Delete Product', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await client.delete(`/products/${id}`); load(); } catch (_) {}
      }},
    ]);
  };

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      {/* Add button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Products ({products.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={i => String(i.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>No products yet. Add your first product!</Text>}
        renderItem={({ item }) => {
          // primary_image is a full URL string; images[0].url also works
          const imgUri = item.primary_image
            || item.images?.[0]?.url
            || `${BASE_URL}/images/placeholder.png`;
          return (
            <View style={styles.card}>
              <Image source={{ uri: imgUri }} style={styles.img} resizeMode="cover" />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.price}>UGX {Number(item.discount_price ?? item.price).toLocaleString()}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>Stock: {item.stock ?? '—'} | {item.condition || 'new'}</Text>
                  {item.is_sold_out && (
                    <View style={styles.soldTag}><Text style={styles.soldTagText}>SOLD</Text></View>
                  )}
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.delBtn} onPress={() => remove(item.id)}>
                    <Text style={styles.delBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Add / Edit Modal */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Product' : 'Add Product'}</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <MaterialCommunityIcons name="close" size={18} color="#888" />
            </TouchableOpacity>
          </View>

          {[
            ['name',        'Product Name',     'default'],
            ['description', 'Description',      'default'],
            ['price',       'Price (UGX)',       'numeric'],
            ['stock',       'Stock Quantity',    'numeric'],
            ['category_id', 'Category ID',       'numeric'],
          ].map(([k, label, type]) => (
            <View key={k}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={[styles.input, k === 'description' && { height: 80, textAlignVertical: 'top' }]}
                value={form[k]}
                onChangeText={v => setForm(f => ({ ...f, [k]: v }))}
                placeholder={label}
                keyboardType={type}
                multiline={k === 'description'}
                placeholderTextColor="#aaa"
                autoCapitalize="none"
              />
            </View>
          ))}

          <Text style={styles.label}>Condition</Text>
          <View style={styles.row}>
            {['new','used','refurbished'].map(c => (
              <TouchableOpacity key={c} style={[styles.pill, form.condition === c && styles.pillActive]} onPress={() => setForm(f => ({ ...f, condition: c }))}>
                <Text style={[styles.pillText, form.condition === c && { color: '#fff' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Product Images</Text>
          {editing && editing.images?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {editing.images.map((img, i) => (
                <Image key={i} source={{ uri: img.url }} style={styles.existingImg} resizeMode="cover" />
              ))}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.imgPickerBtn} onPress={pickImages}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="image-plus-outline" size={16} color={COLORS.primary} />
              <Text style={styles.imgPickerText}>{selectedImages.length > 0 ? `${selectedImages.length} image(s) selected — tap to add more` : (editing ? 'Add more images' : 'Select images')}</Text>
            </View>
          </TouchableOpacity>
          {selectedImages.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {selectedImages.map((img, i) => (
                <Image key={i} source={{ uri: img.uri }} style={styles.previewImg} resizeMode="cover" />
              ))}
            </ScrollView>
          )}

          {/* Subscription upsell — only when adding a new product */}
          {!editing && (
            <View style={styles.plansSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <MaterialCommunityIcons name="crown-outline" size={16} color={COLORS.primary} />
                <Text style={styles.plansLabel}>Unlock more products & images</Text>
              </View>
              {/* Free (current) */}
              <View style={[styles.planCard, styles.planCardFree]}>
                <View style={styles.planRow}>
                  <Text style={styles.planName}>No promo</Text>
                  <View style={styles.planBadge}><Text style={styles.planBadgeText}>Current plan</Text></View>
                </View>
                <Text style={styles.planDesc}>2 products · 2 images per product</Text>
              </View>
              {/* Weekly */}
              <TouchableOpacity style={styles.planCard} onPress={() => { setModal(false); navigation.navigate('VendorApply'); }} activeOpacity={0.75}>
                <View style={styles.planRow}>
                  <Text style={styles.planName}>TOP promo</Text>
                  <Text style={styles.planPrice}>UGX 11,000</Text>
                </View>
                <Text style={styles.planDesc}>Best choice if you need one fast sale. Your ad will be at the top of search results and get 15X more traffic</Text>
                <View style={styles.planChips}>
                  <View style={styles.planChip}><Text style={styles.planChipText}>7 days</Text></View>
                  <View style={styles.planChip}><Text style={styles.planChipText}>5 images per product</Text></View>
                </View>
              </TouchableOpacity>
              {/* Monthly */}
              <TouchableOpacity style={styles.planCard} onPress={() => { setModal(false); navigation.navigate('VendorApply'); }} activeOpacity={0.75}>
                <View style={styles.planRow}>
                  <Text style={styles.planName}>Boost Premium promo</Text>
                  <Text style={styles.planPrice}>UGX 20,000</Text>
                </View>
                <Text style={styles.planDesc}>Unlimited products · 7 images per product · Verified badge eligible</Text>
                <View style={styles.planChips}>
                  <View style={styles.planChip}><Text style={styles.planChipText}>30 days</Text></View>
                </View>
              </TouchableOpacity>
              {/* Quarterly */}
              <TouchableOpacity style={styles.planCard} onPress={() => { setModal(false); navigation.navigate('VendorApply'); }} activeOpacity={0.75}>
                <View style={styles.planRow}>
                  <Text style={styles.planName}>Go Premium</Text>
                  <Text style={styles.planPrice}>UGX 50,000</Text>
                </View>
                <Text style={styles.planDesc}>Maximum growth package. Unlimited products · 9 images per product · Verified badge eligible · Best value</Text>
                <View style={styles.planChips}>
                  <View style={styles.planChip}><Text style={styles.planChipText}>90 days (3 months)</Text></View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editing ? 'Save Changes' : 'Add Product'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: '#f9f9f9' },
  header      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle : { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  addBtn      : { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText  : { color: '#fff', fontWeight: '700', fontSize: 14 },
  card        : { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 2 },
  img         : { width: 90, height: 100 },
  info        : { flex: 1, padding: 10 },
  name        : { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  price       : { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  meta        : { fontSize: 11, color: '#888', marginTop: 2 },
  metaRow     : { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  soldTag     : { backgroundColor: '#dc2626', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  soldTagText : { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  actions     : { flexDirection: 'row', gap: 8, marginTop: 8 },
  editBtn     : { backgroundColor: '#e0f0ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  editBtnText : { color: '#3b82f6', fontWeight: '600', fontSize: 12 },
  delBtn      : { backgroundColor: '#ffe0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  delBtnText  : { color: '#ef4444', fontWeight: '600', fontSize: 12 },
  empty       : { textAlign: 'center', color: '#aaa', marginTop: 60, fontSize: 15 },
  modal       : { flex: 1, backgroundColor: '#fff' },
  modalHeader : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle  : { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  closeBtn    : { fontSize: 22, color: '#888' },
  label       : { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginTop: 14, marginBottom: 4 },
  input       : { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#f5f5f5', color: '#1a1a1a' },
  row         : { flexDirection: 'row', gap: 8 },
  pill        : { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  pillActive  : { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText    : { color: '#555', fontSize: 13 },
  saveBtn     : { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  saveBtnText : { color: '#fff', fontSize: 16, fontWeight: '700' },
  imgPickerBtn: { borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  imgPickerText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  previewImg  : { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
  existingImg : { width: 80, height: 80, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  // Subscription plan upsell
  plansSection: { marginTop: 22, marginBottom: 4 },
  plansLabel  : { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 10 },
  planCard    : { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 13, marginBottom: 8, backgroundColor: '#fff' },
  planCardFree: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  planRow     : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  planName    : { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  planPrice   : { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  planDesc    : { fontSize: 12, color: '#64748b', lineHeight: 17 },
  planBadge   : { backgroundColor: '#dcfce7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2 },
  planBadgeText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  planChips   : { flexDirection: 'row', gap: 6, marginTop: 7, flexWrap: 'wrap' },
  planChip    : { backgroundColor: '#dcfce7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#bbf7d0' },
  planChipText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
});

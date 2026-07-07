import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Image,
} from 'react-native';
import client, { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

const TYPE_COLORS = {
  offer:   '#1e40af',
  counter: '#7c3aed',
  accept:  '#16a34a',
  decline: '#dc2626',
  text:    null,
};

const TYPE_LABELS = {
  offer:   '💰 Offer',
  counter: '🔄 Counter Offer',
  accept:  '✅ Accepted',
  decline: '❌ Declined',
  text:    null,
};

export default function OfferChatScreen({ route, navigation }) {
  const { threadId, productName } = route.params;
  const { user } = useAuth();

  const [thread, setThread]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [msgType, setMsgType]   = useState('text');   // 'text' | 'counter' | 'accept' | 'decline'
  const [sending, setSending]   = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: productName ? `Offer: ${productName}` : 'Offer Chat' });
    loadThread();
  }, [threadId]);

  const loadThread = useCallback(async () => {
    try {
      const res = await client.get(`/offers/${threadId}`);
      setThread(res.data);
      setMessages(res.data.messages || []);
    } catch (e) {
      Alert.alert('Error', 'Could not load conversation.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  const isVendor = thread && user?.id === thread.vendor_id;
  const isClosed = thread && ['accepted', 'declined'].includes(thread.status);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (['counter'].includes(msgType) && !offerAmount) {
      Alert.alert('Required', 'Enter a counter-offer amount.');
      return;
    }

    setSending(true);
    try {
      const body = {
        message:      trimmed,
        type:         msgType,
        offer_amount: ['counter'].includes(msgType) ? parseFloat(offerAmount) : undefined,
      };
      const res = await client.post(`/offers/${threadId}/messages`, body);
      setMessages(prev => [...prev, res.data]);
      setText('');
      setOfferAmount('');
      setMsgType('text');

      // Refresh thread to pick up new status
      const threadRes = await client.get(`/offers/${threadId}`);
      setThread(threadRes.data);

      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to send.');
    } finally {
      setSending(false);
    }
  };

  const handleAddToCart = async () => {
    try {
      await client.post('/cart', { product_id: thread.product_id, quantity: 1 });
      Alert.alert('Added to Cart', 'The product has been added to your cart.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not add to cart.');
    }
  };

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;
  if (!thread) return null;

  const product = thread.product;
  const imgUri  = product?.main_image ?? product?.primary_image ?? `${BASE_URL}/images/placeholder.png`;

  const renderMessage = ({ item }) => {
    const isMe     = item.sender_id === user?.id;
    const typeLabel = TYPE_LABELS[item.type];
    const typeBg    = TYPE_COLORS[item.type];
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {typeLabel && (
            <View style={[styles.typeTag, typeBg && { backgroundColor: typeBg }]}>
              <Text style={styles.typeTagText}>{typeLabel}</Text>
            </View>
          )}
          {item.offer_amount && (
            <Text style={[styles.offerAmount, isMe && { color: '#fff' }]}>
              UGX {Number(item.offer_amount).toLocaleString()}
            </Text>
          )}
          <Text style={[styles.msgText, isMe && { color: '#fff' }]}>{item.message}</Text>
          <Text style={[styles.msgTime, isMe && { color: 'rgba(255,255,255,0.65)' }]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Product header */}
      <View style={styles.productHeader}>
        <Image source={{ uri: imgUri }} style={styles.productThumb} resizeMode="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.productName} numberOfLines={1}>{product?.name}</Text>
          <Text style={styles.productMeta}>
            Listed: <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
              UGX {Number(thread.product_price).toLocaleString()}
            </Text>
            {'  '}Current Offer: <Text style={{ color: '#1e40af', fontWeight: '700' }}>
              UGX {Number(thread.offered_price).toLocaleString()}
            </Text>
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(thread.status) }]}>
            <Text style={styles.statusText}>{thread.status.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Accepted banner — buyer can add to cart */}
      {thread.status === 'accepted' && !isVendor && (
        <TouchableOpacity style={styles.acceptedBanner} onPress={handleAddToCart}>
          <Text style={styles.acceptedBannerText}>
            ✅ Offer accepted at UGX {Number(thread.offered_price).toLocaleString()} — Tap to Add to Cart
          </Text>
        </TouchableOpacity>
      )}
      {thread.status === 'accepted' && isVendor && (
        <View style={[styles.acceptedBanner, { backgroundColor: '#dcfce7' }]}>
          <Text style={[styles.acceptedBannerText, { color: '#16a34a' }]}>
            ✅ You accepted the offer at UGX {Number(thread.offered_price).toLocaleString()}
          </Text>
        </View>
      )}
      {thread.status === 'declined' && (
        <View style={[styles.acceptedBanner, { backgroundColor: '#fee2e2' }]}>
          <Text style={[styles.acceptedBannerText, { color: '#dc2626' }]}>❌ This offer was declined.</Text>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => String(m.id)}
        contentContainerStyle={styles.msgList}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={styles.emptyChat}>No messages yet.</Text>}
        renderItem={renderMessage}
      />

      {/* Input area — hidden when closed */}
      {!isClosed ? (
        <View style={styles.inputArea}>
          {/* Type selector for vendor */}
          {isVendor && (
            <View style={styles.typeRow}>
              {[
                { key: 'text',    label: 'Text' },
                { key: 'counter', label: 'Counter' },
                { key: 'accept',  label: 'Accept' },
                { key: 'decline', label: 'Decline' },
              ].map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeBtn, msgType === t.key && styles.typeBtnActive]}
                  onPress={() => setMsgType(t.key)}
                >
                  <Text style={[styles.typeBtnText, msgType === t.key && { color: '#fff' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Counter amount input (vendor only) */}
          {isVendor && msgType === 'counter' && (
            <TextInput
              style={styles.counterInput}
              value={offerAmount}
              onChangeText={setOfferAmount}
              keyboardType="numeric"
              placeholder="Counter offer amount (UGX)"
              placeholderTextColor="#aaa"
            />
          )}

          {/* Buyer can also send a revised offer */}
          {!isVendor && (
            <View style={styles.typeRow}>
              {[
                { key: 'text',  label: 'Text' },
                { key: 'offer', label: 'New Offer' },
              ].map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeBtn, msgType === t.key && styles.typeBtnActive]}
                  onPress={() => setMsgType(t.key)}
                >
                  <Text style={[styles.typeBtnText, msgType === t.key && { color: '#fff' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {!isVendor && msgType === 'offer' && (
            <TextInput
              style={styles.counterInput}
              value={offerAmount}
              onChangeText={setOfferAmount}
              keyboardType="numeric"
              placeholder="New offer amount (UGX)"
              placeholderTextColor="#aaa"
            />
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder={
                msgType === 'accept'  ? 'Add acceptance message...' :
                msgType === 'decline' ? 'Add decline reason...' :
                msgType === 'counter' ? 'Add counter message...' :
                'Type a message...'
              }
              placeholderTextColor="#aaa"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
              onPress={send}
              disabled={!text.trim() || sending}
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>Send</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.closedBar}>
          <Text style={styles.closedBarText}>This offer has been {thread.status}.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function statusColor(status) {
  return { open: '#e0f2fe', countered: '#fef9c3', accepted: '#dcfce7', declined: '#fee2e2' }[status] || '#f3f4f6';
}

const styles = StyleSheet.create({
  container       : { flex: 1, backgroundColor: '#f9f9f9' },

  productHeader   : { flexDirection: 'row', gap: 10, backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
  productThumb    : { width: 54, height: 54, borderRadius: 8, backgroundColor: '#f0f0f0' },
  productName     : { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  productMeta     : { fontSize: 12, color: '#555', marginTop: 2 },
  statusBadge     : { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 },
  statusText      : { fontSize: 9, fontWeight: '800', color: '#555' },

  acceptedBanner  : { backgroundColor: COLORS.primary, padding: 12, alignItems: 'center' },
  acceptedBannerText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  msgList         : { padding: 14, gap: 6, paddingBottom: 8 },
  emptyChat       : { textAlign: 'center', color: '#aaa', marginTop: 40 },

  msgRow          : { marginBottom: 8 },
  msgRowMe        : { alignItems: 'flex-end' },
  msgRowThem      : { alignItems: 'flex-start' },
  bubble          : { maxWidth: '76%', borderRadius: 14, padding: 12 },
  bubbleMe        : { backgroundColor: COLORS.primary, borderBottomRightRadius: 3 },
  bubbleThem      : { backgroundColor: '#fff', elevation: 1, borderBottomLeftRadius: 3 },
  typeTag         : { backgroundColor: '#1e40af', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 5 },
  typeTagText     : { color: '#fff', fontSize: 10, fontWeight: '700' },
  offerAmount     : { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 3 },
  msgText         : { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  msgTime         : { fontSize: 10, color: '#888', marginTop: 4, alignSelf: 'flex-end' },

  inputArea       : { backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee', padding: 10 },
  typeRow         : { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  typeBtn         : { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f9f9f9' },
  typeBtnActive   : { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText     : { fontSize: 12, color: '#555', fontWeight: '600' },
  counterInput    : { backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#1a1a1a', marginBottom: 8 },
  inputRow        : { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  textInput       : { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', maxHeight: 90 },
  sendBtn         : { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtnText     : { color: '#fff', fontWeight: '700', fontSize: 14 },

  closedBar       : { backgroundColor: '#f3f4f6', padding: 14, alignItems: 'center', borderTopWidth: 1, borderColor: '#e0e0e0' },
  closedBarText   : { color: '#888', fontSize: 13, fontWeight: '600' },
});

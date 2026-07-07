import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client, { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES } from '../constants/theme';

const POLL_INTERVAL = 6000; // poll every 6 s for new messages

export default function ChatScreen({ route, navigation }) {
  const { threadId, otherName } = route.params;
  const { user } = useAuth();

  const [thread,    setThread]    = useState(null);
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [text,      setText]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [imageUri,  setImageUri]  = useState(null);  // pending image to send

  const listRef  = useRef(null);
  const pollRef  = useRef(null);
  const lastIdRef = useRef(0);

  useEffect(() => {
    navigation.setOptions({ title: otherName || 'Chat' });
    loadThread();

    // Start polling for new messages
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [threadId]);

  const loadThread = async () => {
    try {
      const res = await client.get(`/chat/threads/${threadId}`);
      setThread(res.data);
      const msgs = res.data.messages || [];
      setMessages(msgs);
      if (msgs.length) lastIdRef.current = msgs[msgs.length - 1].id;
    } catch (e) {
      Alert.alert('Error', 'Could not load conversation.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Lightweight poll — only fetch the full thread to pick up new messages
  const poll = useCallback(async () => {
    try {
      const res = await client.get(`/chat/threads/${threadId}`);
      const msgs = res.data.messages || [];
      if (msgs.length && msgs[msgs.length - 1].id !== lastIdRef.current) {
        setMessages(msgs);
        lastIdRef.current = msgs[msgs.length - 1].id;
        scrollBottom();
      }
    } catch (_) {}
  }, [threadId]);

  const scrollBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  useEffect(() => {
    if (messages.length) scrollBottom();
  }, [messages.length]);

  // ── Pick image ────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photo library to send images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const clearImage = () => setImageUri(null);

  // ── Send message ──────────────────────────────────────────────────────────
  const send = async () => {
    if (!text.trim() && !imageUri) return;
    setSending(true);
    try {
      const formData = new FormData();
      if (text.trim()) formData.append('body', text.trim());
      if (imageUri) {
        const filename = imageUri.split('/').pop();
        const type     = 'image/' + (filename.split('.').pop() || 'jpeg');
        formData.append('image', { uri: imageUri, name: filename, type });
      }

      const res = await client.post(`/chat/threads/${threadId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessages(prev => [...prev, res.data]);
      lastIdRef.current = res.data.id;
      setText('');
      setImageUri(null);
      scrollBottom();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderMessage = ({ item, index }) => {
    const isMine  = item.sender_id === user?.id;
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showDate = !prevMsg ||
      new Date(item.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
    const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <>
        {showDate && (
          <View style={styles.dateDivider}>
            <Text style={styles.dateText}>{new Date(item.created_at).toDateString()}</Text>
          </View>
        )}

        <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>

            {/* Offer reference card */}
            {item.type === 'offer_ref' && (
              <View style={styles.offerRef}>
                <MaterialCommunityIcons name="tag-outline" size={18} color={COLORS.primary} />
                <Text style={styles.offerRefText}>{item.body}</Text>
              </View>
            )}

            {/* Image message */}
            {item.image_path && (
              <Image
                source={{ uri: item.image_path?.startsWith('images/') ? `${BASE_URL}/${item.image_path}` : `${BASE_URL}/storage/${item.image_path}` }}
                style={styles.msgImage}
                resizeMode="cover"
              />
            )}

            {/* Text body (shown for text/offer_ref if there's a body) */}
            {item.type !== 'offer_ref' && !!item.body && (
              <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.body}</Text>
            )}

            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{time}</Text>
          </View>
        </View>
      </>
    );
  };

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={i => String(i.id)}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={scrollBottom}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <MaterialCommunityIcons name="chat-outline" size={48} color="#ccc" />
            <Text style={styles.emptyChatText}>Say hello! Start the conversation.</Text>
          </View>
        }
      />

      {/* Image preview before send */}
      {imageUri && (
        <View style={styles.imagePreviewRow}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          <TouchableOpacity onPress={clearImage} style={styles.clearImage}>
            <MaterialCommunityIcons name="close" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.imagePreviewLabel}>Ready to send</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
          <MaterialCommunityIcons name="image-plus-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          placeholderTextColor="#aaa"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
        />

        <TouchableOpacity
          onPress={send}
          disabled={sending || (!text.trim() && !imageUri)}
          style={[styles.sendBtn, (sending || (!text.trim() && !imageUri)) && styles.sendBtnDisabled]}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <MaterialCommunityIcons name="send-outline" size={18} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: '#f0f0f0' },
  messageList : { padding: 12, paddingBottom: 8 },

  // Date divider
  dateDivider : { alignItems: 'center', marginVertical: 12 },
  dateText    : { fontSize: 11, color: '#999', backgroundColor: '#e8e8e8', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },

  // Message rows
  msgRow      : { marginBottom: 6, alignItems: 'flex-start' },
  msgRowMine  : { alignItems: 'flex-end' },
  bubble      : { maxWidth: '78%', borderRadius: 18, padding: 10, paddingHorizontal: 14 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  bubbleMine  : { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },

  // Message content
  msgText     : { fontSize: SIZES.md, color: '#111', lineHeight: 20 },
  msgTextMine : { color: '#fff' },
  msgTime     : { fontSize: 10, color: '#aaa', marginTop: 4, textAlign: 'right' },
  msgTimeMine : { color: 'rgba(255,255,255,0.7)' },
  msgImage    : { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },

  // Offer reference card
  offerRef    : { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff3cd', borderRadius: 10, padding: 10, marginBottom: 4, borderLeftWidth: 3, borderColor: '#f59e0b' },
  offerRefIcon: { fontSize: 18 },
  offerRefText: { flex: 1, fontSize: SIZES.sm, color: '#92400e', fontWeight: '600', lineHeight: 18 },

  // Empty chat
  emptyChat   : { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyChatIcon: { fontSize: 48, marginBottom: 12 },
  emptyChatText: { color: '#aaa', fontSize: SIZES.md },

  // Image preview
  imagePreviewRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderTopWidth: 1, borderColor: COLORS.border, gap: 10 },
  imagePreview   : { width: 60, height: 60, borderRadius: 10 },
  clearImage     : { backgroundColor: COLORS.danger, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 4, left: 4 },
  imagePreviewLabel: { fontSize: SIZES.sm, color: '#888', fontStyle: 'italic' },

  // Input bar
  inputBar    : { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', borderTopWidth: 1, borderColor: COLORS.border, padding: 8, gap: 8 },
  iconBtn     : { padding: 6 },
  input       : { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 22, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: SIZES.md, maxHeight: 120, color: '#111' },
  sendBtn     : { backgroundColor: COLORS.primary, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ddd' },
  sendIcon    : { color: '#fff', fontSize: 18 },
});

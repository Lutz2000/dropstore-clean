import 'react-native-gesture-handler';
import ErrorBoundary from './src/components/ErrorBoundary';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, TouchableOpacity, Image, Text, StyleSheet,
  Modal, FlatList, TextInput, KeyboardAvoidingView, Platform, SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './src/api/client';

const AGENT_API  = API_URL.replace(/\/api$/, '') + '/api/agent-chat';
const SESSION_KEY = 'dsa_session_token';
const POLL_INTERVAL = 5000;

function getTime() {
  const d = new Date();
  const h = d.getHours(); const m = d.getMinutes();
  return `${h > 12 ? h - 12 : h || 12}:${m < 10 ? '0' + m : m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function App() {
  const [chatOpen, setChatOpen]   = useState(false);
  const [input, setInput]         = useState('');
  const [messages, setMessages]   = useState([
    { id: '1', type: 'agent', text: 'Hi there! 👋 Welcome to DropStore.', time: getTime() },
    { id: '2', type: 'agent', text: 'How can we help you today? Our team will reply right here in this chat!', time: getTime() },
  ]);
  const [isTyping, setIsTyping]   = useState(false);
  const listRef   = useRef(null);
  const tokenRef  = useRef(null);
  const lastIdRef = useRef(0);
  const pollRef   = useRef(null);

  // ── Session management ─────────────────────────────────────────
  const getOrCreateSession = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current;
    const stored = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
    try {
      const res = await fetch(AGENT_API + '/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ session_token: stored || null, platform: 'mobile' }),
      });
      const data = await res.json();
      tokenRef.current = data.session_token;
      await AsyncStorage.setItem(SESSION_KEY, data.session_token).catch(() => {});
      return data.session_token;
    } catch {
      return null;
    }
  }, []);

  // ── Polling for agent replies ──────────────────────────────────
  const startPolling = useCallback((token) => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${AGENT_API}/${token}/messages?after=${lastIdRef.current}`, {
          headers: { 'Accept': 'application/json' },
        });
        const data = await res.json();
        if (!data.messages || !data.messages.length) return;
        const agentMsgs = data.messages.filter(m => {
          if (m.id > lastIdRef.current) lastIdRef.current = m.id;
          return m.sender === 'agent';
        });
        if (agentMsgs.length > 0) {
          setMessages(prev => [
            ...prev,
            ...agentMsgs.map(m => ({
              id: String(m.id),
              type: 'agent',
              text: m.message,
              time: (() => {
                const d = new Date(m.created_at);
                const h = d.getHours(); const mi = d.getMinutes();
                return `${h > 12 ? h - 12 : h || 12}:${mi < 10 ? '0' + mi : mi} ${h >= 12 ? 'PM' : 'AM'}`;
              })(),
            })),
          ]);
        }
      } catch {}
    }, POLL_INTERVAL);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // ── Open / close ───────────────────────────────────────────────
  const openChat = useCallback(async () => {
    setChatOpen(true);
    const token = await getOrCreateSession();
    if (token) startPolling(token);
  }, [getOrCreateSession, startPolling]);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    stopPolling();
  }, [stopPolling]);

  // Stop polling when unmounted
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Send message ───────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', text, time: getTime() }]);
    setInput('');
    setIsTyping(true);

    try {
      const token = await getOrCreateSession();
      if (!token) throw new Error('no session');
      await fetch(`${AGENT_API}/${token}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        text: 'Message received! Our team will reply here shortly. 😊',
        time: getTime(),
      }]);
      startPolling(token);
    } catch {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        text: 'Failed to send. Please check your connection.',
        time: getTime(),
      }]);
    }
  }, [input, getOrCreateSession, startPolling]);

  const renderMessage = ({ item }) => (
    <View style={[chatStyles.msgRow, item.type === 'user' ? chatStyles.msgRowUser : chatStyles.msgRowAgent]}>
      {item.type === 'agent' && (
        <View style={chatStyles.msgAvatar}>
          <Image source={require('./assets/agent.png')} style={chatStyles.msgAvatarImg} />
        </View>
      )}
      <View style={[chatStyles.msgBubble, item.type === 'user' ? chatStyles.msgBubbleUser : chatStyles.msgBubbleAgent]}>
        <Text style={[chatStyles.msgText, item.type === 'user' && { color: '#fff' }]}>{item.text}</Text>
        <Text style={[chatStyles.msgTime, item.type === 'user' && { color: 'rgba(255,255,255,.7)' }]}>{item.time}</Text>
      </View>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
      <StatusBar style="auto" />
      <AuthProvider>
        <View style={{ flex: 1 }}>
          <AppNavigator />

          {/* In-App Chat Modal */}
          <Modal visible={chatOpen} animationType="slide" transparent onRequestClose={closeChat}>
            <View style={chatStyles.overlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={chatStyles.window}>
                <SafeAreaView style={{ flex: 1 }}>
                  {/* Header */}
                  <View style={chatStyles.header}>
                    <View style={chatStyles.headerAvatar}>
                      <Image source={require('./assets/agent.png')} style={chatStyles.headerAvatarImg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={chatStyles.headerName}>DropStore Agent</Text>
                      <Text style={chatStyles.headerStatus}>● Online now</Text>
                    </View>
                    <TouchableOpacity onPress={closeChat} style={chatStyles.closeBtn}>
                      <Text style={chatStyles.closeText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Messages */}
                  <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={chatStyles.msgList}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                  />

                  {isTyping && (
                    <View style={chatStyles.typingRow}>
                      <View style={chatStyles.msgAvatar}>
                        <Image source={require('./assets/agent.png')} style={chatStyles.msgAvatarImg} />
                      </View>
                      <View style={[chatStyles.msgBubbleAgent, { paddingVertical: 12, paddingHorizontal: 16 }]}>
                        <Text style={{ color: '#999', fontSize: 20, letterSpacing: 2 }}>• • •</Text>
                      </View>
                    </View>
                  )}

                  {/* Input */}
                  <View style={chatStyles.inputRow}>
                    <TextInput
                      style={chatStyles.input}
                      value={input}
                      onChangeText={setInput}
                      placeholder="Type a message…"
                      placeholderTextColor="#aaa"
                      multiline
                      maxLength={500}
                      onSubmitEditing={sendMessage}
                      blurOnSubmit={false}
                    />
                    <TouchableOpacity onPress={sendMessage} style={chatStyles.sendBtn} activeOpacity={0.8}>
                      <Text style={chatStyles.sendIcon}>➤</Text>
                    </TouchableOpacity>
                  </View>
                </SafeAreaView>
              </KeyboardAvoidingView>
            </View>
          </Modal>

          {/* WhatsApp FAB */}
          <TouchableOpacity
            onPress={() => require('react-native').Linking.openURL('https://wa.me/256759625728')}
            style={chatStyles.waFab}
            activeOpacity={0.85}
          >
            <Image source={require('./assets/whatsapp.png')} style={chatStyles.waFabIcon} />
          </TouchableOpacity>

          {/* Floating Agent FAB */}
          <TouchableOpacity onPress={openChat} style={chatStyles.fab} activeOpacity={0.85}>
            <Image source={require('./assets/agent.png')} style={chatStyles.fabIcon} />
          </TouchableOpacity>
        </View>
      </AuthProvider>
          </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const chatStyles = StyleSheet.create({
  waFab: {
    position: 'absolute', bottom: 248, right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FFA100',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FFA100', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 12, elevation: 10,
  },
  waFabIcon: { width: 32, height: 32, tintColor: '#fff' },
  fab: {
    position: 'absolute', bottom: 180, right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FFA100',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FFA100', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 12, elevation: 10,
  },
  fabIcon: { width: 32, height: 32, tintColor: '#fff' },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  window: {
    height: '75%', backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFA100', paddingHorizontal: 16, paddingVertical: 14,
  },
  headerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarImg: { width: 28, height: 28, tintColor: '#fff' },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  headerStatus: { color: 'rgba(255,255,255,.85)', fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 4 },
  closeText: { color: 'rgba(255,255,255,.9)', fontSize: 20, fontWeight: '600' },

  msgList: { flexGrow: 1, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f0ece3' },
  msgRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end' },
  msgRowAgent: { justifyContent: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },
  msgAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#FFA100', justifyContent: 'center', alignItems: 'center',
    marginRight: 6, flexShrink: 0,
  },
  msgAvatarImg: { width: 18, height: 18, tintColor: '#fff' },
  msgBubble: { maxWidth: '75%', borderRadius: 14, padding: 10 },
  msgBubbleAgent: { backgroundColor: '#fff', borderBottomLeftRadius: 2, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 3, elevation: 1 },
  msgBubbleUser: { backgroundColor: '#FFA100', borderBottomRightRadius: 2 },
  msgText: { fontSize: 13, color: '#333', lineHeight: 19 },
  msgTime: { fontSize: 10, color: 'rgba(0,0,0,.35)', marginTop: 3, textAlign: 'right' },

  typingRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingBottom: 4, backgroundColor: '#f0ece3' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff',
  },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, maxHeight: 80,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    color: '#333',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFA100',
    justifyContent: 'center', alignItems: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 18, marginLeft: 2 },
  waNote: { fontSize: 10.5, color: '#aaa', textAlign: 'center', paddingBottom: 8, backgroundColor: '#fff' },
});

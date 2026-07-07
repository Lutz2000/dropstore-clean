import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { TOKEN_KEY, registerUnauthHandler } from '../api/client';
import { clearAllCache } from '../api/cache';

// TOKEN → SecureStore  (short string, safe under iOS 2048-byte limit)
// USER  → AsyncStorage (no size limit — user JSON can be several KB)
const USER_STORAGE_KEY = 'dropstore_user_v1';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try { await client.post('/auth/logout'); } catch (_) {}
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await AsyncStorage.removeItem(USER_STORAGE_KEY).catch(() => {});
    await clearAllCache().catch(() => {});
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    registerUnauthHandler(logout);
  }, [logout]);

  // Restore session on launch
  useEffect(() => {
    (async () => {
      try {
        const t = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
        const uRaw = await AsyncStorage.getItem(USER_STORAGE_KEY).catch(() => null);
        if (t && uRaw) {
          setToken(t);
          setUser(JSON.parse(uRaw));
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        await AsyncStorage.removeItem(USER_STORAGE_KEY).catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (identifier, password) => {
    const res = await client.post('/auth/login', { identifier, password });
    const { token: tok, user: usr } = res.data;
    await SecureStore.setItemAsync(TOKEN_KEY, tok);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
    return usr;
  };

  const register = async (data) => {
    const res = await client.post('/auth/register', data);
    const { token: tok, user: usr } = res.data;
    await SecureStore.setItemAsync(TOKEN_KEY, tok);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
    return usr;
  };

  const refreshUser = async () => {
    const res = await client.get('/auth/me');
    const usr = res.data;
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(usr));
    setUser(usr);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

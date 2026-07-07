import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';


// -------------------------------------------------------------------
// Base URL resolution:
//   - In production (store build): reads from app.json extra.apiUrl
//   - In local dev: falls back to the LAN IP for physical device testing
// Replace "https://yourdomain.com/api" in app.json before building for stores.
// -------------------------------------------------------------------
const PROD_URL = Constants.expoConfig?.extra?.apiUrl;
const DEV_URL  = 'http://192.168.85.207/Dropstore/backend/public/api';

export const API_URL  = PROD_URL || DEV_URL;
export const BASE_URL = API_URL.replace(/\/api$/, '');

const TOKEN_KEY      = 'dropstore_token';
const SESSION_ID_KEY = 'dropstore_session_id';

/**
 * Returns a stable anonymous session ID persisted in AsyncStorage.
 * Created once per app install; survives app restarts.
 * Used by the backend to track guest search/browse behaviour for recommendations.
 */
async function getOrCreateSessionId() {
  try {
    let sid = await AsyncStorage.getItem(SESSION_ID_KEY);
    if (!sid) {
      sid = 'mob-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
      await AsyncStorage.setItem(SESSION_ID_KEY, sid);
    }
    return sid;
  } catch {
    return 'mob-' + Date.now();
  }
}

const client = axios.create({
  baseURL: API_URL,
  timeout: 15000,          // 15 s — handles slow shared-hosting responses
  headers: { Accept: 'application/json' },
});

// ── Request interceptor: attach Bearer token + session ID ────────
client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Always attach a session ID so the backend can correlate guest activity
  // for recommendations even before the user logs in.
  const sid = await getOrCreateSessionId();
  config.headers['X-Session-Id'] = sid;

  return config;
});

// ── Response interceptor: handle 401 / 429 / network errors ───────
let _onUnauthenticated = null;

/** Register a callback (from AuthContext) that clears auth state on 401. */
export function registerUnauthHandler(handler) {
  _onUnauthenticated = handler;
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    // 401 Unauthorized → token expired or invalid → force logout
    if (status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      _onUnauthenticated?.();
    }

    // 429 Too Many Requests → surface a friendly message
    if (status === 429) {
      error.message = 'Too many requests. Please slow down.';
    }

    // Network error (no internet / server unreachable)
    if (!error.response) {
      error.message = 'Network unavailable. Check your connection.';
    }

    return Promise.reject(error);
  }
);

export { TOKEN_KEY };
export default client;

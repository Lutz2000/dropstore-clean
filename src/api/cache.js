/**
 * Lightweight TTL-based cache backed by AsyncStorage.
 *
 * Why AsyncStorage and not memory?
 *  - Survives app backgrounding and cold restarts (offline-first)
 *  - Still fast enough for API response caching
 *
 * Usage:
 *   await setCached('products', data, 5 * 60 * 1000); // 5 min TTL
 *   const cached = await getCached('products');        // null if expired
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX        = 'ds_cache:';
const DEFAULT_TTL   = 5 * 60 * 1000;   // 5 minutes
const SETTINGS_TTL  = 10 * 60 * 1000;  // 10 minutes (changes rarely)

export { DEFAULT_TTL, SETTINGS_TTL };

export async function getCached(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { value, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      await AsyncStorage.removeItem(PREFIX + key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export async function setCached(key, value, ttl = DEFAULT_TTL) {
  try {
    await AsyncStorage.setItem(
      PREFIX + key,
      JSON.stringify({ value, expiresAt: Date.now() + ttl })
    );
  } catch {
    // Storage quota exceeded or serialisation error — silently skip
  }
}

export async function clearCached(key) {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {}
}

/** Wipe all DropStore cache entries (e.g. on logout). */
export async function clearAllCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(PREFIX));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}

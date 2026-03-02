import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { config } from './config';
import type { Database } from '../types/database';

/**
 * Secure storage adapter for Supabase auth tokens.
 * Uses expo-secure-store on native (iOS/Android) for encrypted storage.
 * Falls back to localStorage on web.
 *
 * Handles the SecureStore 2048-byte limit by chunking large values
 * (Supabase JWTs with custom claims can exceed this limit).
 */
const CHUNK_SIZE = 2000; // Leave margin below 2048 limit

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    // Try reading as single value first
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) return value;

    // Check if it was stored as chunks
    const chunk0 = await SecureStore.getItemAsync(`${key}_chunk_0`);
    if (chunk0 === null) return null;

    let result = chunk0;
    let i = 1;
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk === null) break;
      result += chunk;
      i++;
    }
    return result;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      // Clean up any old chunks
      try { await SecureStore.deleteItemAsync(`${key}_chunk_0`); } catch {}
      return;
    }

    // Value exceeds limit — store in chunks
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    // Clean up the non-chunked key and any extra old chunks
    try { await SecureStore.deleteItemAsync(key); } catch {}
    try { await SecureStore.deleteItemAsync(`${key}_chunk_${chunks}`); } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
    // Also clean up any chunks
    let i = 0;
    while (true) {
      try {
        const exists = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (exists === null) break;
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        i++;
      } catch {
        break;
      }
    }
  },
};

/**
 * Supabase client singleton.
 * - Auth tokens stored securely via expo-secure-store (native) or localStorage (web)
 * - Auto-refreshes tokens
 * - Detects session from URL (for OAuth redirect flows)
 */
export const supabase = createClient<Database>(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

/**
 * Helper to get the current authenticated user ID.
 * Returns null if not authenticated.
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
};

/**
 * Helper to get the current session.
 */
export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

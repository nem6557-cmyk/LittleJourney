import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

/**
 * Offline-first support utilities.
 * Caches data locally and syncs when connection is restored.
 */

type PendingMutation = {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  createdAt: string;
};

const PENDING_MUTATIONS_KEY = 'littlejourney_pending_mutations';
const CACHE_PREFIX = 'littlejourney_cache_';

/**
 * Check if the device is currently online.
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true;
  } catch {
    return true; // Assume online if check fails
  }
}

/**
 * Subscribe to network state changes.
 */
export function onNetworkChange(callback: (isConnected: boolean) => void) {
  return NetInfo.addEventListener((state) => {
    callback(state.isConnected === true);
  });
}

/**
 * Cache data locally for offline access.
 */
export async function cacheData(key: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({ data, cachedAt: new Date().toISOString() })
    );
  } catch (err) {
    console.warn('Failed to cache data:', err);
  }
}

/**
 * Retrieve cached data. Returns null if no cache or expired.
 */
export async function getCachedData<T>(key: string, maxAgeMs = 1000 * 60 * 30): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const { data, cachedAt } = JSON.parse(raw);
    const age = Date.now() - new Date(cachedAt).getTime();
    if (age > maxAgeMs) return null;

    return data as T;
  } catch {
    return null;
  }
}

/**
 * Queue a mutation for later sync when offline.
 */
export async function queueMutation(mutation: Omit<PendingMutation, 'id' | 'createdAt'>): Promise<void> {
  try {
    const existing = await getPendingMutations();
    const newMutation: PendingMutation = {
      ...mutation,
      id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    existing.push(newMutation);
    await AsyncStorage.setItem(PENDING_MUTATIONS_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('Failed to queue mutation:', err);
  }
}

/**
 * Get all pending mutations.
 */
export async function getPendingMutations(): Promise<PendingMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_MUTATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Remove a mutation from the pending queue after successful sync.
 */
export async function removePendingMutation(mutationId: string): Promise<void> {
  try {
    const existing = await getPendingMutations();
    const filtered = existing.filter((m) => m.id !== mutationId);
    await AsyncStorage.setItem(PENDING_MUTATIONS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Failed to remove mutation:', err);
  }
}

/**
 * Clear all pending mutations (e.g., after successful full sync).
 */
export async function clearPendingMutations(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_MUTATIONS_KEY);
  } catch (err) {
    console.warn('Failed to clear mutations:', err);
  }
}

/**
 * Retry an async operation with exponential backoff.
 * Useful for wrapping network calls that may fail transiently.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

/**
 * Clear all cached data.
 */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (err) {
    console.warn('Failed to clear cache:', err);
  }
}

/**
 * Process all pending mutations by executing them against Supabase.
 * Each successful mutation is removed from the queue.
 * Returns the count of successfully processed mutations.
 */
export async function processPendingMutations(
  executeMutation: (mutation: PendingMutation) => Promise<void>
): Promise<number> {
  const online = await isOnline();
  if (!online) return 0;

  const pending = await getPendingMutations();
  if (pending.length === 0) return 0;

  let processed = 0;
  for (const mutation of pending) {
    try {
      await executeMutation(mutation);
      await removePendingMutation(mutation.id);
      processed++;
    } catch (err) {
      console.warn(`[Offline] Failed to sync mutation ${mutation.id}:`, err);
      // Stop processing on first failure to preserve order
      break;
    }
  }
  return processed;
}

// Jest setup file
// Mock React Native modules that aren't available in Node test environment

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: jest.fn((obj: any) => obj.ios) },
  StyleSheet: { create: (styles: any) => styles },
  Alert: { alert: jest.fn() },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  Linking: { openURL: jest.fn(), canOpenURL: jest.fn().mockResolvedValue(true) },
}));

jest.mock('react-native-url-polyfill/auto', () => ({}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Set test environment variables for Supabase config
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-for-jest';
process.env.EXPO_PUBLIC_ENV = 'test';

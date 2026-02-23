import 'react-native-url-polyfill/auto';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AppNavigator } from './src/navigation/AppNavigator';

/**
 * Provider hierarchy (outermost → innermost):
 * 1. ErrorBoundary — catches runtime errors
 * 2. ThemeProvider — dark/light mode
 * 3. AuthProvider — Supabase auth session, profile, daycare
 * 4. AppProvider — app state (children, timeline, messages, etc.)
 * 5. AppNavigator — routing based on auth state
 */
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

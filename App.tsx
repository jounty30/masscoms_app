import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, Text, StyleSheet } from 'react-native';
const crashlytics = () => ({ recordError: (_e: Error) => {}, log: (_s: string) => {} });
import { AuthProvider } from './src/auth/AuthContext';
import { WebSocketProvider } from './src/ws/WebSocketContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { DevProvider } from './src/context/DevContext';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';

const queryClient = new QueryClient();

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    crashlytics().recordError(error);
    crashlytics().log(`Component stack: ${errorInfo.componentStack}`);
    console.error('App ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: { color: colors.text, fontSize: 18, marginBottom: 8 },
  errorText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <DevProvider>
            <NetworkProvider>
              <AuthProvider>
                <WebSocketProvider>
                  <ErrorBoundary>
                    <StatusBar style="light" />
                    <RootNavigator />
                  </ErrorBoundary>
                </WebSocketProvider>
              </AuthProvider>
            </NetworkProvider>
          </DevProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </View>
    </GestureHandlerRootView>
  );
}

import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export function SessionActivityWrapper({ children }: { children: React.ReactNode }) {
  const { refreshSessionActivity } = useAuth();
  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponder={() => {
        refreshSessionActivity();
        return false;
      }}
    >
      {children}
    </View>
  );
}

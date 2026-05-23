import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNotificationHandler } from '../components/NotificationHandler';
import { useAuth } from '../auth/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import BiometricGateScreen from '../screens/BiometricGateScreen';
import HomeScreen from '../screens/HomeScreen';
import LiveIncidentScreen from '../screens/LiveIncidentScreen';
import ResponsePlanScreen from '../screens/ResponsePlanScreen';
import TriggerIncidentScreen from '../screens/TriggerIncidentScreen';
import MapViewScreen from '../screens/MapViewScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AcknowledgmentMonitorScreen from '../screens/AcknowledgmentMonitorScreen';
import PresenceAccountabilityScreen from '../screens/PresenceAccountabilityScreen';
import PeopleOnSiteScreen from '../screens/PeopleOnSiteScreen';
import TriggerStatusScreen from '../screens/TriggerStatusScreen';
import IncidentTriggeringScreen from '../screens/IncidentTriggeringScreen';
import LivePAScreen from '../screens/LivePAScreen';
import { SessionActivityWrapper } from '../components/SessionActivityWrapper';
import { ActivityIndicator, View, StyleSheet, Image } from 'react-native';
import { colors } from '../theme';

const LOGO_URL = 'https://masscoms.com/_assets/v11/59bc82576142a8ae7266d760a26a645e8799f840.png';

function HeaderLogo() {
  return (
    <Image source={{ uri: LOGO_URL }} style={headerLogoStyles.logo} resizeMode="contain" />
  );
}

const headerLogoStyles = StyleSheet.create({
  logo: { height: 28, width: 120 },
});

const Stack = createNativeStackNavigator();

const mainScreenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '600' as const },
  contentStyle: { backgroundColor: colors.background },
};

export default function RootNavigator() {
  const { isAuthenticated, isLoading, needsBiometricUnlock } = useAuth();
  const navigationRef = useRef(null);
  useNotificationHandler(navigationRef);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {!isAuthenticated && !needsBiometricUnlock ? (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      ) : needsBiometricUnlock ? (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="BiometricGate" component={BiometricGateScreen} />
        </Stack.Navigator>
      ) : (
        <SessionActivityWrapper>
          <Stack.Navigator screenOptions={mainScreenOptions}>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerTitle: () => <HeaderLogo /> }} />
            <Stack.Screen name="LiveIncident" component={LiveIncidentScreen} options={{ title: 'Live Incident' }} />
            <Stack.Screen name="ResponsePlan" component={ResponsePlanScreen} options={{ title: 'Response Plan' }} />
            <Stack.Screen name="TriggerIncident" component={TriggerIncidentScreen} options={{ title: 'Trigger Incident' }} />
            <Stack.Screen name="IncidentTriggering" component={IncidentTriggeringScreen} options={{ title: 'Triggering Incident', headerShown: false }} />
            <Stack.Screen name="Map" component={MapViewScreen} options={{ title: 'Map' }} />
            <Stack.Screen name="AcknowledgmentMonitor" component={AcknowledgmentMonitorScreen} options={{ title: 'Monitor' }} />
            <Stack.Screen name="Presence" component={PresenceAccountabilityScreen} options={{ title: 'Presence & Accountability' }} />
            <Stack.Screen name="TriggerStatus" component={TriggerStatusScreen} options={{ title: 'Trigger Status' }} />
            <Stack.Screen name="PeopleOnSite" component={PeopleOnSiteScreen} options={{ title: 'People on Site' }} />
            <Stack.Screen name="LivePA" component={LivePAScreen} options={{ title: 'Live PA' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          </Stack.Navigator>
        </SessionActivityWrapper>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

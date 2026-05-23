import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { colors } from '../theme';

// Static response plans per incident type (FEATURE_ROUNDUP)
const PLANS: Record<string, { title: string; steps: string[]; color: string }> = {
  lockdown: {
    title: 'Lockdown',
    color: colors.lockdown,
    steps: [
      'Lock all doors and windows immediately',
      'Turn off lights and close blinds',
      'Move away from doors and windows',
      'Silence all mobile devices',
      'Stay calm and await further instructions',
      'Do not leave your location until All Clear is given',
    ],
  },
  evacuation: {
    title: 'Evacuation',
    color: colors.evacuation,
    steps: [
      'Leave belongings behind',
      'Use the nearest safe exit – do not use lifts',
      'Go to the assembly point and stay there',
      'Wait for roll call and further instructions',
    ],
  },
  fire: {
    title: 'Fire',
    color: colors.fire,
    steps: [
      'Activate the nearest fire alarm if not already sounding',
      'Leave by the nearest exit – do not use lifts',
      'Stay low if there is smoke',
      'Go to the assembly point and report to the fire warden',
    ],
  },
  medical: {
    title: 'Medical Emergency',
    color: colors.medical,
    steps: [
      'Stay calm and do not move the person unless in danger',
      'Call for help using the Request Assistance button',
      'Provide your exact location and nature of the emergency',
      'Stay with the person until help arrives',
    ],
  },
};

export default function ResponsePlanScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const incidentType = ((route.params as { incidentType?: string } | undefined)?.incidentType ?? 'lockdown') as keyof typeof PLANS;
  const plan = PLANS[incidentType] ?? PLANS.lockdown;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: plan.color }]}>
        <Text style={styles.headerTitle}>{plan.title} – Response Plan</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What should I do now?</Text>
        {plan.steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: plan.color }]}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Map')}
      >
        <Text style={styles.buttonText}>🗺️ View Map & Assembly Points</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  header: { padding: 20, borderRadius: 16, marginBottom: 24 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stepText: { flex: 1, fontSize: 16, color: colors.text, lineHeight: 24 },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

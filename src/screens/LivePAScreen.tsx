/**
 * Live PA (Tannoy) – demo screen.
 * Hold to speak, release to "send". No actual recording – for demo only.
 */
import React from 'react';
import { useRoute } from '@react-navigation/native';
import { LivePAContent } from '../components/LivePAContent';

export default function LivePAScreen() {
  const route = useRoute();
  const incidentId = (route.params as { incidentId?: string } | undefined)?.incidentId;

  return <LivePAContent incidentId={incidentId} />;
}

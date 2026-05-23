/**
 * Handles push notification taps - navigates to Live Incident when incidentId is in notification data.
 */
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {
  // Ignore if notifications not available (e.g. web)
}

export function useNotificationHandler(
  navigationRef: React.RefObject<{ navigate: (name: string, params?: { id: string }) => void; isReady: () => boolean } | null>
) {
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!navigationRef?.current) return;

    listenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; incidentId?: string };
      if (data?.incidentId && navigationRef.current?.isReady()) {
        navigationRef.current.navigate('LiveIncident', { id: data.incidentId });
      }
    });

    return () => {
      if (listenerRef.current) {
        Notifications.removeNotificationSubscription(listenerRef.current);
      }
    };
  }, [navigationRef]);
}

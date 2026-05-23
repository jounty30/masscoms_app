import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { stopPAAnnouncements, broadcastLivePA } from '../api/livePA';
import { colors } from '../theme';

interface LivePAModalProps {
  visible: boolean;
  onClose: () => void;
  incidentId: string;
}

export function LivePAModal({ visible, onClose, incidentId }: LivePAModalProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'sending'>('idle');
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      setStatus('recording');

      const { status: permStatus } = await Audio.requestPermissionsAsync();
      if (permStatus !== 'granted') {
        setError('Microphone permission is required for Live PA.');
        setStatus('idle');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      await stopPAAnnouncements(incidentId, undefined);

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recording.startAsync();
      recordingRef.current = recording;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start recording';
      setError(msg);
      setStatus('idle');
    }
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) {
      setStatus('idle');
      return;
    }

    try {
      setStatus('sending');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        setError('No recording captured.');
        setStatus('idle');
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await broadcastLivePA(base64, { incidentId });
      await FileSystem.deleteAsync(uri, { idempotent: true });

      Alert.alert('Live PA Sent', 'Your message has been broadcast to the PA system.');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send broadcast';
      setError(msg);
    } finally {
      setStatus('idle');
    }
  };

  const handlePressIn = () => {
    if (status === 'idle') startRecording();
  };

  const handlePressOut = () => {
    if (status === 'recording') stopRecording();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Live PA</Text>
          <Text style={styles.subtitle}>
            Hold the button and speak. Your voice will be broadcast to the sound system. Any playing announcement will stop when you start.
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.holdButton,
              status === 'recording' && styles.holdButtonActive,
              status === 'sending' && styles.holdButtonDisabled,
            ]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={status === 'sending'}
          >
            {status === 'sending' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.holdButtonText}>
                {status === 'recording' ? '🔴 Broadcasting… Release to send' : 'Hold to speak'}
              </Text>
            )}
          </Pressable>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: colors.error, fontSize: 14 },
  holdButton: {
    backgroundColor: colors.primary,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  holdButtonActive: { backgroundColor: colors.error },
  holdButtonDisabled: { opacity: 0.7 },
  holdButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeButton: {
    padding: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  closeButtonText: { color: colors.text, fontSize: 16 },
});

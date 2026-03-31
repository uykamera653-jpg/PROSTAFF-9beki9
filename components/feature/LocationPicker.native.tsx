import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/Button';
import { spacing, typography, borderRadius } from '../../constants/theme';

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (coords: { latitude: number; longitude: number }, address: string) => void;
  initialLocation?: { latitude: number; longitude: number };
}

const DEFAULT_LOCATION = { latitude: 41.2995, longitude: 69.2401 }; // Tashkent

export function LocationPickerButton(props: Omit<LocationPickerProps, 'visible' | 'onClose'>) {
  const [visible, setVisible] = React.useState(false);
  const { theme } = useTheme();

  return (
    <>
      <TouchableOpacity
        style={[styles.pickerButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="location-outline" size={24} color={theme.primary} />
        <Text style={[styles.pickerButtonText, { color: theme.text }]}>Manzilni tanlang</Text>
      </TouchableOpacity>
      <LocationPicker {...props} visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

export function LocationPicker({ visible, onClose, onLocationSelect, initialLocation }: LocationPickerProps) {
  const { theme } = useTheme();
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || DEFAULT_LOCATION);
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = React.useRef<any>(null);

  useEffect(() => {
    if (visible && !initialLocation) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Prostaff', 'Lokatsiya ruxsati berilmadi');
        setIsLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setSelectedLocation(coords);
      if (mapRef.current) {
        mapRef.current.animateToRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
      }
      await getAddress(coords);
    } catch (e) {
      console.error('Location error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const getAddress = async (coords: { latitude: number; longitude: number }) => {
    try {
      const results = await Location.reverseGeocodeAsync(coords);
      if (results?.length > 0) {
        const r = results[0];
        const parts = [r.street, r.city, r.region, r.country].filter(Boolean);
        setAddress(parts.join(', '));
      }
    } catch {
      setAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
    }
  };

  const handleMapPress = async (coords: { latitude: number; longitude: number }) => {
    setSelectedLocation(coords);
    await getAddress(coords);
  };

  const handleConfirm = () => {
    onLocationSelect(
      selectedLocation,
      address || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
    );
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Manzilni tanlang</Text>
          <TouchableOpacity onPress={getCurrentLocation} disabled={isLoading}>
            <Ionicons name="locate" size={28} color={isLoading ? theme.textTertiary : theme.primary} />
          </TouchableOpacity>
        </View>

        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{ ...selectedLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          onPress={(e: any) => handleMapPress(e.nativeEvent.coordinate)}
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={selectedLocation}
            draggable
            onDragEnd={(e: any) => handleMapPress(e.nativeEvent.coordinate)}
            pinColor="#FF4444"
          />
        </MapView>

        <View style={[styles.footer, { backgroundColor: theme.surface }]}>
          {address ? (
            <View style={styles.addressRow}>
              <Ionicons name="location" size={20} color={theme.primary} />
              <Text style={[styles.address, { color: theme.text }]} numberOfLines={2}>{address}</Text>
            </View>
          ) : null}
          <Text style={[styles.coords, { color: theme.textSecondary }]}>
            {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
          </Text>
          <Button title="Tasdiqlash" onPress={handleConfirm} style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  closeBtn: { padding: spacing.xs },
  title: { ...typography.h3, flex: 1, textAlign: 'center' },
  map: { flex: 1 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  address: { ...typography.body, flex: 1 },
  coords: {
    ...typography.small,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  pickerButtonText: { ...typography.bodyMedium, flex: 1 },
});

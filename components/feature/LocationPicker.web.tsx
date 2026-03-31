import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  const updateAddress = useCallback(async (coords: { latitude: number; longitude: number }) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
      );
      const data = await res.json();
      if (data?.display_name) {
        setAddress(data.display_name.split(',').slice(0, 3).join(','));
      }
    } catch {
      setAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (typeof window === 'undefined') return;

    let isMounted = true;

    const initMap = async () => {
      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        LRef.current = L;

        if (!isMounted || !mapRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const startCoords = initialLocation || DEFAULT_LOCATION;

        const map = L.map(mapRef.current, {
          center: [startCoords.latitude, startCoords.longitude],
          zoom: 15,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        const icon = L.divIcon({
          html: `<div style="width:28px;height:28px;background:#FF4444;border-radius:50%;border:4px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:grab"></div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([startCoords.latitude, startCoords.longitude], {
          icon,
          draggable: true,
        }).addTo(map);

        marker.on('dragend', async (e: any) => {
          const { lat, lng } = e.target.getLatLng();
          const coords = { latitude: lat, longitude: lng };
          setSelectedLocation(coords);
          await updateAddress(coords);
        });

        map.on('click', async (e: any) => {
          const coords = { latitude: e.latlng.lat, longitude: e.latlng.lng };
          marker.setLatLng([coords.latitude, coords.longitude]);
          setSelectedLocation(coords);
          await updateAddress(coords);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;

        if (!initialLocation) {
          getCurrentLocation(map, marker);
        } else {
          await updateAddress(startCoords);
        }
      } catch (e) {
        console.log('Leaflet init error:', e);
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initMap, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [visible]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const getCurrentLocation = async (map?: any, marker?: any) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setSelectedLocation(coords);
        const m = marker || markerRef.current;
        const mp = map || mapInstanceRef.current;
        if (mp) mp.flyTo([coords.latitude, coords.longitude], 16);
        if (m) m.setLatLng([coords.latitude, coords.longitude]);
        await updateAddress(coords);
        setIsLoading(false);
      },
      () => setIsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleConfirm = () => {
    onLocationSelect(
      selectedLocation,
      address || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
    );
    // onClose is called by parent's onLocationSelect callback to avoid double-close
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Manzilni tanlang</Text>
          <TouchableOpacity onPress={() => getCurrentLocation()} disabled={isLoading}>
            <Ionicons name="locate" size={28} color={isLoading ? theme.textTertiary : theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Leaflet map container */}
        <div
          ref={mapRef}
          style={{ flex: 1, width: '100%', minHeight: 300 }}
        />

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

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
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
  const webViewRef = useRef<any>(null);

  useEffect(() => {
    if (visible && !initialLocation) {
      getCurrentLocation();
    } else if (visible && initialLocation) {
      setSelectedLocation(initialLocation);
      fetchAddress(initialLocation.latitude, initialLocation.longitude);
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);

      // 1. Check permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Lokatsiya ruxsati yo\'q',
          'Joylashuvni aniqlash uchun telefon sozlamalaridan ruxsat bering.',
          [
            { text: 'Bekor qilish', style: 'cancel' },
            {
              text: 'Ruxsat bering',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        setIsLoading(false);
        return;
      }

      // 2. Check if location services (GPS) are enabled
      const providerStatus = await Location.getProviderStatusAsync();
      if (!providerStatus.locationServicesEnabled) {
        Alert.alert(
          'GPS yoqilmagan',
          "Joylashuvni aniqlash uchun GPS xizmatini yoqing.",
          [
            { text: 'Bekor qilish', style: 'cancel' },
            {
              text: 'GPS yoqish',
              onPress: () => {
                if (Platform.OS === 'android') {
                  Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
                } else {
                  Linking.openURL('App-Prefs:Privacy&path=LOCATION').catch(() => Linking.openSettings());
                }
              },
            },
          ]
        );
        setIsLoading(false);
        return;
      }

      let coords: { latitude: number; longitude: number } | null = null;

      // 3. Try last known position first (instant)
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          coords = { latitude: last.coords.latitude, longitude: last.coords.longitude };
          // Show immediately while fresh position loads
          setSelectedLocation(coords);
          moveMapTo(coords.latitude, coords.longitude);
        }
      } catch { /* ignore */ }

      // 4. Get fresh position with timeout fallback
      try {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
        ]) as Location.LocationObject;
        coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      } catch {
        // 5. Lowest accuracy fallback
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
          coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        } catch (e2) {
          if (!coords) {
            Alert.alert('Xatolik', 'Joylashuv aniqlanmadi. GPS ni yoqib, ochiq joyda qayta urining.');
          }
        }
      }

      if (coords) {
        setSelectedLocation(coords);
        moveMapTo(coords.latitude, coords.longitude);
        await fetchAddress(coords.latitude, coords.longitude);
      }
    } catch (e) {
      console.error('Location error:', e);
      Alert.alert('Xatolik', 'Joylashuv aniqlanmadi.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results?.length > 0) {
        const r = results[0];
        const parts = [r.street, r.city, r.region].filter(Boolean);
        setAddress(parts.join(', ') || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch {
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  };

  const moveMapTo = (lat: number, lng: number) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window._map && window._marker) {
          window._map.setView([${lat}, ${lng}], 15);
          window._marker.setLatLng([${lat}, ${lng}]);
        }
        true;
      `);
    }
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationSelected') {
        const coords = { latitude: data.lat, longitude: data.lng };
        setSelectedLocation(coords);
        await fetchAddress(data.lat, data.lng);
      }
    } catch (e) {
      console.error('WebView message error:', e);
    }
  };

  const handleConfirm = () => {
    onLocationSelect(
      selectedLocation,
      address || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
    );
  };

  const mapHtml = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  #map { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var lat = ${selectedLocation.latitude};
  var lng = ${selectedLocation.longitude};

  var map = L.map('map', { attributionControl: false }).setView([lat, lng], 15);
  window._map = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  var redIcon = L.divIcon({
    html: '<div style="width:28px;height:28px;background:#FF4444;border-radius:50%;border:4px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:grab"></div>',
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  var marker = L.marker([lat, lng], { icon: redIcon, draggable: true }).addTo(map);
  window._marker = marker;

  marker.on('dragend', function(e) {
    var pos = e.target.getLatLng();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'locationSelected',
      lat: pos.lat,
      lng: pos.lng
    }));
  });

  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'locationSelected',
      lat: e.latlng.lat,
      lng: e.latlng.lng
    }));
  });
</script>
</body>
</html>
  `;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Manzilni tanlang</Text>
          <TouchableOpacity onPress={getCurrentLocation} disabled={isLoading}>
            <Ionicons
              name="locate"
              size={28}
              color={isLoading ? theme.textTertiary : theme.primary}
            />
          </TouchableOpacity>
        </View>

        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={{ flex: 1 }}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          mixedContentMode="always"
        />

        <View style={[styles.footer, { backgroundColor: theme.surface }]}>
          {address ? (
            <View style={styles.addressRow}>
              <Ionicons name="location" size={20} color={theme.primary} />
              <Text style={[styles.address, { color: theme.text }]} numberOfLines={2}>
                {address}
              </Text>
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
    paddingTop: Platform.OS === 'ios' ? spacing.xl : spacing.md,
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

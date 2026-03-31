import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/Button';
import { spacing, typography, borderRadius } from '../../constants/theme';

// Platform-specific map imports
let MapView: any = null;
let Marker: any = null;
let MapContainer: any = null;
let TileLayer: any = null;
let MapMarker: any = null;
let useMapEvents: any = null;
let useMap: any = null;
let L: any = null;
let Icon: any = null;
let DivIcon: any = null;

// Import Leaflet CSS for web
if (Platform.OS === 'web') {
  try {
    require('leaflet/dist/leaflet.css');
  } catch (e) {
    console.log('Leaflet CSS not loaded');
  }
}

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
  } catch (e) {
    console.log('React Native Maps not loaded');
  }
} else {
  try {
    const Leaflet = require('react-leaflet');
    MapContainer = Leaflet.MapContainer;
    TileLayer = Leaflet.TileLayer;
    MapMarker = Leaflet.Marker;
    useMapEvents = Leaflet.useMapEvents;
    useMap = Leaflet.useMap;
    
    // Leaflet core for custom icons
    L = require('leaflet');
    Icon = L.Icon;
    DivIcon = L.DivIcon;
  } catch (e) {
    console.log('Leaflet not loaded');
  }
}

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (coords: { latitude: number; longitude: number }, address: string) => void;
  initialLocation?: { latitude: number; longitude: number };
}

export function LocationPickerButton(props: Omit<LocationPickerProps, 'visible' | 'onClose'>) {
  const [visible, setVisible] = React.useState(false);
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <TouchableOpacity
        style={[styles.pickerButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
        onPress={() => setVisible(true)}
      >
        <Ionicons name="location-outline" size={24} color={theme.primary} />
        <Text style={[styles.pickerButtonText, { color: theme.text }]}>
          {t.selectLocation || 'Manzilni tanlang'}
        </Text>
      </TouchableOpacity>
      <LocationPicker
        {...props}
        visible={visible}
        onClose={() => setVisible(false)}
      />
    </>
  );
}

export function LocationPicker({ visible, onClose, onLocationSelect, initialLocation }: LocationPickerProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  const defaultLocation = { latitude: 41.2995, longitude: 69.2401 }; // Tashkent
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || defaultLocation);
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const shouldCenterRef = React.useRef(false);

  useEffect(() => {
    if (visible && !initialLocation) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      
      // Web platformada browser geolocation API dan foydalanish
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            shouldCenterRef.current = true;
            setSelectedLocation(coords);
            await getAddressFromCoords(coords);
            setIsLoading(false);
          },
          (error) => {
            console.error('Geolocation error:', error);
            alert(t.locationPermissionDenied || 'Lokatsiya ruxsati berilmadi');
            setIsLoading(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        return;
      }

      // Mobil platformada expo-location ishlatish
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(t.appName, t.locationPermissionDenied || 'Lokatsiya ruxsati berilmadi');
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      shouldCenterRef.current = true;
      setSelectedLocation(coords);
      await getAddressFromCoords(coords);
      setIsLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setIsLoading(false);
    }
  };

  const getAddressFromCoords = async (coords: { latitude: number; longitude: number }) => {
    try {
      const results = await Location.reverseGeocodeAsync(coords);
      if (results && results.length > 0) {
        const result = results[0];
        const addressParts = [
          result.street,
          result.city,
          result.region,
          result.country,
        ].filter(Boolean);
        setAddress(addressParts.join(', '));
      }
    } catch (error) {
      console.error('Error getting address:', error);
      setAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
    }
  };

  const handleMapPress = async (coords: { latitude: number; longitude: number }) => {
    setSelectedLocation(coords);
    await getAddressFromCoords(coords);
  };

  const handleConfirm = () => {
    onLocationSelect(selectedLocation, address || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`);
    onClose();
  };



  const renderMap = () => {
    // Mobil platformalar (iOS, Android)
    if (Platform.OS !== 'web' && MapView) {
      return (
        <MapView
          style={styles.map}
          initialRegion={{
            ...selectedLocation,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={(e: any) => handleMapPress(e.nativeEvent.coordinate)}
        >
          <Marker 
            coordinate={selectedLocation}
            draggable
            onDragEnd={(e: any) => handleMapPress(e.nativeEvent.coordinate)}
            pinColor="#FF4444"
          >
            <View style={styles.customMarker}>
              <View style={styles.markerDot} />
              <View style={styles.markerPin} />
            </View>
          </Marker>
        </MapView>
      );
    }
    
    // Web platform (Leaflet)
    if (Platform.OS === 'web' && MapContainer && TileLayer && MapMarker && L) {
      // Custom icon for better visibility
      const customIcon = new L.DivIcon({
        html: `
          <div style="
            position: relative;
            width: 40px;
            height: 50px;
          ">
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <!-- Shadow -->
              <ellipse cx="20" cy="48" rx="8" ry="3" fill="rgba(0,0,0,0.2)" />
              <!-- Pin body -->
              <path d="M20 0 C11 0 4 7 4 16 C4 28 20 50 20 50 S36 28 36 16 C36 7 29 0 20 0 Z" 
                    fill="#FF4444" stroke="#CC0000" stroke-width="2"/>
              <!-- Inner circle -->
              <circle cx="20" cy="16" r="8" fill="white"/>
              <!-- Center dot -->
              <circle cx="20" cy="16" r="4" fill="#FF4444"/>
            </svg>
            <!-- Pulse animation -->
            <div style="
              position: absolute;
              top: 15px;
              left: 18px;
              width: 4px;
              height: 4px;
              background: #FF4444;
              border-radius: 50%;
              animation: pulse 1.5s infinite;
            "></div>
          </div>
          <style>
            @keyframes pulse {
              0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); }
              70% { box-shadow: 0 0 0 15px rgba(255, 68, 68, 0); }
              100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
            }
          </style>
        `,
        className: '',
        iconSize: [40, 50],
        iconAnchor: [20, 50],
      });

      // MapCenterController: only flies to location when explicitly requested (locate button)
      const MapCenterController = () => {
        const map = useMap();
        React.useEffect(() => {
          if (shouldCenterRef.current) {
            map.flyTo([selectedLocation.latitude, selectedLocation.longitude], 15);
            shouldCenterRef.current = false;
          }
        }, [selectedLocation.latitude, selectedLocation.longitude]);
        return null;
      };

      // MapContent component to handle events and marker updates
      const MapContent = () => {
        useMapEvents({
          click: (e: any) => {
            const { lat, lng } = e.latlng;
            handleMapPress({ latitude: lat, longitude: lng });
          },
        });

        return (
          <MapMarker 
            position={[selectedLocation.latitude, selectedLocation.longitude]}
            draggable={true}
            icon={customIcon}
            eventHandlers={{
              dragend: (e: any) => {
                const marker = e.target;
                const { lat, lng } = marker.getLatLng();
                handleMapPress({ latitude: lat, longitude: lng });
              },
            }}
          />
        );
      };

      return (
        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
          <MapContainer
            center={[selectedLocation.latitude, selectedLocation.longitude]}
            zoom={15}
            style={{ height: '100%', width: '100%', cursor: 'crosshair', borderRadius: '8px' }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
            <MapCenterController />
            <MapContent />
          </MapContainer>
        </div>
      );
    }
    
    // Agar xarita mavjud bo'lmasa - fallback
    return (
      <View style={[styles.map, { backgroundColor: theme.surfaceVariant, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="map-outline" size={64} color={theme.textTertiary} />
        <Text style={[styles.mapPlaceholder, { color: theme.textSecondary }]}>
          {t.mapNotAvailable || 'Karta yuklanmoqda...'}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary, marginTop: spacing.md }]}
          onPress={getCurrentLocation}
        >
          <Text style={{ color: '#FFFFFF', ...typography.bodyMedium }}>
            {t.currentLocation || 'Joriy joylashuv'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            {t.selectLocation || 'Manzilni tanlang'}
          </Text>
          <TouchableOpacity onPress={getCurrentLocation} disabled={isLoading}>
            <Ionicons 
              name="locate" 
              size={28} 
              color={isLoading ? theme.textTertiary : theme.primary} 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
          {renderMap()}
        </View>

        <View style={[styles.footer, { backgroundColor: theme.surface }]}>
          {address ? (
            <View style={styles.addressContainer}>
              <Ionicons name="location" size={20} color={theme.primary} />
              <Text style={[styles.address, { color: theme.text }]} numberOfLines={2}>
                {address}
              </Text>
            </View>
          ) : null}
          
          <View style={styles.coordsContainer}>
            <Text style={[styles.coords, { color: theme.textSecondary }]}>
              {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
            </Text>
          </View>

          <Button
            title={t.confirm || 'Tasdiqlash'}
            onPress={handleConfirm}
            style={styles.confirmButton}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    ...typography.body,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  address: {
    ...typography.body,
    flex: 1,
  },
  coordsContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  coords: {
    ...typography.small,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  confirmButton: {
    marginTop: spacing.sm,
  },
  // Custom marker styles for mobile
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF4444',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerPin: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF4444',
    marginTop: -2,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  pickerButtonText: {
    ...typography.bodyMedium,
    flex: 1,
  },
});

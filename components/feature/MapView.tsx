import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { spacing, typography, borderRadius } from '../../constants/theme';

// Platform-specific map imports
let MapView: any = null;
let Marker: any = null;
let MapContainer: any = null;
let TileLayer: any = null;
let MapMarker: any = null;
let L: any = null;

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
    L = require('leaflet');
  } catch (e) {
    console.log('Leaflet not loaded');
  }
}

interface MapViewComponentProps {
  latitude: number;
  longitude: number;
  address?: string;
  showNavigation?: boolean;
  height?: number;
}

export function MapViewComponent({ 
  latitude, 
  longitude, 
  address, 
  showNavigation = true,
  height = 200 
}: MapViewComponentProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const handleNavigate = () => {
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });

    if (url) {
      Linking.openURL(url).catch(err => console.error('Error opening maps:', err));
    }
  };

  const renderMap = () => {
    // Mobil platformalar (iOS, Android)
    if (Platform.OS !== 'web' && MapView && Marker) {
      return (
        <MapView
          style={[styles.map, { height }]}
          initialRegion={{
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker coordinate={{ latitude, longitude }} pinColor="#FF4444">
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
      // Custom icon for display map
      const displayIcon = new L.DivIcon({
        html: `
          <div style="
            position: relative;
            width: 40px;
            height: 50px;
            transform: translate(-20px, -50px);
          ">
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="20" cy="48" rx="8" ry="3" fill="rgba(0,0,0,0.2)" />
              <path d="M20 0 C11 0 4 7 4 16 C4 28 20 50 20 50 S36 28 36 16 C36 7 29 0 20 0 Z" 
                    fill="#FF4444" stroke="#CC0000" stroke-width="2"/>
              <circle cx="20" cy="16" r="8" fill="white"/>
              <circle cx="20" cy="16" r="4" fill="#FF4444"/>
            </svg>
          </div>
        `,
        className: '',
        iconSize: [40, 50],
        iconAnchor: [20, 50],
      });

      return (
        <div style={{ 
          height, 
          width: '100%', 
          borderRadius: `${borderRadius.md}px`, 
          overflow: 'hidden',
          position: 'relative'
        }}>
          <MapContainer
            center={[latitude, longitude]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
            dragging={false}
            zoomControl={false}
            attributionControl={false}
            key={`${latitude}-${longitude}`}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
            <MapMarker position={[latitude, longitude]} icon={displayIcon} />
          </MapContainer>
        </div>
      );
    }
    
    // Agar xarita mavjud bo'lmasa - fallback
    return (
      <View style={[styles.mapPlaceholder, { height, backgroundColor: theme.surfaceVariant }]}>
        <Ionicons name="map-outline" size={48} color={theme.textTertiary} />
        <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>
          {t.mapNotAvailable || 'Karta yuklanmoqda...'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderMap()}
      
      {address && (
        <View style={[styles.addressBar, { backgroundColor: theme.surface }]}>
          <Ionicons name="location" size={18} color={theme.primary} />
          <Text style={[styles.address, { color: theme.text }]} numberOfLines={2}>
            {address}
          </Text>
        </View>
      )}

      {showNavigation && (
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: theme.primary }]}
          onPress={handleNavigate}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={20} color="#FFFFFF" />
          <Text style={styles.navText}>{t.navigate || 'Yo\'nalish'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
  },
  mapPlaceholder: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  placeholderText: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  address: {
    ...typography.caption,
    flex: 1,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  navText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  // Custom marker styles
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
});

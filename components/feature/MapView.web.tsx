import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, borderRadius } from '../../constants/theme';

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
  height = 200,
}: MapViewComponentProps) {
  const { theme } = useTheme();
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        if (!isMounted || !mapRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
        }

        const map = L.map(mapRef.current, {
          center: [latitude, longitude],
          zoom: 15,
          zoomControl: false,
          scrollWheelZoom: false,
          dragging: false,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        const icon = L.divIcon({
          html: `<div style="width:24px;height:24px;background:#FF4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        L.marker([latitude, longitude], { icon }).addTo(map);
        mapInstanceRef.current = map;
      } catch (e) {
        console.log('Leaflet init error:', e);
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude]);

  const handleNavigate = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, '_blank');
  };

  return (
    <View style={[styles.container, { borderRadius: borderRadius.md, overflow: 'hidden' }]}>
      <div ref={mapRef} style={{ width: '100%', height }} />

      {address ? (
        <View style={[styles.addressBar, { backgroundColor: theme.surface }]}>
          <Ionicons name="location" size={18} color={theme.primary} />
          <Text style={[styles.address, { color: theme.text }]} numberOfLines={2}>
            {address}
          </Text>
        </View>
      ) : null}

      {showNavigation && (
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: theme.primary }]}
          onPress={handleNavigate}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={20} color="#FFFFFF" />
          <Text style={styles.navText}>Yo'nalish</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  address: { ...typography.caption, flex: 1 },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  navText: { ...typography.bodyMedium, color: '#FFFFFF' },
});

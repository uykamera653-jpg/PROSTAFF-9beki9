import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
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

  const handleNavigate = () => {
    const url = `geo:0,0?q=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
    });
  };

  return (
    <View style={[styles.container, { borderRadius: borderRadius.md, overflow: 'hidden' }]}>
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
        <Marker coordinate={{ latitude, longitude }} pinColor="#FF4444" />
      </MapView>

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
  map: { width: '100%' },
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

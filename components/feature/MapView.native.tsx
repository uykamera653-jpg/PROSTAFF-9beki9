import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
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

  const handleNavigate = () => {
    const url = `geo:0,0?q=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      );
    });
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
  var map = L.map('map', {
    attributionControl: false,
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: false,
    touchZoom: false,
    doubleClickZoom: false
  }).setView([${latitude}, ${longitude}], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  var redIcon = L.divIcon({
    html: '<div style="width:24px;height:24px;background:#FF4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  L.marker([${latitude}, ${longitude}], { icon: redIcon }).addTo(map);
</script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, { borderRadius: borderRadius.md, overflow: 'hidden' }]}>
      <WebView
        source={{ html: mapHtml }}
        style={{ width: '100%', height }}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        pointerEvents="none"
      />

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

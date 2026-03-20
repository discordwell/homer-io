import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useDriverStore, type OrderStop } from '@/stores/driver';
import { C, Size, Spacing, Radius, Base } from '@/theme';

// Dark map style for Google Maps (Android)
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const statusColors: Record<string, string> = {
  delivered: C.green,
  failed: C.red,
  in_transit: C.yellow,
  assigned: C.accent,
  received: C.muted,
};

export default function DriverMapScreen() {
  const mapRef = useRef<MapView>(null);
  const { currentRoute, fetchCurrentRoute } = useDriverStore();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    fetchCurrentRoute();
  }, []);

  // Watch user location
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(true);
        return;
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (loc) => {
          setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        },
      );
    })();

    return () => { subscription?.remove(); };
  }, []);

  // Fit map to show all stops + user location
  useEffect(() => {
    if (!currentRoute?.orders?.length || !mapRef.current) return;

    const coords = currentRoute.orders
      .filter((s) => s.deliveryLat && s.deliveryLng)
      .map((s) => ({ latitude: Number(s.deliveryLat), longitude: Number(s.deliveryLng) }));

    if (userLocation) {
      coords.push({ latitude: userLocation.lat, longitude: userLocation.lng });
    }

    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 120, left: 40 },
        animated: true,
      });
    }
  }, [currentRoute, userLocation]);

  const stops = currentRoute?.orders || [];
  const firstNonCompleted = stops.findIndex(
    (s) => s.status !== 'delivered' && s.status !== 'failed',
  );

  const routeCoords = stops
    .filter((s) => s.deliveryLat && s.deliveryLng)
    .map((s) => ({ latitude: Number(s.deliveryLat!), longitude: Number(s.deliveryLng!) }));

  const completedCount = stops.filter((s) => s.status === 'delivered' || s.status === 'failed').length;

  return (
    <View style={Base.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle="dark"
        initialRegion={{
          latitude: 37.78,
          longitude: -122.42,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {/* Route polyline */}
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={C.accent}
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}

        {/* Stop markers */}
        {stops.map((stop, i) => {
          if (!stop.deliveryLat || !stop.deliveryLng) return null;
          const color = statusColors[stop.status] || C.muted;
          const isNext = i === firstNonCompleted;

          return (
            <Marker
              key={stop.id}
              coordinate={{
                latitude: Number(stop.deliveryLat),
                longitude: Number(stop.deliveryLng),
              }}
              title={stop.recipientName}
              description={`Stop ${stop.stopSequence} — ${stop.status}`}
            >
              <View style={[
                markerStyles.container,
                { backgroundColor: color, borderColor: isNext ? '#fff' : color },
                isNext && markerStyles.next,
              ]}>
                <Text style={markerStyles.text}>{stop.stopSequence ?? '?'}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* GPS status overlay */}
      {locationError && (
        <SafeAreaView style={overlayStyles.gpsWarning} edges={['top']}>
          <Text style={overlayStyles.gpsText}>Location unavailable</Text>
        </SafeAreaView>
      )}

      {/* Route info overlay */}
      {currentRoute && (
        <View style={overlayStyles.routeInfo}>
          <Text style={overlayStyles.routeName}>{currentRoute.name}</Text>
          <Text style={overlayStyles.routeMeta}>
            {completedCount}/{stops.length} stops completed
          </Text>
          <View style={overlayStyles.progressTrack}>
            <View
              style={[
                overlayStyles.progressFill,
                {
                  width: stops.length > 0 ? `${(completedCount / stops.length) * 100}%` as `${number}%` : '0%',
                  backgroundColor: completedCount === stops.length ? C.green : C.accent,
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const markerStyles = StyleSheet.create({
  container: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  next: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#fff',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});

const overlayStyles = StyleSheet.create({
  gpsWarning: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  gpsText: {
    color: '#fff',
    fontSize: Size.sm,
    fontWeight: '600',
  },
  routeInfo: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: 'rgba(6, 9, 15, 0.92)',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  routeName: {
    fontSize: Size.lg,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  routeMeta: {
    fontSize: Size.sm,
    color: C.dim,
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: C.muted,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});

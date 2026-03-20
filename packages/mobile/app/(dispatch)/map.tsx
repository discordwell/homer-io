import { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTrackingStore, type DriverLocation } from '@/stores/tracking';
import { useSocket } from '@/hooks/useSocket';
import { C, Size, Spacing, Radius, Base } from '@/theme';

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const statusColors: Record<string, string> = {
  available: C.green,
  on_route: C.yellow,
  on_break: C.orange,
  offline: C.muted,
};

export default function FleetMapScreen() {
  const socket = useSocket();
  const { driverLocations, fetchDriverLocations, subscribeToUpdates, unsubscribe } = useTrackingStore();

  useEffect(() => {
    fetchDriverLocations();
  }, []);

  useEffect(() => {
    if (!socket) return;
    subscribeToUpdates(socket);
    return () => unsubscribe(socket);
  }, [socket]);

  const drivers = Array.from(driverLocations.values());

  return (
    <View style={Base.screen}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
        userInterfaceStyle="dark"
        initialRegion={{
          latitude: 37.78,
          longitude: -122.42,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
      >
        {drivers.map((driver) => (
          <Marker
            key={driver.driverId}
            coordinate={{ latitude: driver.lat, longitude: driver.lng }}
            title={driver.driverName}
          >
            <View style={[
              markerStyles.dot,
              { backgroundColor: statusColors[driver.driverStatus] || C.muted },
            ]}>
              <Text style={markerStyles.initial}>
                {driver.driverName[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <Callout>
              <View style={markerStyles.callout}>
                <Text style={markerStyles.calloutName}>{driver.driverName}</Text>
                <Text style={markerStyles.calloutStatus}>{driver.driverStatus}</Text>
                {driver.speed != null && (
                  <Text style={markerStyles.calloutMeta}>
                    {Math.round(driver.speed * 3.6)} km/h
                  </Text>
                )}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Driver count overlay */}
      <View style={overlayStyles.badge}>
        <Text style={overlayStyles.badgeText}>
          {drivers.length} driver{drivers.length !== 1 ? 's' : ''} online
        </Text>
      </View>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  callout: {
    width: 140,
    padding: 8,
  },
  calloutName: {
    fontWeight: '600',
    fontSize: 14,
  },
  calloutStatus: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  calloutMeta: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});

const overlayStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(6, 9, 15, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: C.border,
  },
  badgeText: {
    color: C.text,
    fontSize: Size.sm,
    fontWeight: '600',
  },
});

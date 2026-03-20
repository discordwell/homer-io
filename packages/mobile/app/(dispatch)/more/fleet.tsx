import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFleetStore, type Driver, type Vehicle } from '@/stores/fleet';
import { Badge } from '@/components/Badge';
import { C, Size, Spacing, Radius, Base } from '@/theme';

const driverStatusColors: Record<string, string> = {
  available: 'green', on_route: 'yellow', on_break: 'orange', offline: 'dim',
};

export default function FleetScreen() {
  const { drivers, vehicles, loading, fetchDrivers, fetchVehicles } = useFleetStore();
  const [tab, setTab] = useState<'drivers' | 'vehicles'>('drivers');

  useEffect(() => { fetchDrivers(); fetchVehicles(); }, []);

  return (
    <SafeAreaView style={Base.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Fleet</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        <TabButton label={`Drivers (${drivers.length})`} active={tab === 'drivers'} onPress={() => setTab('drivers')} />
        <TabButton label={`Vehicles (${vehicles.length})`} active={tab === 'vehicles'} onPress={() => setTab('vehicles')} />
      </View>

      {tab === 'drivers' ? (
        <FlatList
          data={drivers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>{item.email}</Text>
              </View>
              <Badge color={driverStatusColors[item.status] || 'dim'}>{item.status}</Badge>
            </View>
          )}
          refreshing={loading}
          onRefresh={fetchDrivers}
        />
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: C.bg3 }]}>
                <Text style={styles.vehicleIcon}>🚗</Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>{item.licensePlate} {'\u00B7'} {item.type}</Text>
              </View>
              <Badge color={item.isActive ? 'green' : 'dim'}>
                {item.isActive ? 'active' : 'inactive'}
              </Badge>
            </View>
          )}
          refreshing={loading}
          onRefresh={fetchVehicles}
        />
      )}
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={[styles.tabText, active && styles.tabTextActive]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontSize: Size.xxl, fontWeight: '700', color: C.text },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.lg, marginBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: Spacing.md },
  tabText: { fontSize: Size.md, color: C.muted, fontWeight: '500', paddingVertical: 4 },
  tabTextActive: { color: C.accent, fontWeight: '700', borderBottomWidth: 2, borderBottomColor: C.accent },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#000', fontSize: Size.lg, fontWeight: '700' },
  vehicleIcon: { fontSize: 20 },
  rowContent: { flex: 1 },
  rowName: { fontSize: Size.md, fontWeight: '600', color: C.text },
  rowMeta: { fontSize: Size.sm, color: C.dim, marginTop: 2 },
});

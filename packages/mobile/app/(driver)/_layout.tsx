import { Tabs } from 'expo-router';
import { TabIcon } from '@/components/TabIcon';
import { tabScreenOptions } from '@/components/tabBarOptions';

export default function DriverLayout() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="route"
        options={{
          title: 'Route',
          tabBarIcon: ({ color }) => <TabIcon name="route" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <TabIcon name="map" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
      {/* Hide stop detail from tabs — it's a pushed screen */}
      <Tabs.Screen name="stop" options={{ href: null }} />
    </Tabs>
  );
}

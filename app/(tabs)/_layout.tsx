import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { MediCareProvider, useMediCare } from "@/lib/medicare-store";

function MediCareTabs() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useMediCare();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0B776B",
        tabBarInactiveTintColor: "#78938C",
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E4EFEC",
          height: 57 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: undefined, fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color }) => <MaterialIcons name="home-filled" size={24} color={color} /> }} />
      <Tabs.Screen name="visits" options={{ title: "الزيارات", tabBarIcon: ({ color }) => <MaterialIcons name="calendar-month" size={24} color={color} /> }} />
      <Tabs.Screen name="reports" options={{ title: "التقارير", tabBarIcon: ({ color }) => <MaterialIcons name="description" size={23} color={color} /> }} />
      <Tabs.Screen name="invoices" options={{ title: "الفواتير", tabBarIcon: ({ color }) => <MaterialIcons name="receipt-long" size={23} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "الحساب", tabBarBadge: unreadCount || undefined, tabBarBadgeStyle: { backgroundColor: "#B6403A", color: "#FFFFFF", fontSize: 10 }, tabBarIcon: ({ color }) => <MaterialIcons name="person" size={24} color={color} /> }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="book" options={{ href: null }} />
      <Tabs.Screen name="visit/[id]" options={{ href: null }} />
      <Tabs.Screen name="report/[id]" options={{ href: null }} />
      <Tabs.Screen name="invoice/[id]" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  return <MediCareProvider><MediCareTabs /></MediCareProvider>;
}

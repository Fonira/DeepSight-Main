import React from "react";
import { Tabs } from "expo-router";
import { CustomTabBar } from "@/components/navigation/CustomTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Bibliothèque",
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Recherche",
        }}
      />
      <Tabs.Screen
        name="hub"
        options={{
          title: "Hub",
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: "Étude & Chat",
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          title: "Abonnement",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
        }}
      />
      {/* Routes cachées de la tab bar */}
      <Tabs.Screen
        name="analysis/[id]"
        options={{
          href: null,
          title: "Analyse",
        }}
      />
    </Tabs>
  );
}

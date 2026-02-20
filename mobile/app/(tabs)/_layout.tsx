import React from 'react';
import { Tabs } from 'expo-router';
import { CustomTabBar } from './CustomTabBar';
import { darkColors } from '@/theme/colors';

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
          title: 'Accueil',
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Bibliothèque',
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: 'Étude',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
        }}
      />
      <Tabs.Screen
        name="analysis/[id]"
        options={{
          href: null,
          title: 'Analyse',
        }}
      />
    </Tabs>
  );
}

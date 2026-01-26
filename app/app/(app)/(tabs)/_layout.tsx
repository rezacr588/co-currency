import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { LayoutDashboard, Wallet, Target, BarChart3, Plus } from 'lucide-react-native';
import { useTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';

export default function TabsLayout() {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const tabBarActiveTintColor = 'rgb(212, 175, 55)';
  const tabBarInactiveTintColor = 'rgb(148, 163, 184)';
  const tabBarBackgroundColor = isDark ? 'rgb(30, 58, 95)' : 'rgb(255, 255, 255)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor,
        tabBarInactiveTintColor,
        tabBarStyle: {
          backgroundColor: tabBarBackgroundColor,
          borderTopWidth: 0,
          elevation: 0,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard'),
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t('wallet'),
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View className="bg-accent rounded-full p-4 -mt-8">
              <Plus size={24} color="rgb(15, 26, 42)" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: t('financialGoals'),
          tabBarIcon: ({ color, size }) => <Target size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t('reports'),
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

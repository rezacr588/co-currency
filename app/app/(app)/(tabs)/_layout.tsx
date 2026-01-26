import { useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { View, Text, Pressable, useWindowDimensions, ScrollView } from 'react-native';
import {
  LayoutDashboard,
  Wallet,
  Target,
  BarChart3,
  Plus,
  User,
  Settings,
  Trophy,
  History,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useAuth } from '../../../src/context/AuthContext';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 80;

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  isActive: boolean;
  onPress: () => void;
  isCollapsed?: boolean;
}

function NavItem({ icon, label, isActive, onPress, isCollapsed }: NavItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{ cursor: 'pointer' }}
      className={`flex-row items-center px-4 py-3 rounded-xl mb-1 ${
        isActive ? 'bg-primary/20' : 'hover:bg-card'
      }`}
    >
      <View className={isActive ? 'text-primary' : 'text-muted-foreground'}>{icon}</View>
      {!isCollapsed && (
        <Text
          className={`ml-3 font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function DesktopSidebar({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const mainNavItems = [
    { icon: <LayoutDashboard size={22} />, label: t('dashboard'), href: '/(app)/(tabs)' },
    { icon: <Wallet size={22} />, label: t('wallet'), href: '/(app)/(tabs)/wallet' },
    { icon: <Plus size={22} />, label: t('addTransaction') || 'Add', href: '/(app)/(tabs)/add' },
    { icon: <Target size={22} />, label: t('financialGoals'), href: '/(app)/(tabs)/goals' },
    { icon: <BarChart3 size={22} />, label: t('reports'), href: '/(app)/(tabs)/reports' },
  ];

  const toolsNavItems = [
    { icon: <Trophy size={22} />, label: t('badges') || 'Badges', href: '/(app)/badges' },
    { icon: <History size={22} />, label: t('historicalRates') || 'Historical', href: '/(app)/historical' },
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/(app)/(tabs)') {
      return pathname === '/' || pathname === '/(app)/(tabs)' || pathname === '/index';
    }
    return pathname.includes(href.replace('/(app)', '').replace('/(tabs)', ''));
  };

  return (
    <View
      className="bg-card border-r border-border h-full"
      style={{ width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
    >
      {/* Logo/Header */}
      <View className="p-4 border-b border-border flex-row items-center justify-between">
        {!isCollapsed && (
          <Text className="text-xl font-bold text-primary">CoFinance</Text>
        )}
        <Pressable onPress={onToggle} style={{ cursor: 'pointer' }} className="p-2">
          {isCollapsed ? (
            <Menu size={20} color="rgb(148, 163, 184)" />
          ) : (
            <X size={20} color="rgb(148, 163, 184)" />
          )}
        </Pressable>
      </View>

      {/* Navigation */}
      <ScrollView className="flex-1 p-3">
        {/* Main Navigation */}
        <View className="mb-6">
          {!isCollapsed && (
            <Text className="text-xs text-muted-foreground uppercase tracking-wider px-4 mb-2">
              {t('main') || 'Main'}
            </Text>
          )}
          {mainNavItems.map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={isActiveRoute(item.href)}
              onPress={() => router.push(item.href as any)}
              isCollapsed={isCollapsed}
            />
          ))}
        </View>

        {/* Tools */}
        <View>
          {!isCollapsed && (
            <Text className="text-xs text-muted-foreground uppercase tracking-wider px-4 mb-2">
              {t('tools') || 'Tools'}
            </Text>
          )}
          {toolsNavItems.map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={isActiveRoute(item.href)}
              onPress={() => router.push(item.href as any)}
              isCollapsed={isCollapsed}
            />
          ))}
        </View>
      </ScrollView>

      {/* User Section */}
      <View className="p-3 border-t border-border">
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          style={{ cursor: 'pointer' }}
          className="flex-row items-center p-3 rounded-xl hover:bg-muted"
        >
          <View className="bg-primary/20 p-2 rounded-full">
            <User size={20} color="rgb(212, 175, 55)" />
          </View>
          {!isCollapsed && (
            <View className="flex-1 ml-3">
              <Text className="font-medium text-foreground" numberOfLines={1}>
                {user?.name}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          )}
          {!isCollapsed && <ChevronRight size={16} color="rgb(148, 163, 184)" />}
        </Pressable>

        <Pressable
          onPress={logout}
          style={{ cursor: 'pointer' }}
          className="flex-row items-center p-3 rounded-xl hover:bg-danger/10 mt-1"
        >
          <LogOut size={20} color="rgb(220, 38, 38)" />
          {!isCollapsed && (
            <Text className="ml-3 text-danger font-medium">{t('logout')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function DesktopNavbar() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const router = useRouter();

  return (
    <View className="bg-card border-b border-border px-6 py-4 flex-row items-center justify-between">
      <View>
        <Text className="text-muted-foreground text-sm">{t('welcomeBack')}</Text>
        <Text className="text-xl font-bold text-foreground">{user?.name}</Text>
      </View>

      <View className="flex-row items-center gap-4">
        <Pressable
          onPress={toggleTheme}
          style={{ cursor: 'pointer' }}
          className="p-2 rounded-lg hover:bg-muted"
        >
          {isDark ? (
            <LayoutDashboard size={20} color="rgb(212, 175, 55)" />
          ) : (
            <LayoutDashboard size={20} color="rgb(148, 163, 184)" />
          )}
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          style={{ cursor: 'pointer' }}
          className="flex-row items-center gap-2 bg-muted px-4 py-2 rounded-xl"
        >
          <View className="bg-primary/20 p-1.5 rounded-full">
            <User size={16} color="rgb(212, 175, 55)" />
          </View>
          <Text className="font-medium text-foreground">{user?.name?.split(' ')[0]}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const tabBarActiveTintColor = 'rgb(212, 175, 55)';
  const tabBarInactiveTintColor = 'rgb(148, 163, 184)';
  const tabBarBackgroundColor = isDark ? 'rgb(30, 58, 95)' : 'rgb(255, 255, 255)';

  // Desktop layout with sidebar
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-background">
        <DesktopSidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <View className="flex-1">
          <DesktopNavbar />
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' },
            }}
          >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="wallet" />
            <Tabs.Screen name="add" />
            <Tabs.Screen name="goals" />
            <Tabs.Screen name="reports" />
          </Tabs>
        </View>
      </View>
    );
  }

  // Tablet layout - sidebar but collapsed by default
  if (isTablet) {
    return (
      <View className="flex-1 flex-row bg-background">
        <DesktopSidebar
          isCollapsed={true}
          onToggle={() => {}}
        />
        <View className="flex-1">
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' },
            }}
          >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="wallet" />
            <Tabs.Screen name="add" />
            <Tabs.Screen name="goals" />
            <Tabs.Screen name="reports" />
          </Tabs>
        </View>
      </View>
    );
  }

  // Mobile layout - bottom tabs
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

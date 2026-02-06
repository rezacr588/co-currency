import { useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { View, Text, Pressable, useWindowDimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Wallet,
  MessageCircle,
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
      className={`flex-row items-center px-3 py-2.5 rounded-lg mb-0.5 ${
        isActive ? 'bg-secondary' : 'hover:bg-secondary/50'
      }`}
    >
      <View style={{ opacity: isActive ? 1 : 0.6 }}>{icon}</View>
      {!isCollapsed && (
        <Text
          className={`ml-3 text-sm ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
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
    { icon: <LayoutDashboard size={20} color="#a1a1aa" />, label: t('dashboard'), href: '/(app)/(tabs)' },
    { icon: <Wallet size={20} color="#a1a1aa" />, label: t('wallet'), href: '/(app)/(tabs)/wallet' },
    { icon: <Plus size={20} color="#a1a1aa" />, label: t('addTransaction') || 'Add', href: '/(app)/(tabs)/add' },
    { icon: <MessageCircle size={20} color="#a1a1aa" />, label: t('aiAdvisor') || 'Chatbot', href: '/(app)/(tabs)/chat' },
    { icon: <BarChart3 size={20} color="#a1a1aa" />, label: t('reports'), href: '/(app)/(tabs)/reports' },
  ];

  const toolsNavItems = [
    { icon: <Trophy size={20} color="#a1a1aa" />, label: t('badges') || 'Badges', href: '/(app)/badges' },
    { icon: <History size={20} color="#a1a1aa" />, label: t('historicalRates') || 'Historical', href: '/(app)/historical' },
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/(app)/(tabs)') {
      return pathname === '/' || pathname === '/(app)/(tabs)' || pathname === '/index';
    }
    return pathname.includes(href.replace('/(app)', '').replace('/(tabs)', ''));
  };

  return (
    <View
      className="bg-background border-r border-border h-full"
      style={{ width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
    >
      {/* Logo/Header */}
      <View className="p-4 border-b border-border flex-row items-center justify-between">
        {!isCollapsed && (
          <Text className="text-lg font-semibold text-foreground">CoFinance</Text>
        )}
        <Pressable onPress={onToggle} style={{ cursor: 'pointer' }} className="p-2 hover:bg-secondary rounded-md">
          {isCollapsed ? (
            <Menu size={18} color="#71717a" />
          ) : (
            <X size={18} color="#71717a" />
          )}
        </Pressable>
      </View>

      {/* Navigation */}
      <ScrollView className="flex-1 p-3">
        {/* Main Navigation */}
        <View className="mb-6">
          {!isCollapsed && (
            <Text className="text-xs text-muted-foreground uppercase tracking-wider px-3 mb-2">
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
            <Text className="text-xs text-muted-foreground uppercase tracking-wider px-3 mb-2">
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
          className="flex-row items-center p-2.5 rounded-lg hover:bg-secondary"
        >
          <View className="bg-secondary p-2 rounded-full">
            <User size={18} color="#a1a1aa" />
          </View>
          {!isCollapsed && (
            <View className="flex-1 ml-3">
              <Text className="font-medium text-foreground text-sm" numberOfLines={1}>
                {user?.name}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          )}
          {!isCollapsed && <ChevronRight size={14} color="#71717a" />}
        </Pressable>

        <Pressable
          onPress={logout}
          style={{ cursor: 'pointer' }}
          className="flex-row items-center p-2.5 rounded-lg hover:bg-secondary mt-1"
        >
          <LogOut size={18} color="#71717a" />
          {!isCollapsed && (
            <Text className="ml-3 text-muted-foreground text-sm">{t('logout')}</Text>
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
    <View className="bg-background border-b border-border px-6 py-4 flex-row items-center justify-between">
      <View>
        <Text className="text-muted-foreground text-xs">{t('welcomeBack')}</Text>
        <Text className="text-lg font-semibold text-foreground">{user?.name}</Text>
      </View>

      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={toggleTheme}
          style={{ cursor: 'pointer' }}
          className="p-2 rounded-md hover:bg-secondary border border-border"
        >
          {isDark ? (
            <LayoutDashboard size={18} color="#a1a1aa" />
          ) : (
            <LayoutDashboard size={18} color="#71717a" />
          )}
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          style={{ cursor: 'pointer' }}
          className="flex-row items-center gap-2 bg-secondary border border-border px-3 py-2 rounded-lg"
        >
          <View className="bg-muted p-1.5 rounded-full">
            <User size={14} color="#a1a1aa" />
          </View>
          <Text className="font-medium text-foreground text-sm">{user?.name?.split(' ')[0]}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  // Sidebar collapsed by default on tablet, expanded on desktop
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(!isDesktop);

  // Minimal color palette for tab bar
  const tabBarActiveTintColor = '#fafafa';
  const tabBarInactiveTintColor = '#71717a';
  const tabBarBackgroundColor = '#09090b';

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
            <Tabs.Screen name="chat" />
            <Tabs.Screen name="reports" />
            <Tabs.Screen name="goals" options={{ href: null }} />
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
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
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
            <Tabs.Screen name="chat" />
            <Tabs.Screen name="reports" />
            <Tabs.Screen name="goals" options={{ href: null }} />
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
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: tabBarBackgroundColor,
          borderTopWidth: 1,
          borderTopColor: '#27272a',
          elevation: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 10,
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
            <View className="bg-foreground rounded-full p-3.5" style={{ marginTop: -24 }}>
              <Plus size={22} color="#09090b" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('aiAdvisor') || 'Chatbot',
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t('reports'),
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="goals" options={{ href: null }} />
    </Tabs>
  );
}

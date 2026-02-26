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
  Trophy,
  History,
  Menu,
  X,
  LogOut,
  ChevronRight,
  KanbanSquare,
  Sun,
  Moon,
} from 'lucide-react-native';
import { useTheme as useThemeContext } from '../../../src/context/ThemeContext';
import { useTheme as useStyledTheme } from 'styled-components/native';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useAuth } from '../../../src/context/AuthContext';
import { ErrorBoundary } from '../../../src/components/ui/ErrorBoundary';
import { AppSwitcherTrigger } from '../../../src/components/navigation/AppSwitcherTrigger';

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
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 2, backgroundColor: isActive ? colors.secondary : 'transparent' }, pressed && { opacity: 0.7 }]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <View style={{ opacity: isActive ? 1 : 0.6 }}>{icon}</View>
      {!isCollapsed && (
        <Text
          style={{ marginLeft: 12, fontSize: 14, color: isActive ? colors.foreground : colors.mutedForeground, fontFamily: isActive ? 'Inter_500Medium' : undefined }}
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
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const router = useRouter();
  const pathname = usePathname();

  const mainNavItems = [
    { icon: <LayoutDashboard size={20} color={colors.secondaryForeground} />, label: t('dashboard'), href: '/(app)/(tabs)' },
    { icon: <Wallet size={20} color={colors.secondaryForeground} />, label: t('wallet'), href: '/(app)/(tabs)/wallet' },
    { icon: <Plus size={20} color={colors.secondaryForeground} />, label: t('addTransaction') || 'Add', href: '/(app)/(tabs)/add' },
    { icon: <MessageCircle size={20} color={colors.secondaryForeground} />, label: t('aiAdvisor') || 'Chatbot', href: '/(app)/(tabs)/chat' },
    { icon: <BarChart3 size={20} color={colors.secondaryForeground} />, label: t('reports'), href: '/(app)/(tabs)/reports' },
  ];

  const toolsNavItems = [
    { icon: <Trophy size={20} color={colors.secondaryForeground} />, label: t('badges') || 'Badges', href: '/(app)/badges' },
    { icon: <History size={20} color={colors.secondaryForeground} />, label: t('historicalRates') || 'Historical', href: '/(app)/historical' },
    { icon: <KanbanSquare size={20} color={colors.secondaryForeground} />, label: 'Planner', href: '/todo' },
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/(app)/(tabs)') {
      return pathname === '/' || pathname === '/(app)/(tabs)' || pathname === '/index';
    }
    return pathname.includes(href.replace('/(app)', '').replace('/(tabs)', ''));
  };

  return (
    <View
      style={{ backgroundColor: colors.background, borderRightWidth: 1, borderRightColor: colors.border, height: '100%', width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
    >
      {/* Logo/Header */}
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {!isCollapsed && (
          <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>CoFinance</Text>
        )}
        <Pressable onPress={onToggle} hitSlop={8} style={({ pressed }) => [{ cursor: 'pointer', padding: 8, borderRadius: 6 }, pressed && { opacity: 0.7 }]} accessibilityLabel={isCollapsed ? (t('expandSidebar') || 'Expand sidebar') : (t('collapseSidebar') || 'Collapse sidebar')} accessibilityRole="button">
          {isCollapsed ? (
            <Menu size={18} color={colors.mutedForeground} />
          ) : (
            <X size={18} color={colors.mutedForeground} />
          )}
        </Pressable>
      </View>

      {/* Navigation */}
      <ScrollView style={{ flex: 1, padding: 12 }}>
        {/* Main Navigation */}
        <View style={{ marginBottom: 24 }}>
          {!isCollapsed && (
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 12, marginBottom: 8 }}>
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
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 12, marginBottom: 8 }}>
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
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          style={({ pressed }) => [{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8 }, pressed && { opacity: 0.7 }]}
          accessibilityLabel={t('profile') || 'Profile'}
          accessibilityRole="button"
        >
          <View style={{ backgroundColor: colors.secondary, padding: 8, borderRadius: 9999 }}>
            <User size={18} color={colors.secondaryForeground} />
          </View>
          {!isCollapsed && (
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontFamily: 'Inter_500Medium', color: colors.foreground, fontSize: 14 }} numberOfLines={1}>
                {user?.name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          )}
          {!isCollapsed && <ChevronRight size={14} color={colors.mutedForeground} />}
        </Pressable>

        <Pressable
          onPress={logout}
          style={({ pressed }) => [{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, marginTop: 4 }, pressed && { opacity: 0.7 }]}
          accessibilityLabel={t('logout') || 'Logout'}
          accessibilityRole="button"
        >
          <LogOut size={18} color={colors.mutedForeground} />
          {!isCollapsed && (
            <Text style={{ marginLeft: 12, color: colors.mutedForeground, fontSize: 14 }}>{t('logout')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function DesktopNavbar() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isDark } = useThemeContext();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;

  return (
    <View style={{ backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('welcomeBack')}</Text>
        <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{user?.name}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.secondary,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 12,
          }}
        >
          {isDark ? <Moon size={14} color={colors.accent} /> : <Sun size={14} color={colors.accent} />}
          <Text style={{ fontFamily: 'Inter_500Medium', color: colors.foreground, fontSize: 13 }}>{user?.name?.split(' ')[0]}</Text>
        </View>
        <AppSwitcherTrigger variant="header_inline" />
      </View>
    </View>
  );
}

function TabsLayoutInner() {
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  // Sidebar collapsed by default on tablet, expanded on desktop
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(!isDesktop);

  // Desktop layout with sidebar
  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
        <DesktopSidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <View style={{ flex: 1 }}>
          <DesktopNavbar />
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' },
            }}
          >
            <Tabs.Screen name="index" />
            <Tabs.Screen
              name="wallet"
              options={{
                popToTopOnBlur: true,
              }}
            />
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
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
        <DesktopSidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <View style={{ flex: 1 }}>
          <View
            style={{
              paddingHorizontal: 14,
              paddingTop: Math.max(insets.top, 10),
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.background,
              alignItems: 'flex-end',
            }}
          >
            <AppSwitcherTrigger variant="header_inline" />
          </View>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' },
            }}
          >
            <Tabs.Screen name="index" />
            <Tabs.Screen
              name="wallet"
              options={{
                popToTopOnBlur: true,
              }}
            />
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.tabBarActive,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: 'Inter_500Medium',
            marginTop: -2,
          },
          tabBarStyle: {
            backgroundColor: colors.tabBarBackground,
            borderTopWidth: 1,
            borderTopColor: colors.tabBarBorder,
            elevation: 0,
            height: 70 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
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
            popToTopOnBlur: true,
            tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarShowLabel: false,
            tabBarIcon: ({ focused }) => (
              <View
                style={{
                  backgroundColor: colors.foreground,
                  borderRadius: 50,
                  padding: 14,
                  marginTop: -24,
                }}
              >
                <Plus size={22} color={colors.background} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: t('aiAdvisor') || 'Chat',
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

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: 14,
          bottom: insets.bottom + 68,
        }}
      >
        <AppSwitcherTrigger variant="floating_tab" />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <ErrorBoundary>
      <TabsLayoutInner />
    </ErrorBoundary>
  );
}

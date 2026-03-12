import { useEffect, useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BarChart3,
  History,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Sun,
  Trophy,
  User,
  Wallet,
} from 'lucide-react-native';
import { useTheme as useStyledTheme } from 'styled-components/native';
import { useTheme as useThemeContext } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { useAuth } from '../../../src/context/AuthContext';
import { ErrorBoundary } from '../../../src/components/ui/ErrorBoundary';
import { AppSwitcherTrigger } from '../../../src/components/navigation/AppSwitcherTrigger';
import { useScreenLayout } from '../../../src/hooks/useScreenLayout';
import { isTodoPath } from '../../../src/navigation/mode';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  isActive: boolean;
  isCollapsed: boolean;
  onPress: () => void;
}

function NavItem({ icon, label, isActive, isCollapsed, onPress }: NavItemProps) {
  const theme = useStyledTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          paddingHorizontal: isCollapsed ? 0 : 12,
          borderRadius: theme.radii.md,
          backgroundColor: isActive ? theme.colors.secondary : 'transparent',
          borderWidth: isActive ? 1 : 0,
          borderColor: isActive ? theme.colors.border : 'transparent',
        },
        pressed && { opacity: 0.72 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      <View style={{ opacity: isActive ? 1 : 0.8 }}>{icon}</View>
      {!isCollapsed ? (
        <Text
          style={{
            marginStart: 12,
            color: isActive ? theme.colors.foreground : theme.colors.mutedForeground,
            fontSize: 14,
            fontFamily: isActive ? theme.typography.bodyMedium.fontFamily : theme.typography.body.fontFamily,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SidebarSection({
  title,
  children,
  isCollapsed,
}: {
  title: string;
  children: React.ReactNode;
  isCollapsed: boolean;
}) {
  const theme = useStyledTheme();

  return (
    <View style={{ marginBottom: theme.spacing.xl }}>
      {!isCollapsed ? (
        <Text
          style={{
            marginBottom: theme.spacing.sm,
            paddingHorizontal: 12,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: theme.colors.mutedForeground,
            fontFamily: theme.typography.label.fontFamily,
          }}
        >
          {title}
        </Text>
      ) : null}
      <View style={{ gap: 4 }}>{children}</View>
    </View>
  );
}

function AppSidebar({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const theme = useStyledTheme();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const railWidth = isCollapsed ? theme.layout.navRailWidth.collapsed : theme.layout.navRailWidth.expanded;

  const mainItems = [
    { href: '/(app)/(tabs)', label: t('dashboard'), icon: <LayoutDashboard size={18} color={theme.colors.secondaryForeground} /> },
    { href: '/(app)/(tabs)/wallet', label: t('wallet'), icon: <Wallet size={18} color={theme.colors.secondaryForeground} /> },
    { href: '/(app)/(tabs)/add', label: t('addTransaction') || 'Add', icon: <Plus size={18} color={theme.colors.secondaryForeground} /> },
    { href: '/(app)/(tabs)/chat', label: t('aiAdvisor') || 'Chat', icon: <MessageCircle size={18} color={theme.colors.secondaryForeground} /> },
    { href: '/(app)/(tabs)/reports', label: t('reports'), icon: <BarChart3 size={18} color={theme.colors.secondaryForeground} /> },
  ];

  const utilityItems = [
    { href: '/(app)/badges', label: t('badges') || 'Badges', icon: <Trophy size={18} color={theme.colors.secondaryForeground} /> },
    { href: '/(app)/historical', label: t('historicalRates') || 'Historical', icon: <History size={18} color={theme.colors.secondaryForeground} /> },
    { href: '/todo', label: t('planner') || 'Planner', icon: <KanbanSquare size={18} color={theme.colors.secondaryForeground} /> },
  ];

  const isRouteActive = (href: string) => {
    if (href === '/(app)/(tabs)') {
      return pathname === '/' || pathname === '/(app)/(tabs)' || pathname === '/(app)/(tabs)/index' || pathname === '/index';
    }

    if (href === '/todo') {
      return isTodoPath(pathname);
    }

    return pathname.includes(href.replace('/(app)', '').replace('/(tabs)', ''));
  };

  return (
    <View
      style={{
        width: railWidth,
        backgroundColor: theme.colors.background,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border,
      }}
    >
      <View
        style={{
          minHeight: theme.layout.headerHeight,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        {!isCollapsed ? (
          <Text
            style={{
              fontSize: 18,
              lineHeight: 24,
              fontFamily: theme.typography.h2.fontFamily,
              color: theme.colors.foreground,
            }}
          >
            CoAI
          </Text>
        ) : null}
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          style={({ pressed }) => [
            {
              width: 36,
              height: 36,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            },
            pressed && { opacity: 0.72 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isCollapsed ? (t('expandSidebar') || 'Expand sidebar') : (t('collapseSidebar') || 'Collapse sidebar')}
        >
          <Menu size={16} color={theme.colors.foreground} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <SidebarSection title={t('main') || 'Main'} isCollapsed={isCollapsed}>
          {mainItems.map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={isRouteActive(item.href)}
              isCollapsed={isCollapsed}
              onPress={() => router.push(item.href as any)}
            />
          ))}
        </SidebarSection>

        <SidebarSection title={t('tools') || 'Tools'} isCollapsed={isCollapsed}>
          {utilityItems.map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={isRouteActive(item.href)}
              isCollapsed={isCollapsed}
              onPress={() => router.push(item.href as any)}
            />
          ))}
        </SidebarSection>
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          padding: 12,
        }}
      >
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          style={({ pressed }) => [
            {
              minHeight: 48,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              paddingHorizontal: isCollapsed ? 0 : 10,
              borderRadius: theme.radii.md,
            },
            pressed && { opacity: 0.72 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('profile') || 'Profile'}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: theme.radii.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.secondary,
            }}
          >
            <User size={16} color={theme.colors.secondaryForeground} />
          </View>
          {!isCollapsed ? (
            <View style={{ flex: 1, marginStart: 12 }}>
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontSize: 14,
                  fontFamily: theme.typography.bodyMedium.fontFamily,
                }}
                numberOfLines={1}
              >
                {user?.name}
              </Text>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={logout}
          style={({ pressed }) => [
            {
              minHeight: 44,
              marginTop: 4,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              paddingHorizontal: isCollapsed ? 0 : 10,
              borderRadius: theme.radii.md,
            },
            pressed && { opacity: 0.72 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('logout') || 'Logout'}
        >
          <LogOut size={16} color={theme.colors.mutedForeground} />
          {!isCollapsed ? (
            <Text
              style={{
                marginStart: 12,
                color: theme.colors.mutedForeground,
                fontSize: 14,
              }}
            >
              {t('logout')}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

function UtilityBar() {
  const theme = useStyledTheme();
  const { isDark, toggleTheme } = useThemeContext();

  return (
    <View
      style={{
        minHeight: theme.layout.headerHeight,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.background,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
      }}
    >
      <Pressable
        onPress={toggleTheme}
        style={({ pressed }) => [
          {
            width: 40,
            height: 40,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
            alignItems: 'center',
            justifyContent: 'center',
          },
          pressed && { opacity: 0.72 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          <Sun size={18} color={theme.colors.foreground} />
        ) : (
          <Moon size={18} color={theme.colors.foreground} />
        )}
      </Pressable>
      <AppSwitcherTrigger variant="header_inline" />
    </View>
  );
}

function TabScreens() {
  return (
    <>
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
    </>
  );
}

function TabsLayoutInner() {
  const theme = useStyledTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { isCompactPhone, isDesktop, isTablet } = useScreenLayout();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const compactTabLabels = {
    index: t('dashboardTabCompact') || t('home') || 'Home',
    wallet: t('walletTabCompact') || t('wallet') || 'Wallet',
    add: t('addTabCompact') || 'Add',
    chat: t('aiAdvisorTabCompact') || 'AI',
    reports: t('reportsTabCompact') || t('reports') || 'Reports',
  };

  useEffect(() => {
    if (isDesktop) {
      setIsSidebarCollapsed(false);
      return;
    }

    if (isTablet) {
      setIsSidebarCollapsed(true);
    }
  }, [isDesktop, isTablet]);

  if (isDesktop || isTablet) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.colors.background }}>
        <AppSidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <View style={{ flex: 1 }}>
          <UtilityBar />
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' },
              sceneStyle: { backgroundColor: theme.colors.background },
            }}
          >
            <TabScreens />
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.colors.background },
          tabBarActiveTintColor: theme.colors.tabBarActive,
          tabBarInactiveTintColor: theme.colors.tabBarInactive,
          tabBarLabelStyle: {
            fontSize: isCompactPhone ? 10 : 11,
            fontFamily: theme.typography.bodyMedium.fontFamily,
            marginTop: isCompactPhone ? 1 : 2,
          },
          tabBarStyle: {
            height: (isCompactPhone ? 60 : 64) + insets.bottom,
            paddingTop: isCompactPhone ? 6 : 8,
            paddingBottom: Math.max(insets.bottom, isCompactPhone ? 6 : 8),
            borderTopWidth: 1,
            borderTopColor: theme.colors.tabBarBorder,
            backgroundColor: theme.colors.tabBarBackground,
            elevation: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: compactTabLabels.index,
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="wallet"
          options={{
            title: compactTabLabels.wallet,
            popToTopOnBlur: true,
            tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: compactTabLabels.add,
            tabBarIcon: ({ color, size }) => <Plus size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: compactTabLabels.chat,
            tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: compactTabLabels.reports,
            tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="goals" options={{ href: null }} />
      </Tabs>
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

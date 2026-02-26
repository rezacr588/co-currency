import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  User,
} from 'lucide-react-native';
import type GorhomBottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from 'styled-components/native';
import { useTheme as useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AppMode, getModeFromPath, switchAppMode } from '../../navigation/mode';
import { BottomSheet } from '../ui/BottomSheet';
import { AppSwitcherMenu, type AppSwitcherMenuAction } from './AppSwitcherMenu';

export type AppSwitcherTriggerVariant = 'floating_tab' | 'header_inline';

interface AppSwitcherTriggerProps {
  variant?: AppSwitcherTriggerVariant;
  style?: ViewStyle;
}

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_ANCHOR: AnchorRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

function modeLabel(mode: AppMode): string {
  return mode === 'todo' ? 'Todo' : 'FinApp';
}

export function AppSwitcherTrigger({ variant = 'header_inline', style }: AppSwitcherTriggerProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { isDark, toggleTheme } = useAppTheme();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktopOrTablet = width >= 768;
  const pathname = usePathname();
  const router = useRouter();

  const activeMode = useMemo<AppMode>(() => getModeFromPath(pathname) ?? 'finapp', [pathname]);
  const firstName = user?.name?.trim().split(' ')[0] || 'You';
  const initials =
    user?.name
      ?.trim()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const triggerRef = useRef<View>(null);
  const sheetRef = useRef<GorhomBottomSheet>(null);

  const [isDesktopMenuVisible, setIsDesktopMenuVisible] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect>(DEFAULT_ANCHOR);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const closeDesktopMenu = useCallback(() => {
    setIsDesktopMenuVisible(false);
  }, []);

  const closeMobileMenu = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  const closeMenu = useCallback(() => {
    closeDesktopMenu();
    closeMobileMenu();
  }, [closeDesktopMenu, closeMobileMenu]);

  const switchMode = useCallback(
    async (mode: AppMode) => {
      if (mode === activeMode || isSwitchingMode) {
        return;
      }

      try {
        setIsSwitchingMode(true);
        await switchAppMode(router, mode, pathname || undefined);
      } finally {
        setIsSwitchingMode(false);
      }
    },
    [activeMode, isSwitchingMode, pathname, router]
  );

  const actions = useMemo<AppSwitcherMenuAction[]>(() => {
    return [
      {
        id: 'switch-finapp',
        label: activeMode === 'finapp' ? 'FinApp (Current)' : 'Switch to FinApp',
        description: 'Wallet, reports, chat, and finance tools',
        icon: <LayoutDashboard size={15} color={activeMode === 'finapp' ? colors.accent : colors.foreground} />,
        tone: activeMode === 'finapp' ? 'accent' : 'default',
        disabled: activeMode === 'finapp' || isSwitchingMode,
        onPress: () => {
          void switchMode('finapp');
        },
      },
      {
        id: 'switch-todo',
        label: activeMode === 'todo' ? 'Todo (Current)' : 'Switch to Todo',
        description: 'Planner board and daily workflow mode',
        icon: <KanbanSquare size={15} color={activeMode === 'todo' ? colors.accent : colors.foreground} />,
        tone: activeMode === 'todo' ? 'accent' : 'default',
        disabled: activeMode === 'todo' || isSwitchingMode,
        onPress: () => {
          void switchMode('todo');
        },
      },
      {
        id: 'profile',
        label: 'Profile',
        description: 'Account details and security',
        icon: <User size={15} color={colors.foreground} />,
        onPress: () => {
          router.push('/(app)/profile');
        },
      },
      {
        id: 'settings',
        label: 'Settings',
        description: 'Notifications and app preferences',
        icon: <Settings size={15} color={colors.foreground} />,
        onPress: () => {
          router.push('/(app)/notification-settings');
        },
      },
      {
        id: 'theme',
        label: isDark ? 'Switch to Light' : 'Switch to Dark',
        description: isDark ? 'Current: Dark mode' : 'Current: Light mode',
        icon: isDark ? <Sun size={15} color={colors.foreground} /> : <Moon size={15} color={colors.foreground} />,
        onPress: () => {
          toggleTheme();
        },
      },
      {
        id: 'logout',
        label: 'Logout',
        description: 'Sign out from this device',
        icon: <LogOut size={15} color={colors.danger} />,
        tone: 'danger',
        onPress: () => {
          void logout();
        },
      },
    ];
  }, [
    activeMode,
    colors.accent,
    colors.danger,
    colors.foreground,
    isDark,
    isSwitchingMode,
    logout,
    router,
    switchMode,
    toggleTheme,
  ]);

  const openMenu = useCallback(() => {
    if (isDesktopOrTablet) {
      triggerRef.current?.measureInWindow?.((x, y, measuredWidth, measuredHeight) => {
        setAnchor({ x, y, width: measuredWidth, height: measuredHeight });
        setIsDesktopMenuVisible(true);
      });

      if (!triggerRef.current?.measureInWindow) {
        setAnchor(DEFAULT_ANCHOR);
        setIsDesktopMenuVisible(true);
      }
      return;
    }

    sheetRef.current?.snapToIndex(0);
  }, [isDesktopOrTablet]);

  const triggerStyle: ViewStyle =
    variant === 'floating_tab'
      ? {
        width: 54,
        height: 54,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accent,
        borderWidth: 1,
        borderColor: colors.accent + '99',
        shadowColor: colors.accent,
        shadowOpacity: 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
        elevation: 7,
      }
      : {
        minWidth: 44,
        height: 40,
        borderRadius: 14,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.accent,
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      };

  const dropdownWidth = 292;
  const dropdownLeft = Math.min(
    Math.max(12, anchor.x + anchor.width - dropdownWidth),
    Math.max(12, width - dropdownWidth - 12)
  );
  const dropdownTop = Math.max(16, anchor.y + anchor.height + 8);

  return (
    <>
      <View ref={triggerRef} style={style}>
        <Pressable
          onPress={openMenu}
          style={({ pressed }) => [triggerStyle, pressed && { opacity: 0.78 }]}
          accessibilityRole="button"
          accessibilityLabel="Open app switcher"
        >
          {variant === 'floating_tab' ? (
            <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
              {initials}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.accent + '26',
                  borderWidth: 1,
                  borderColor: colors.accent + '50',
                }}
              >
                <Text style={{ color: colors.accent, fontFamily: 'Inter_700Bold', fontSize: 11 }}>{initials}</Text>
              </View>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                {modeLabel(activeMode)}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <Modal
        visible={isDesktopMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDesktopMenu}
      >
        <Pressable
          onPress={closeDesktopMenu}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.24)' }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              position: 'absolute',
              top: dropdownTop,
              left: dropdownLeft,
              width: dropdownWidth,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              padding: 12,
              shadowColor: colors.accent,
              shadowOpacity: 0.22,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <AppSwitcherMenu
              title={`Hi ${firstName}`}
              subtitle={`Current app: ${modeLabel(activeMode)}`}
              actions={actions}
              onClose={closeDesktopMenu}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {!isDesktopOrTablet ? (
        <BottomSheet
          ref={sheetRef}
          title="Quick Menu"
          snapPoints={['68%']}
          enableDynamicSizing={false}
          onClose={closeMenu}
        >
          <AppSwitcherMenu
            title={`Hi ${firstName}`}
            subtitle={`Current app: ${modeLabel(activeMode)}`}
            actions={actions}
            onClose={closeMenu}
          />
        </BottomSheet>
      ) : null}
    </>
  );
}

export default AppSwitcherTrigger;

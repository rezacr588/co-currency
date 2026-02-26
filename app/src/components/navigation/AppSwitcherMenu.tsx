import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';

export type AppSwitcherMenuTone = 'default' | 'accent' | 'danger';

export interface AppSwitcherMenuAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  tone?: AppSwitcherMenuTone;
  disabled?: boolean;
  onPress: () => void;
}

interface AppSwitcherMenuProps {
  title?: string;
  subtitle?: string;
  actions: AppSwitcherMenuAction[];
  onClose?: () => void;
}

function resolveToneColor(tone: AppSwitcherMenuTone | undefined, colors: any): { bg: string; border: string; text: string } {
  if (tone === 'danger') {
    return {
      bg: colors.danger + '1A',
      border: colors.danger + '4D',
      text: colors.danger,
    };
  }
  if (tone === 'accent') {
    return {
      bg: colors.accent + '1C',
      border: colors.accent + '4D',
      text: colors.accent,
    };
  }
  return {
    bg: colors.card,
    border: colors.border,
    text: colors.foreground,
  };
}

export function AppSwitcherMenu({ title, subtitle, actions, onClose }: AppSwitcherMenuProps) {
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <View>
      {(title || subtitle) && (
        <View style={{ marginBottom: 10 }}>
          {title ? (
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 15 }}>{title}</Text>
          ) : null}
          {subtitle ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 3 }}>{subtitle}</Text>
          ) : null}
        </View>
      )}

      <View style={{ gap: 8 }}>
        {actions.map((action) => {
          const tone = resolveToneColor(action.tone, colors);

          return (
            <Pressable
              key={action.id}
              onPress={() => {
                if (action.disabled) {
                  return;
                }
                action.onPress();
                onClose?.();
              }}
              disabled={action.disabled}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: tone.border,
                  borderRadius: 14,
                  backgroundColor: tone.bg,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  opacity: action.disabled ? 0.5 : pressed ? 0.74 : 1,
                },
              ]}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: tone.border,
                  backgroundColor: colors.background,
                }}
              >
                {action.icon}
              </View>

              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: tone.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{action.label}</Text>
                {action.description ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>{action.description}</Text>
                ) : null}
              </View>

              <ChevronRight size={14} color={colors.mutedForeground} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default AppSwitcherMenu;

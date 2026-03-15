import { Pressable, Text, View } from 'react-native';
import { ArrowRight, ArrowUpRight, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import type { RecommendedAction } from '../../../api/coai';

interface RecommendedActionCardsProps {
  actions: RecommendedAction[];
  onActionPress: (action: RecommendedAction) => void;
  compact?: boolean;
}

export function RecommendedActionCards({
  actions,
  onActionPress,
  compact = false,
}: RecommendedActionCardsProps) {
  const theme = useTheme();

  if (actions.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: compact ? 8 : 12 }}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          onPress={() => onActionPress(action)}
          accessibilityRole="button"
          accessibilityLabel={action.title}
          style={({ pressed }) => [
            {
              borderRadius: compact ? theme.radii.lg : theme.radii.xl,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: compact ? theme.colors.secondary : theme.colors.card,
              padding: compact ? 12 : 16,
            },
            pressed && { opacity: 0.74 },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontSize: compact ? 14 : 16,
                  fontFamily: theme.typography.bodyMedium.fontFamily,
                }}
              >
                {action.title}
              </Text>
              <Text
                style={{
                  color: theme.colors.mutedForeground,
                  fontSize: compact ? 12 : 14,
                  lineHeight: compact ? 18 : 20,
                  marginTop: 6,
                }}
              >
                {action.description}
              </Text>
            </View>
            <View
              style={{
                width: compact ? 32 : 36,
                height: compact ? 32 : 36,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary + '14',
              }}
            >
              {action.requires_confirmation ? (
                <CheckCircle2 size={compact ? 15 : 16} color={theme.colors.primary} />
              ) : (
                <ArrowUpRight size={compact ? 15 : 16} color={theme.colors.primary} />
              )}
            </View>
          </View>

          <View
            style={{
              marginTop: compact ? 10 : 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                color: theme.colors.primary,
                fontSize: compact ? 12 : 13,
                fontFamily: theme.typography.bodyMedium.fontFamily,
              }}
            >
              {action.cta_label}
            </Text>
            <ArrowRight size={compact ? 14 : 16} color={theme.colors.primary} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

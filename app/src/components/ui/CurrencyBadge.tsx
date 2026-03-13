import { View, Text, ViewStyle } from 'react-native';
import { Globe } from 'lucide-react-native';
import { getCurrencyDisplay } from '../../utils/format';
import { ICON_SIZES, ICON_COLOR_MUTED } from '../../constants/icons';
import { useTheme } from 'styled-components/native';

interface CurrencyBadgeProps {
  code: string;
  showCode?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const sizeStyles = {
  sm: { flagFontSize: 16, codeFontSize: 12, paddingHorizontal: 8, paddingVertical: 4 },
  md: { flagFontSize: 20, codeFontSize: 14, paddingHorizontal: 12, paddingVertical: 8 },
  lg: { flagFontSize: 24, codeFontSize: 16, paddingHorizontal: 16, paddingVertical: 12 },
};

// Map badge sizes to icon sizes
const badgeIconSizes = {
  sm: ICON_SIZES.xs,
  md: ICON_SIZES.sm,
  lg: ICON_SIZES.md,
};

export function CurrencyBadge({
  code,
  showCode = true,
  size = 'md',
  style,
}: CurrencyBadgeProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const display = getCurrencyDisplay(code);
  const styles = sizeStyles[size];

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: styles.paddingHorizontal,
          paddingVertical: styles.paddingVertical,
        },
        style,
      ]}
    >
      {display.flag ? (
        <Text style={{ fontSize: styles.flagFontSize }}>{display.flag}</Text>
      ) : (
        <Globe size={badgeIconSizes[size]} color={ICON_COLOR_MUTED} />
      )}
      {showCode && (
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginStart: 8, fontSize: styles.codeFontSize }}>
          {code}
        </Text>
      )}
    </View>
  );
}

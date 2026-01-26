import { View, Text } from 'react-native';
import { Globe } from 'lucide-react-native';
import { getCurrencyDisplay } from '../../utils/format';
import { ICON_SIZES, ICON_COLOR_MUTED } from '../../constants/icons';

interface CurrencyBadgeProps {
  code: string;
  showCode?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: { flag: 'text-base', code: 'text-xs', padding: 'px-2 py-1' },
  md: { flag: 'text-xl', code: 'text-sm', padding: 'px-3 py-2' },
  lg: { flag: 'text-2xl', code: 'text-base', padding: 'px-4 py-3' },
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
  className = '',
}: CurrencyBadgeProps) {
  const display = getCurrencyDisplay(code);
  const styles = sizeStyles[size];

  return (
    <View
      className={`bg-card rounded-lg flex-row items-center ${styles.padding} ${className}`}
    >
      {display.flag ? (
        <Text className={styles.flag}>{display.flag}</Text>
      ) : (
        <Globe size={badgeIconSizes[size]} color={ICON_COLOR_MUTED} />
      )}
      {showCode && (
        <Text className={`text-foreground font-semibold ml-2 ${styles.code}`}>
          {code}
        </Text>
      )}
    </View>
  );
}

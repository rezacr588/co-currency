import { type ReactNode } from 'react';
import styled, { useTheme } from 'styled-components/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Caption } from './StyledText';

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'accent';

interface StyledBadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

const BadgeWrapper = styled.View`
  border-radius: ${({ theme }) => theme.radii.full}px;
  overflow: hidden;
  align-self: flex-start;
`;

const BadgeContent = styled.View`
  padding-horizontal: ${({ theme }) => theme.spacing.md}px;
  padding-vertical: ${({ theme }) => theme.spacing.xs}px;
`;

export function StyledBadge({ variant = 'default', children }: StyledBadgeProps) {
  const theme = useTheme();

  const variantConfig: Record<BadgeVariant, { bg: string; text: string; gradientColors?: string[] }> = {
    default: { bg: theme.colors.secondary, text: theme.colors.foreground },
    success: { bg: theme.colors.successMuted, text: theme.colors.success },
    danger: { bg: theme.colors.dangerMuted, text: theme.colors.danger },
    warning: { bg: theme.colors.warningMuted, text: theme.colors.warning },
    info: { bg: theme.colors.infoMuted, text: theme.colors.info },
    accent: {
      bg: theme.colors.accentMuted + '30',
      text: theme.colors.accent,
      gradientColors: [theme.colors.accent + '20', theme.colors.accentHover + '20'],
    },
  };

  const config = variantConfig[variant];

  if (config.gradientColors) {
    return (
      <BadgeWrapper>
        <LinearGradient
          colors={config.gradientColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <BadgeContent>
            <Caption
              $color={config.text}
              style={{ fontFamily: theme.typography.label.fontFamily }}
            >
              {children}
            </Caption>
          </BadgeContent>
        </LinearGradient>
      </BadgeWrapper>
    );
  }

  return (
    <BadgeWrapper style={{ backgroundColor: config.bg }}>
      <BadgeContent>
        <Caption
          $color={config.text}
          style={{ fontFamily: theme.typography.label.fontFamily }}
        >
          {children}
        </Caption>
      </BadgeContent>
    </BadgeWrapper>
  );
}

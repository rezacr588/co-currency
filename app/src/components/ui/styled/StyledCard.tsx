import { type ReactNode } from 'react';
import { type ViewProps } from 'react-native';
import styled, { useTheme } from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { H3, Caption } from './StyledText';

// ─── Base Card ───────────────────────────────────────────────
const CardBase = styled.View`
  border-radius: ${({ theme }) => theme.radii.xl}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.borderSubtle};
  background-color: ${({ theme }) => theme.colors.card};
`;

const ElevatedCardBase = styled(CardBase)`
  background-color: ${({ theme }) => theme.colors.cardElevated};
`;

const GlassBlur = styled(BlurView)`
  border-radius: ${({ theme }) => theme.radii.xl}px;
  padding: ${({ theme }) => theme.spacing.lg}px;
  overflow: hidden;
`;

const GlassWrapper = styled.View`
  border-radius: ${({ theme }) => theme.radii.xl}px;
  overflow: hidden;
  border-width: 1px;
  border-color: ${({ theme }) =>
    theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
`;

const GradientWrapper = styled.View`
  border-radius: ${({ theme }) => theme.radii.xl}px;
  overflow: hidden;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.accent + '33'};
`;

type CardVariant = 'default' | 'glass' | 'gradient' | 'elevated';

interface StyledCardProps extends ViewProps {
  variant?: CardVariant;
  children: ReactNode;
}

export function StyledCard({ variant = 'default', children, style, ...props }: StyledCardProps) {
  const theme = useTheme();

  if (variant === 'glass') {
    return (
      <GlassWrapper style={[theme.shadows.sm, style]} {...props}>
        <GlassBlur
          intensity={theme.glass.intensity}
          tint={theme.glass.tint}
        >
          {children}
        </GlassBlur>
      </GlassWrapper>
    );
  }

  if (variant === 'gradient') {
    return (
      <GradientWrapper style={[theme.shadows.md, style]} {...props}>
        <LinearGradient
          colors={theme.gradients.card as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: theme.spacing.lg }}
        >
          {children}
        </LinearGradient>
      </GradientWrapper>
    );
  }

  if (variant === 'elevated') {
    return (
      <ElevatedCardBase style={[theme.shadows.md, style]} {...props}>
        {children}
      </ElevatedCardBase>
    );
  }

  return (
    <CardBase style={[theme.shadows.sm, style]} {...props}>
      {children}
    </CardBase>
  );
}

// ─── Sub-components ──────────────────────────────────────────
export const CardHeader = styled.View`
  margin-bottom: ${({ theme }) => theme.spacing.lg}px;
`;

export const CardTitle = styled(H3)``;

export const CardContent = styled.View``;

export const CardFooter = styled.View`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
  padding-top: ${({ theme }) => theme.spacing.lg}px;
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colors.border};
`;

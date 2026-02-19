import styled from 'styled-components/native';

interface TextColorProps {
  $color?: string;
}

export const H1 = styled.Text<TextColorProps>`
  font-size: ${({ theme }) => theme.typography.h1.fontSize}px;
  font-family: ${({ theme }) => theme.typography.h1.fontFamily};
  line-height: ${({ theme }) => theme.typography.h1.lineHeight}px;
  letter-spacing: ${({ theme }) => theme.typography.h1.letterSpacing}px;
  color: ${({ theme, $color }) => $color || theme.colors.foreground};
`;

export const H2 = styled.Text<TextColorProps>`
  font-size: ${({ theme }) => theme.typography.h2.fontSize}px;
  font-family: ${({ theme }) => theme.typography.h2.fontFamily};
  line-height: ${({ theme }) => theme.typography.h2.lineHeight}px;
  letter-spacing: ${({ theme }) => theme.typography.h2.letterSpacing}px;
  color: ${({ theme, $color }) => $color || theme.colors.foreground};
`;

export const H3 = styled.Text<TextColorProps>`
  font-size: ${({ theme }) => theme.typography.h3.fontSize}px;
  font-family: ${({ theme }) => theme.typography.h3.fontFamily};
  line-height: ${({ theme }) => theme.typography.h3.lineHeight}px;
  letter-spacing: ${({ theme }) => theme.typography.h3.letterSpacing}px;
  color: ${({ theme, $color }) => $color || theme.colors.foreground};
`;

export const Body = styled.Text<TextColorProps>`
  font-size: ${({ theme }) => theme.typography.body.fontSize}px;
  font-family: ${({ theme }) => theme.typography.body.fontFamily};
  line-height: ${({ theme }) => theme.typography.body.lineHeight}px;
  letter-spacing: ${({ theme }) => theme.typography.body.letterSpacing}px;
  color: ${({ theme, $color }) => $color || theme.colors.foreground};
`;

export const BodyMedium = styled.Text<TextColorProps>`
  font-size: ${({ theme }) => theme.typography.bodyMedium.fontSize}px;
  font-family: ${({ theme }) => theme.typography.bodyMedium.fontFamily};
  line-height: ${({ theme }) => theme.typography.bodyMedium.lineHeight}px;
  letter-spacing: ${({ theme }) => theme.typography.bodyMedium.letterSpacing}px;
  color: ${({ theme, $color }) => $color || theme.colors.foreground};
`;

export const Caption = styled.Text<TextColorProps>`
  font-size: ${({ theme }) => theme.typography.caption.fontSize}px;
  font-family: ${({ theme }) => theme.typography.caption.fontFamily};
  line-height: ${({ theme }) => theme.typography.caption.lineHeight}px;
  letter-spacing: ${({ theme }) => theme.typography.caption.letterSpacing}px;
  color: ${({ theme, $color }) => $color || theme.colors.mutedForeground};
`;

export const Label = styled.Text<TextColorProps>`
  font-size: ${({ theme }) => theme.typography.label.fontSize}px;
  font-family: ${({ theme }) => theme.typography.label.fontFamily};
  line-height: ${({ theme }) => theme.typography.label.lineHeight}px;
  letter-spacing: ${({ theme }) => theme.typography.label.letterSpacing}px;
  text-transform: uppercase;
  color: ${({ theme, $color }) => $color || theme.colors.mutedForeground};
`;

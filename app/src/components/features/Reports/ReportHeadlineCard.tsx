import { View, Text } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import { Card } from '../../ui';

interface ReportHeadlineCardProps {
  summary: string;
  caption?: string;
}

export function ReportHeadlineCard({ summary, caption }: ReportHeadlineCardProps) {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <Card
      style={{
        backgroundColor: theme.alpha(colors.accent, 0.07),
        borderColor: theme.alpha(colors.accent, 0.2),
        padding: 18,
        marginBottom: theme.spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm + 2 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: theme.radii.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.alpha(colors.accent, 0.15),
            marginEnd: theme.spacing.sm + 2,
          }}
        >
          <Sparkles size={18} color={colors.accent} />
        </View>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>
          {t('keyTakeaway') || 'Key Takeaway'}
        </Text>
      </View>

      <Text style={{ color: colors.foreground, fontSize: 16, lineHeight: 23, fontFamily: 'Inter_600SemiBold' }}>
        {summary}
      </Text>

      {caption ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18, marginTop: theme.spacing.sm }}>
          {caption}
        </Text>
      ) : null}
    </Card>
  );
}

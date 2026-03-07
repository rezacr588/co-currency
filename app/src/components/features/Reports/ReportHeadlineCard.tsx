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
        backgroundColor: colors.accent + '12',
        borderColor: colors.accent + '33',
        padding: 18,
        marginBottom: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 9999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accent + '26',
            marginEnd: 10,
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
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
          {caption}
        </Text>
      ) : null}
    </Card>
  );
}

import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, ExternalLink, Clock } from 'lucide-react-native';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from 'styled-components/native';
import type { NewsItem } from '../../../api/news';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

const categoryColors: Record<string, string> = {
  markets: '#3b82f6',
  finance: '#22c55e',
  economy: '#f59e0b',
  crypto: '#8b5cf6',
};

export function FinancialNewsCard() {
  const { t } = useLanguage();
  const theme = useTheme();
  const colors = theme.colors;

  const { data: newsItems, isPending } = useQuery({
    queryKey: ['news'],
    queryFn: () => api.news.list(5),
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 1,
  });

  const handleOpenArticle = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  if (isPending) {
    return (
      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 60 }}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      </View>
    );
  }

  if (!newsItems || newsItems.length === 0) return null;

  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Newspaper size={18} color={colors.mutedForeground} />
        <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginLeft: 8 }}>{t('financialNews') || 'Financial News'}</Text>
      </View>

      {/* News Items */}
      <View style={{ gap: 8 }}>
        {newsItems.slice(0, 5).map((item: NewsItem, index: number) => {
          const catColor = categoryColors[item.category] || categoryColors.finance;
          return (
            <Pressable
              key={`${item.url}-${index}`}
              onPress={() => handleOpenArticle(item.url)}
              style={({ pressed }) => [{ cursor: 'pointer', backgroundColor: colors.muted + '80', padding: 12, borderRadius: 8 }, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground }} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8, backgroundColor: `${catColor}20` }}>
                      <Text style={{ color: catColor, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>{item.source}</Text>
                    </View>
                    <Clock size={10} color={colors.mutedForeground} />
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: 4 }}>{timeAgo(item.published_at)}</Text>
                  </View>
                </View>
                <ExternalLink size={14} color={colors.mutedForeground} style={{ marginTop: 2, marginLeft: 8 }} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

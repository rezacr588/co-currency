import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Award, Clock3, KanbanSquare, NotebookText, Radar, Repeat2 } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { PageHeader, PageScaffold, Card } from '../../src/components/ui';
import { useLanguage } from '../../src/context/LanguageContext';

const TOOL_ITEMS = [
  {
    title: 'Planner',
    description: 'Keep tasks, boards, and money actions connected.',
    href: '/planner',
    icon: KanbanSquare,
  },
  {
    title: 'Subscriptions',
    description: 'Review recurring services and upcoming renewals.',
    href: '/(app)/subscriptions',
    icon: Repeat2,
  },
  {
    title: 'Historical Rates',
    description: 'Inspect rate history before converting or reporting.',
    href: '/(app)/historical',
    icon: Clock3,
  },
  {
    title: 'Badges',
    description: 'See milestones and progress without crowding CoAI Home.',
    href: '/(app)/badges',
    icon: Award,
  },
  {
    title: 'Notes',
    description: 'Keep lightweight financial notes and reminders.',
    href: '/(app)/notes',
    icon: NotebookText,
  },
  {
    title: 'Challenges',
    description: 'Optional motivation layers that stay secondary to CoAI.',
    href: '/(app)/challenges',
    icon: Radar,
  },
];

export default function ToolsScreen() {
  const theme = useTheme();
  const { t } = useLanguage();

  return (
    <PageScaffold scroll maxWidth={1120}>
      <PageHeader
        title={t('tools') || 'Tools'}
        subtitle="Secondary modules stay here so CoAI Home can stay focused on guidance and next actions."
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {TOOL_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <View key={item.href} style={{ width: '100%', maxWidth: 360, flexGrow: 1 }}>
              <Link href={item.href as any} asChild>
                <Pressable accessibilityRole="button" accessibilityLabel={item.title}>
                  <Card>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: theme.radii.lg,
                        backgroundColor: theme.colors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 14,
                      }}
                    >
                      <Icon size={20} color={theme.colors.secondaryForeground} />
                    </View>
                    <Text
                      style={{
                        color: theme.colors.foreground,
                        fontSize: 18,
                        fontFamily: theme.typography.h3.fontFamily,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.mutedForeground,
                        fontSize: 14,
                        lineHeight: 20,
                        marginTop: 8,
                      }}
                    >
                      {item.description}
                    </Text>
                  </Card>
                </Pressable>
              </Link>
            </View>
          );
        })}
      </View>
    </PageScaffold>
  );
}

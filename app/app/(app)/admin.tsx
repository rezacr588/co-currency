/**
 * Admin / operator dashboard.
 *
 * Read-only. UI gate: useIsAdmin → renders a "Forbidden" panel for everyone
 * else. Backend gate (authoritative): RequireAdmin middleware on /admin/*.
 *
 * Surfaces, in order:
 *   1. App stats — users, transactions, plans, pending approvals, AI usage
 *   2. Recent signups (last 5)
 *   3. DB stats — total size + top tables by row count
 */

import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';
import { ArrowLeft, Database, Lock, RefreshCw, Users } from 'lucide-react-native';

import { useAdminOverview, useIsAdmin } from '@/src/hooks';
import { useLanguage } from '@/src/context/LanguageContext';
import { LoadingSpinner } from '@/src/components/ui';
import { haptics } from '@/src/utils/haptics';
import { spacing, radii } from '@/src/theme';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function AdminScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();

  const isAdmin = useIsAdmin();
  const { data, isLoading, isRefetching, isError, error, refetch } = useAdminOverview();

  const handleBack = () => {
    haptics.light();
    router.back();
  };

  const handleRefresh = async () => {
    haptics.light();
    await refetch();
  };

  // Header is shared across all states for consistency.
  const Header = useMemo(
    () => (
      <View
        style={{
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t('a11yBack') || 'Back'}
          hitSlop={12}
          style={{ marginEnd: spacing.md }}
        >
          <ArrowLeft size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {t('adminPageTitle') || 'Admin'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
            {t('adminPageSubtitle') || 'Read-only operator dashboard'}
          </Text>
        </View>
        {isAdmin && (
          <Pressable
            onPress={handleRefresh}
            disabled={isRefetching}
            accessibilityRole="button"
            accessibilityLabel={t('refresh') || 'Refresh'}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.full,
              backgroundColor: colors.muted,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isRefetching ? 0.5 : 1,
            }}
          >
            <RefreshCw size={16} color={colors.foreground} />
          </Pressable>
        )}
      </View>
    ),
    // Stable handlers; refetch state changes the icon opacity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insets.top, isAdmin, isRefetching, colors.foreground, colors.background, t],
  );

  // Non-admin: hard stop with a clear message.
  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {Header}
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.xl,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.full,
              backgroundColor: theme.alpha(colors.danger, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <Lock size={26} color={colors.danger} />
          </View>
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Inter_700Bold',
              color: colors.foreground,
              marginBottom: spacing.sm,
            }}
          >
            {t('adminForbiddenTitle') || 'Not authorized'}
          </Text>
          <Text
            style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', maxWidth: 320 }}
          >
            {t('adminForbiddenBody') || 'This area is for the operator account only.'}
          </Text>
        </View>
      </View>
    );
  }

  if (isLoading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {Header}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <LoadingSpinner />
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {Header}
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
        >
          <View
            style={{
              backgroundColor: colors.dangerMuted,
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: theme.alpha(colors.danger, 0.3),
              padding: spacing.lg,
            }}
          >
            <Text style={{ color: colors.danger, fontFamily: 'Inter_600SemiBold', marginBottom: spacing.xs }}>
              {t('adminLoadError') || 'Failed to load admin overview'}
            </Text>
            <Text style={{ color: colors.danger, fontSize: 12 }}>
              {error instanceof Error ? error.message : t('tryAgainLater') || 'Try again later.'}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const { app, db, recent, generated_at: generatedAt } = data;

  const appStats: { key: string; label: string; value: string }[] = [
    {
      key: 'users',
      label: t('adminUsersTotal') || 'Users (total)',
      value: formatNumber(app.users_total),
    },
    {
      key: 'users_24h',
      label: t('adminUsersLast24h') || 'New users (24h)',
      value: formatNumber(app.users_signed_up_24h),
    },
    {
      key: 'tx',
      label: t('adminTransactionsTotal') || 'Transactions (total)',
      value: formatNumber(app.transactions_total),
    },
    {
      key: 'tx_24h',
      label: t('adminTransactionsLast24h') || 'Transactions (24h)',
      value: formatNumber(app.transactions_last_24h),
    },
    {
      key: 'conversions',
      label: t('adminConversionsTotal') || 'Conversions (total)',
      value: formatNumber(app.conversions_total),
    },
    {
      key: 'plans',
      label: t('adminActivePlans') || 'Active agent plans',
      value: formatNumber(app.active_plans),
    },
    {
      key: 'approvals',
      label: t('adminPendingApprovals') || 'Pending approvals',
      value: formatNumber(app.pending_approvals),
    },
    {
      key: 'chat',
      label: t('adminChatMessagesTotal') || 'Chat messages (total)',
      value: formatNumber(app.chat_messages_total),
    },
    {
      key: 'chat_24h',
      label: t('adminChatMessagesLast24h') || 'Chat messages (24h)',
      value: formatNumber(app.chat_messages_last_24h),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {Header}
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 11,
            marginBottom: spacing.lg,
          }}
        >
          {t('adminGeneratedAt') || 'Snapshot generated'} · {formatTimestamp(generatedAt)}
        </Text>

        {/* App stats grid */}
        <View style={{ marginBottom: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Users size={18} color={colors.foreground} style={{ marginEnd: spacing.sm }} />
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {t('adminAppStatsTitle') || 'App'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs }}>
            {appStats.map((stat) => (
              <View
                key={stat.key}
                style={{
                  width: '50%',
                  paddingHorizontal: spacing.xs,
                  paddingBottom: spacing.sm,
                }}
              >
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radii.xl,
                    padding: spacing.lg,
                  }}
                >
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 11,
                      fontFamily: 'Inter_500Medium',
                      marginBottom: spacing.xs,
                    }}
                    numberOfLines={1}
                  >
                    {stat.label}
                  </Text>
                  <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: 'Inter_700Bold' }}>
                    {stat.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Recent signups */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Inter_600SemiBold',
              color: colors.foreground,
              marginBottom: spacing.md,
            }}
          >
            {t('adminRecentSignupsTitle') || 'Recent signups'}
          </Text>
          {recent.signups.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.xl,
                padding: spacing.lg,
              }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontStyle: 'italic' }}>
                {t('adminNoRecentSignups') || 'No signups recorded yet.'}
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.xl,
                paddingVertical: spacing.sm,
              }}
            >
              {recent.signups.map((signup, idx) => (
                <View
                  key={`${signup.email}-${signup.created_at}`}
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: colors.borderSubtle,
                  }}
                >
                  <Text
                    style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }}
                    numberOfLines={1}
                  >
                    {signup.email}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                    {formatTimestamp(signup.created_at)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Database stats */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Database size={18} color={colors.foreground} style={{ marginEnd: spacing.sm }} />
            <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {t('adminDbTitle') || 'Database'}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{formatBytes(db.size_bytes)}</Text>
          </View>

          {db.tables.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.xl,
                padding: spacing.lg,
              }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontStyle: 'italic' }}>
                {t('adminNoTables') || 'No table stats available.'}
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.xl,
                paddingVertical: spacing.sm,
              }}
            >
              {db.tables.map((table, idx) => (
                <View
                  key={table.name}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.sm,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: colors.borderSubtle,
                  }}
                >
                  <Text
                    style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 }}
                    numberOfLines={1}
                  >
                    {table.name}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                    {formatNumber(table.rows)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

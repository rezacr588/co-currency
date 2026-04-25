/**
 * Support / Contact page.
 *
 * Subject + message form that hands the composed email off to the user's mail
 * client via `mailto:`. App version + platform are appended to the body so
 * bug reports include the context we need to triage.
 *
 * No backend — relying on the user's email client keeps this zero-infra.
 */

import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Mail, Send } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';

import { useLanguage } from '../../src/context/LanguageContext';
import { MarketingScaffold, SectionBlock, SurfaceCard } from '../../src/components/ui';
import { useToast } from '../../src/components/ui/Toast';
import { SEOHead } from '../../src/components/seo';
import { getVersionInfo } from '../../src/utils/version';

const SUPPORT_EMAIL = 'rez.zet.int@gmail.com';

export default function SupportScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { showToast } = useToast();
  const versionInfo = useMemo(() => getVersionInfo(), []);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const canSend = subject.trim().length > 0 && message.trim().length > 0;

  const handleSend = async () => {
    if (!canSend || isSending) return;
    setIsSending(true);
    try {
      // Append diagnostic footer so bug reports include context for triage.
      const footer =
        `\n\n---\n` +
        `App version: ${versionInfo.displayVersion}\n` +
        `Platform: ${Platform.OS} ${Platform.Version}\n`;
      const body = `${message.trim()}${footer}`;
      const mailto =
        `mailto:${SUPPORT_EMAIL}` +
        `?subject=${encodeURIComponent(subject.trim())}` +
        `&body=${encodeURIComponent(body)}`;

      const supported = await Linking.canOpenURL(mailto);
      if (!supported) {
        showToast(
          t('supportNoMailClient') || `No email app available. Email us directly at ${SUPPORT_EMAIL}.`,
          'error',
        );
        return;
      }
      await Linking.openURL(mailto);
      // Don't auto-clear: if the mail handoff fails the user will still have
      // their text; they can re-send.
    } catch {
      showToast(
        t('supportSendFailed') || `Couldn't open your email app. Email us at ${SUPPORT_EMAIL}.`,
        'error',
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleDirectEmail = async () => {
    const mailto = `mailto:${SUPPORT_EMAIL}`;
    try {
      await Linking.openURL(mailto);
    } catch {
      // Fallback: copy to clipboard would require an extra import; just toast.
      showToast(
        t('supportEmailFallback') || `Email us at ${SUPPORT_EMAIL}`,
        'info',
      );
    }
  };

  const fieldLabelStyle = {
    color: theme.colors.foreground,
    fontFamily: theme.typography.bodyMedium.fontFamily,
    fontSize: 13,
    marginBottom: theme.spacing.xs,
  };

  const inputStyle = {
    backgroundColor: theme.colors.muted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.foreground,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
  };

  return (
    <>
      <SEOHead
        title={`${t('supportPageTitle') || 'Support'} · CoAI`}
        description={
          t('supportSeoDesc') ||
          'Report a bug or send feedback to the CoAI team. We read every message.'
        }
        canonicalPath="/support"
      />
      <MarketingScaffold>
        <SectionBlock
          title={t('supportPageTitle') || 'Support & feedback'}
          subtitle={
            t('supportPageSubtitle') ||
            'Found a bug or have an idea? Send us a note — we read every message.'
          }
        >
          <SurfaceCard>
            <View style={{ marginBottom: theme.spacing.lg }}>
              <Text style={fieldLabelStyle}>{t('supportSubjectLabel') || 'Subject'}</Text>
              <TextInput
                style={inputStyle}
                value={subject}
                onChangeText={setSubject}
                placeholder={t('supportSubjectPlaceholder') || 'e.g. Wallet conversion shows wrong rate'}
                placeholderTextColor={theme.colors.subtleForeground}
                maxLength={120}
              />
            </View>

            <View style={{ marginBottom: theme.spacing.lg }}>
              <Text style={fieldLabelStyle}>{t('supportMessageLabel') || 'Message'}</Text>
              <TextInput
                style={[inputStyle, { minHeight: 140, textAlignVertical: 'top' }]}
                value={message}
                onChangeText={setMessage}
                placeholder={
                  t('supportMessagePlaceholder') ||
                  'What happened, what you expected, and steps to reproduce.'
                }
                placeholderTextColor={theme.colors.subtleForeground}
                multiline
                maxLength={4000}
              />
            </View>

            <Text
              style={{
                color: theme.colors.mutedForeground,
                fontSize: 12,
                marginBottom: theme.spacing.md,
                lineHeight: 18,
              }}
            >
              {t('supportFooterNote') ||
                'We\u2019ll attach your app version and platform automatically to help us debug.'}
            </Text>

            <Pressable
              onPress={handleSend}
              disabled={!canSend || isSending}
              accessibilityRole="button"
              accessibilityLabel={t('supportSendCta') || 'Send via email'}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primary,
                  paddingVertical: theme.spacing.md,
                  paddingHorizontal: theme.spacing.lg,
                  borderRadius: theme.radii.md,
                  opacity: !canSend || isSending ? 0.5 : 1,
                },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Send size={16} color={theme.colors.primaryForeground} />
              <Text
                style={{
                  color: theme.colors.primaryForeground,
                  fontFamily: theme.typography.bodyMedium.fontFamily,
                  marginStart: theme.spacing.sm,
                }}
              >
                {t('supportSendCta') || 'Send via email'}
              </Text>
            </Pressable>
          </SurfaceCard>

          <SurfaceCard style={{ marginTop: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
              <Mail size={18} color={theme.colors.primary} style={{ marginEnd: theme.spacing.sm }} />
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontFamily: theme.typography.bodyMedium.fontFamily,
                  fontSize: 14,
                }}
              >
                {t('supportDirectEmailHeading') || 'Prefer to email us directly?'}
              </Text>
            </View>
            <Pressable onPress={handleDirectEmail} accessibilityRole="link">
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: theme.typography.bodyMedium.fontFamily,
                  fontSize: 14,
                }}
              >
                {SUPPORT_EMAIL}
              </Text>
            </Pressable>
          </SurfaceCard>
        </SectionBlock>
      </MarketingScaffold>
    </>
  );
}

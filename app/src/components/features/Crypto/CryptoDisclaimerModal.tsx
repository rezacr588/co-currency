import React from 'react';
import { Modal, ScrollView, Pressable } from 'react-native';
import styled from 'styled-components/native';
import { AlertTriangle, X } from 'lucide-react-native';
import { useColors } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/context/LanguageContext';

const ModalOverlay = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: center;
  align-items: center;
  padding: 20px;
`;

const ModalContent = styled.View<{ $bg: string; $border: string }>`
  background-color: ${props => props.$bg};
  border-radius: 16px;
  border-width: 1px;
  border-color: ${props => props.$border};
  max-width: 600px;
  width: 100%;
  max-height: 80%;
  overflow: hidden;
`;

const ModalHeader = styled.View<{ $border: string }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom-width: 1px;
  border-bottom-color: ${props => props.$border};
`;

const HeaderLeft = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex: 1;
`;

const IconWrapper = styled.View<{ $bg: string }>`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: ${props => props.$bg};
  align-items: center;
  justify-content: center;
`;

const Title = styled.Text<{ $color: string }>`
  font-size: 20px;
  font-weight: 700;
  color: ${props => props.$color};
  flex: 1;
`;

const CloseButton = styled.Pressable.attrs({
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
})<{ $bg: string }>`
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background-color: ${props => props.$bg};
  align-items: center;
  justify-content: center;
`;

const ModalBody = styled.ScrollView`
  padding: 20px;
`;

const Section = styled.View`
  margin-bottom: 24px;
`;

const SectionTitle = styled.Text<{ $color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.$color};
  margin-bottom: 12px;
`;

const BulletPoint = styled.View`
  flex-direction: row;
  gap: 8px;
  margin-bottom: 8px;
`;

const Bullet = styled.Text<{ $color: string }>`
  color: ${props => props.$color};
  font-size: 14px;
`;

const BulletText = styled.Text<{ $color: string }>`
  color: ${props => props.$color};
  font-size: 14px;
  line-height: 20px;
  flex: 1;
`;

const HighlightBox = styled.View<{ $bg: string; $border: string }>`
  background-color: ${props => props.$bg};
  border-width: 1px;
  border-color: ${props => props.$border};
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`;

const HighlightText = styled.Text<{ $color: string }>`
  color: ${props => props.$color};
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
`;

const ButtonContainer = styled.View<{ $border: string }>`
  padding: 20px;
  border-top-width: 1px;
  border-top-color: ${props => props.$border};
  flex-direction: row;
  gap: 12px;
`;

const Button = styled.Pressable<{ $bg: string }>`
  flex: 1;
  padding: 14px;
  border-radius: 8px;
  background-color: ${props => props.$bg};
  align-items: center;
`;

const ButtonText = styled.Text<{ $color: string }>`
  color: ${props => props.$color};
  font-size: 16px;
  font-weight: 600;
`;

const SecondaryButton = styled(Button)<{ $border: string }>`
  background-color: transparent;
  border-width: 1px;
  border-color: ${props => props.$border};
`;

interface CryptoDisclaimerModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const CryptoDisclaimerModal: React.FC<CryptoDisclaimerModalProps> = ({
  visible,
  onAccept,
  onDecline,
}) => {
  const colors = useColors();
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
    >
      <ModalOverlay>
        <ModalContent $bg={colors.card} $border={colors.border}>
          <ModalHeader $border={colors.border}>
            <HeaderLeft>
              <IconWrapper $bg="#f59e0b20">
                <AlertTriangle size={20} color="#f59e0b" />
              </IconWrapper>
              <Title $color={colors.foreground}>
                {t('cryptoDisclaimer') || 'Crypto Disclaimer'}
              </Title>
            </HeaderLeft>
            <CloseButton $bg={colors.muted} onPress={onDecline}>
              <X size={18} color={colors.foreground} />
            </CloseButton>
          </ModalHeader>

          <ModalBody>
            <HighlightBox $bg="#ef444420" $border="#ef4444">
              <HighlightText $color={colors.foreground}>
                {t('cryptoDisclaimerHighlight') || 'CoAI is a read-only crypto tracker. We do not hold, custody, or have access to your assets. This is not financial advice.'}
              </HighlightText>
            </HighlightBox>

            <Section>
              <SectionTitle $color={colors.foreground}>
                {t('readOnlyTracking') || 'Read-Only Tracking'}
              </SectionTitle>
              <BulletPoint>
                <Bullet $color={colors.mutedForeground}>•</Bullet>
                <BulletText $color={colors.mutedForeground}>
                  {t('cryptoDisclaimer1') || 'CoAI only reads public blockchain data using your wallet address.'}
                </BulletText>
              </BulletPoint>
              <BulletPoint>
                <Bullet $color={colors.mutedForeground}>•</Bullet>
                <BulletText $color={colors.mutedForeground}>
                  {t('cryptoDisclaimer2') || 'We never ask for private keys, seed phrases, or passwords.'}
                </BulletText>
              </BulletPoint>
              <BulletPoint>
                <Bullet $color={colors.mutedForeground}>•</Bullet>
                <BulletText $color={colors.mutedForeground}>
                  {t('cryptoDisclaimer3') || 'We cannot access, transfer, or control your crypto assets.'}
                </BulletText>
              </BulletPoint>
            </Section>

            <Section>
              <SectionTitle $color={colors.foreground}>
                {t('riskWarning') || 'Risk Warning'}
              </SectionTitle>
              <BulletPoint>
                <Bullet $color={colors.mutedForeground}>•</Bullet>
                <BulletText $color={colors.mutedForeground}>
                  {t('cryptoDisclaimer4') || 'Cryptocurrency investments are highly volatile and risky.'}
                </BulletText>
              </BulletPoint>
              <BulletPoint>
                <Bullet $color={colors.mutedForeground}>•</Bullet>
                <BulletText $color={colors.mutedForeground}>
                  {t('cryptoDisclaimer5') || 'Past performance does not guarantee future results.'}
                </BulletText>
              </BulletPoint>
              <BulletPoint>
                <Bullet $color={colors.mutedForeground}>•</Bullet>
                <BulletText $color={colors.mutedForeground}>
                  {t('cryptoDisclaimer6') || 'Only invest what you can afford to lose.'}
                </BulletText>
              </BulletPoint>
            </Section>

            <Section>
              <SectionTitle $color={colors.foreground}>
                {t('dataAccuracy') || 'Data Accuracy'}
              </SectionTitle>
              <BulletPoint>
                <Bullet $color={colors.mutedForeground}>•</Bullet>
                <BulletText $color={colors.mutedForeground}>
                  {t('cryptoDisclaimer7') || 'Prices and balances are fetched from third-party APIs and may have delays.'}
                </BulletText>
              </BulletPoint>
              <BulletPoint>
                <Bullet $color={colors.mutedForeground}>•</Bullet>
                <BulletText $color={colors.mutedForeground}>
                  {t('cryptoDisclaimer8') || 'Always verify important transactions on official blockchain explorers.'}
                </BulletText>
              </BulletPoint>
            </Section>

            <Section>
              <SectionTitle $color={colors.foreground}>
                {t('notFinancialAdvice') || 'Not Financial Advice'}
              </SectionTitle>
              <BulletPoint>
                <Bullet $color={colors.mutedForeground}>•</Bullet>
                <BulletText $color={colors.mutedForeground}>
                  {t('cryptoDisclaimer9') || 'CoAI provides information for tracking purposes only.'}
                </BulletText>
              </BulletPoint>
              <BulletPoint>
                <Bullet $color={colors.mutedForeground}>•</Bullet>
                <BulletText $color={colors.mutedForeground}>
                  {t('cryptoDisclaimer10') || 'Consult a qualified financial advisor before making investment decisions.'}
                </BulletText>
              </BulletPoint>
            </Section>
          </ModalBody>

          <ButtonContainer $border={colors.border}>
            <SecondaryButton $bg="transparent" $border={colors.border} onPress={onDecline}>
              <ButtonText $color={colors.foreground}>{t('decline') || 'Decline'}</ButtonText>
            </SecondaryButton>
            <Button $bg={colors.primary} onPress={onAccept}>
              <ButtonText $color="#fff">{t('iUnderstand') || 'I Understand'}</ButtonText>
            </Button>
          </ButtonContainer>
        </ModalContent>
      </ModalOverlay>
    </Modal>
  );
};

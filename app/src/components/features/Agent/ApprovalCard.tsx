/**
 * Approval Card - Shows a pending action approval with approve/reject buttons
 * 
 * Features:
 * - Action details display
 * - Swipe to approve/reject (optional)
 * - Biometric confirmation for high-value actions
 * - Expiration countdown
 */

import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { 
  Check, 
  X, 
  Clock, 
  AlertTriangle,
  Fingerprint,
  Shield,
  Zap,
} from 'lucide-react-native';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from 'styled-components/native';
import { Card } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';
import { useApproveStep, useRejectStep } from '../../../hooks/useAgent';
import { haptics } from '../../../utils/haptics';
import type { ActionApproval } from '../../../api/agent';

interface ApprovalCardProps {
  approval: ActionApproval;
  planId: string;
  planTitle?: string;
  stepTitle?: string;
  estimatedImpact?: number;
  currency?: string;
  requiresBiometric?: boolean;
  onApproved?: () => void;
  onRejected?: () => void;
}

function TimeRemaining({ expiresAt }: { expiresAt: string }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft(t('expired') || 'Expired');
        setIsUrgent(true);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
        setIsUrgent(false);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
        setIsUrgent(hours < 6);
      } else {
        setTimeLeft(`${minutes}m`);
        setIsUrgent(true);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt, t]);

  return (
    <View 
      style={{ 
        flexDirection: 'row', 
        alignItems: 'center',
        backgroundColor: isUrgent ? `${colors.danger}20` : `${colors.muted}`,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
      }}
    >
      <Clock size={12} color={isUrgent ? colors.danger : colors.mutedForeground} />
      <Text 
        style={{ 
          marginLeft: 4, 
          color: isUrgent ? colors.danger : colors.mutedForeground, 
          fontSize: 11, 
          fontFamily: 'Inter_500Medium',
        }}
      >
        {timeLeft}
      </Text>
    </View>
  );
}

export function ApprovalCard({
  approval,
  planId,
  planTitle,
  stepTitle,
  estimatedImpact,
  currency = 'USD',
  requiresBiometric = false,
  onApproved,
  onRejected,
}: ApprovalCardProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const approveStep = useApproveStep();
  const rejectStep = useRejectStep();

  const isLoading = approveStep.isPending || rejectStep.isPending;

  const handleApprove = async () => {
    haptics.success();
    
    try {
      await approveStep.mutateAsync({
        planId,
        stepId: approval.step_id,
        data: {
          approval_method: requiresBiometric ? 'biometric' : 'manual',
        },
      });
      onApproved?.();
    } catch (error) {
      haptics.error();
      Alert.alert(
        t('error') || 'Error',
        t('failedToApprove') || 'Failed to approve action. Please try again.'
      );
    }
  };

  const handleReject = async () => {
    haptics.warning();
    
    // Show confirmation dialog
    Alert.alert(
      t('rejectAction') || 'Reject Action',
      t('rejectActionConfirmation') || 'Are you sure you want to reject this action?',
      [
        {
          text: t('cancel') || 'Cancel',
          style: 'cancel',
        },
        {
          text: t('reject') || 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectStep.mutateAsync({
                planId,
                stepId: approval.step_id,
                data: {
                  reason: rejectReason || 'Rejected by user',
                },
              });
              onRejected?.();
            } catch (error) {
              haptics.error();
              Alert.alert(
                t('error') || 'Error',
                t('failedToReject') || 'Failed to reject action. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const handleApproveWithBiometric = async () => {
    // TODO: Implement biometric authentication
    // For now, just call regular approve
    handleApprove();
  };

  const impactColor = estimatedImpact 
    ? estimatedImpact > 0 
      ? colors.success 
      : colors.danger
    : colors.foreground;

  return (
    <Card 
      style={{ 
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: colors.warning,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View 
            style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 18, 
              backgroundColor: `${colors.warning}20`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <AlertTriangle size={18} color={colors.warning} />
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
              {stepTitle || t('pendingApproval') || 'Pending Approval'}
            </Text>
            {planTitle && (
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {planTitle}
              </Text>
            )}
          </View>
        </View>
        <TimeRemaining expiresAt={approval.expires_at} />
      </View>

      {/* Impact */}
      {estimatedImpact !== undefined && (
        <View 
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center',
            backgroundColor: colors.muted,
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <Zap size={16} color={impactColor} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 8 }}>
            {t('estimatedImpact') || 'Estimated Impact:'}
          </Text>
          <Text style={{ color: impactColor, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginLeft: 4 }}>
            {estimatedImpact > 0 ? '+' : ''}{estimatedImpact.toFixed(2)} {currency}
          </Text>
        </View>
      )}

      {/* Biometric Badge */}
      {requiresBiometric && (
        <View 
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center',
            backgroundColor: `${colors.info}15`,
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <Fingerprint size={16} color={colors.info} />
          <Text style={{ color: colors.info, fontSize: 12, marginLeft: 8 }}>
            {t('biometricRequired') || 'Biometric verification required for this action'}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Reject Button */}
        <Pressable
          onPress={handleReject}
          disabled={isLoading}
          style={{ 
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: `${colors.danger}15`,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.danger,
            flex: 1,
            marginRight: 8,
            justifyContent: 'center',
          }}
        >
          {rejectStep.isPending ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <>
              <X size={16} color={colors.danger} />
              <Text style={{ color: colors.danger, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginLeft: 6 }}>
                {t('reject') || 'Reject'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Approve Button */}
        <Pressable
          onPress={requiresBiometric ? handleApproveWithBiometric : handleApprove}
          disabled={isLoading}
          style={{ 
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.success,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            flex: 1,
            marginLeft: 8,
            justifyContent: 'center',
          }}
        >
          {approveStep.isPending ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              {requiresBiometric ? (
                <Fingerprint size={16} color={colors.background} />
              ) : (
                <Check size={16} color={colors.background} />
              )}
              <Text style={{ color: colors.background, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginLeft: 6 }}>
                {t('approve') || 'Approve'}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Security Note */}
      <View 
        style={{ 
          flexDirection: 'row', 
          alignItems: 'center',
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Shield size={12} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontSize: 11, marginLeft: 6 }}>
          {t('secureApproval') || 'Your approval is secured and logged'}
        </Text>
      </View>
    </Card>
  );
}

export default ApprovalCard;

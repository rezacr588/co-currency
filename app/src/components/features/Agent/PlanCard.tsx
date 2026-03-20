/**
 * Plan Card - Displays a financial plan with its steps and status
 * 
 * Features:
 * - Plan overview with status badge
 * - Progress indicator
 * - Step timeline view
 * - Quick actions (activate, pause, resume)
 */

import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Target,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  TrendingUp,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTheme } from 'styled-components/native';
import { Card } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';
import { useActivatePlan, usePausePlan, useResumePlan } from '../../../hooks/useAgent';
import { haptics } from '../../../utils/haptics';
import type { AgentPlan, PlanStep, PlanStatus, StepStatus } from '../../../api/agent';

interface PlanCardProps {
  plan: AgentPlan;
  onViewDetails?: (planId: string) => void;
  showSteps?: boolean;
}

function StatusBadge({ status }: { status: PlanStatus }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const getStatusConfig = (status: PlanStatus) => {
    switch (status) {
      case 'active':
        return { color: colors.success, icon: Play, label: t('active') || 'Active' };
      case 'paused':
        return { color: colors.warning, icon: Pause, label: t('paused') || 'Paused' };
      case 'completed':
        return { color: colors.info, icon: CheckCircle, label: t('completed') || 'Completed' };
      case 'cancelled':
        return { color: colors.danger, icon: AlertCircle, label: t('cancelled') || 'Cancelled' };
      case 'draft':
      default:
        return { color: colors.mutedForeground, icon: Clock, label: t('draft') || 'Draft' };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <View 
      style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: `${config.color}20`,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
      }}
    >
      <Icon size={12} color={config.color} />
      <Text 
        style={{ 
          marginLeft: 4, 
          color: config.color, 
          fontSize: 11, 
          fontFamily: 'Inter_600SemiBold',
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { color: colors.danger, label: t('urgent') || 'Urgent' };
      case 'high':
        return { color: colors.warning, label: t('high') || 'High' };
      case 'medium':
        return { color: colors.info, label: t('medium') || 'Medium' };
      case 'low':
      default:
        return { color: colors.mutedForeground, label: t('low') || 'Low' };
    }
  };

  const config = getPriorityConfig(priority);

  return (
    <View 
      style={{ 
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: config.color,
      }}
    >
      <Text 
        style={{ 
          color: config.color, 
          fontSize: 10, 
          fontFamily: 'Inter_500Medium',
          textTransform: 'uppercase',
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}

function StepItem({ step, isLast }: { step: PlanStep; isLast: boolean }) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const getStepStatusConfig = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return { color: colors.success, icon: CheckCircle };
      case 'executing':
        return { color: colors.info, icon: TrendingUp };
      case 'approved':
        return { color: colors.accent, icon: Play };
      case 'rejected':
        return { color: colors.danger, icon: AlertCircle };
      case 'failed':
        return { color: colors.danger, icon: AlertCircle };
      case 'skipped':
        return { color: colors.mutedForeground, icon: ChevronRight };
      case 'pending':
      default:
        return { color: colors.mutedForeground, icon: Clock };
    }
  };

  const config = getStepStatusConfig(step.status);
  const Icon = config.icon;

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* Timeline */}
      <View style={{ width: 24, alignItems: 'center' }}>
        <View 
          style={{ 
            width: 20, 
            height: 20, 
            borderRadius: 10, 
            backgroundColor: `${config.color}20`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={12} color={config.color} />
        </View>
        {!isLast && (
          <View 
            style={{ 
              width: 2, 
              flex: 1, 
              backgroundColor: colors.border,
              marginVertical: 4,
            }} 
          />
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, marginLeft: 12, paddingBottom: isLast ? 0 : 16 }}>
        <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
          {step.title}
        </Text>
        {step.description && (
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
            {step.description}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Text style={{ color: config.color, fontSize: 11, fontFamily: 'Inter_500Medium' }}>
            {t(step.status) || step.status}
          </Text>
          {step.estimated_impact && (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginLeft: 8 }}>
              Impact: {step.estimated_impact > 0 ? '+' : ''}{step.estimated_impact.toFixed(0)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export function PlanCard({ plan, onViewDetails, showSteps = false }: PlanCardProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(showSteps);

  const activatePlan = useActivatePlan();
  const pausePlan = usePausePlan();
  const resumePlan = useResumePlan();

  const isLoading = activatePlan.isPending || pausePlan.isPending || resumePlan.isPending;

  // Calculate progress
  const steps = plan.steps || [];
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  const handleActivate = async () => {
    haptics.medium();
    await activatePlan.mutateAsync(plan.id);
  };

  const handlePause = async () => {
    haptics.light();
    await pausePlan.mutateAsync(plan.id);
  };

  const handleResume = async () => {
    haptics.medium();
    await resumePlan.mutateAsync(plan.id);
  };

  const handleToggleExpand = () => {
    haptics.light();
    setExpanded(!expanded);
  };

  const handleViewDetails = () => {
    haptics.light();
    onViewDetails?.(plan.id);
  };

  return (
    <Card style={{ padding: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
        <View 
          style={{ 
            width: 40, 
            height: 40, 
            borderRadius: 12, 
            backgroundColor: `${colors.accent}20`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Target size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: 'Inter_600SemiBold' }}>
            {plan.title}
          </Text>
          {plan.description && (
            <Text 
              style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}
              numberOfLines={2}
            >
              {plan.description}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <StatusBadge status={plan.status} />
          <View style={{ marginTop: 6 }}>
            <PriorityBadge priority={plan.priority} />
          </View>
        </View>
      </View>

      {/* Target Amount */}
      {plan.target_amount && plan.target_currency && (
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
          <TrendingUp size={16} color={colors.accent} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 8 }}>
            {t('targetAmount') || 'Target:'}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginLeft: 4 }}>
            {plan.target_amount.toLocaleString()} {plan.target_currency}
          </Text>
        </View>
      )}

      {/* Progress Bar */}
      {steps.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {t('progress') || 'Progress'}
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
              {completedSteps}/{steps.length} {t('steps') || 'steps'}
            </Text>
          </View>
          <View 
            style={{ 
              height: 6, 
              backgroundColor: colors.muted, 
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <View 
              style={{ 
                height: '100%', 
                width: `${progress}%`,
                backgroundColor: colors.success,
                borderRadius: 3,
              }} 
            />
          </View>
        </View>
      )}

      {/* Steps (expandable) */}
      {steps.length > 0 && (
        <Pressable 
          onPress={handleToggleExpand}
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            paddingVertical: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            marginTop: 4,
          }}
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            {expanded ? t('hideSteps') || 'Hide Steps' : t('showSteps') || 'Show Steps'}
          </Text>
          {expanded ? (
            <ChevronUp size={18} color={colors.mutedForeground} />
          ) : (
            <ChevronDown size={18} color={colors.mutedForeground} />
          )}
        </Pressable>
      )}

      {expanded && steps.length > 0 && (
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          {steps.map((step, index) => (
            <StepItem 
              key={step.id} 
              step={step} 
              isLast={index === steps.length - 1} 
            />
          ))}
        </View>
      )}

      {/* Actions */}
      <View 
        style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        {/* Status Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {plan.status === 'draft' && (
            <Pressable
              onPress={handleActivate}
              disabled={isLoading}
              style={{ 
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.success,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                marginRight: 8,
              }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <Play size={14} color={colors.background} />
                  <Text style={{ color: colors.background, fontSize: 13, fontFamily: 'Inter_500Medium', marginLeft: 4 }}>
                    {t('activate') || 'Activate'}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {plan.status === 'active' && (
            <Pressable
              onPress={handlePause}
              disabled={isLoading}
              style={{ 
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.warning,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                marginRight: 8,
              }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <Pause size={14} color={colors.background} />
                  <Text style={{ color: colors.background, fontSize: 13, fontFamily: 'Inter_500Medium', marginLeft: 4 }}>
                    {t('pause') || 'Pause'}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {plan.status === 'paused' && (
            <Pressable
              onPress={handleResume}
              disabled={isLoading}
              style={{ 
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.success,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                marginRight: 8,
              }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <Play size={14} color={colors.background} />
                  <Text style={{ color: colors.background, fontSize: 13, fontFamily: 'Inter_500Medium', marginLeft: 4 }}>
                    {t('resume') || 'Resume'}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {/* View Details */}
        {onViewDetails && (
          <Pressable
            onPress={handleViewDetails}
            style={{ 
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 6,
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium', marginRight: 4 }}>
              {t('viewDetails') || 'Details'}
            </Text>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* AI Reasoning (if available) */}
      {plan.ai_reasoning && (
        <View 
          style={{ 
            marginTop: 12,
            backgroundColor: `${colors.info}10`,
            padding: 12,
            borderRadius: 8,
            borderLeftWidth: 3,
            borderLeftColor: colors.info,
          }}
        >
          <Text style={{ color: colors.info, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 4 }}>
            {t('aiReasoning') || 'AI REASONING'}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 18 }}>
            {plan.ai_reasoning}
          </Text>
        </View>
      )}

      {/* Dates */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        <Calendar size={12} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontSize: 11, marginLeft: 4 }}>
          {t('created') || 'Created'}: {new Date(plan.created_at).toLocaleDateString()}
        </Text>
      </View>
    </Card>
  );
}

export default PlanCard;

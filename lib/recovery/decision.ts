import type { RiskEvidence } from '@/lib/risk/analyzer';
import type { RecoveryAction, ActionLevel } from '@/lib/types';
import type { ActionPerformance } from '@/lib/learning/outcomes';

export interface RecoveryDecision {
  action: RecoveryAction;
  actionLevel: ActionLevel;
  toolName: string;
  explanation: string;
  expectedRecovery: number;
  confidence: number;
  potentialDownside: string;
  requiresApproval: boolean;
  learningInsight?: string | null;
}

export function recommendRecoveryAction(
  evidence: RiskEvidence,
  riskType: string,
  atRiskAmount: number,
  riskScore: number,
  config: {
    auto_retry: boolean;
    auto_payment_link: boolean;
    human_approval_required: boolean;
    max_auto_recovery_amount: number;
    max_retry_attempts: number;
    confidence_threshold: number;
  },
  historicalPerformance?: ActionPerformance[]
): RecoveryDecision {
  const confidence = riskScore;
  const belowThreshold = confidence < config.confidence_threshold;

  // If confidence too low, do not act autonomously
  if (belowThreshold) {
    return {
      action: 'escalate_human',
      actionLevel: 'low',
      toolName: 'record_agent_action',
      explanation: `Insufficient evidence for autonomous action (confidence ${confidence}% below threshold ${config.confidence_threshold}%). Escalating to human review.`,
      expectedRecovery: 0,
      confidence,
      potentialDownside: 'No automated action taken — revenue may remain at risk until manual review.',
      requiresApproval: false,
    };
  }

  // Check retry attempts
  if (evidence.previousFailures >= config.max_retry_attempts) {
    return {
      action: 'create_payment_link',
      actionLevel: 'medium',
      toolName: 'create_payment_link',
      explanation: `Maximum retry attempts (${config.max_retry_attempts}) reached. A payment link is recommended to give the customer a fresh payment path.`,
      expectedRecovery: atRiskAmount,
      confidence,
      potentialDownside: 'Customer may not complete the payment link if the underlying issue persists.',
      requiresApproval: config.human_approval_required,
    };
  }

  // Decision hierarchy based on risk type and evidence
  switch (riskType) {
    case 'failed_payment': {
      // If customer has previous successful payments, retry is appropriate
      if (evidence.lastSuccessfulPayment && evidence.previousFailures <= 2) {
        const candidates: RecoveryAction[] = ['retry_payment', 'create_payment_link'];
        const learned = applyHistoricalLearning(historicalPerformance, candidates);
        if (learned.preferredAction === 'create_payment_link') {
          return {
            action: 'create_payment_link',
            actionLevel: 'medium',
            toolName: 'create_payment_link',
            explanation: 'A payment link is recommended over a retry because historical data shows it performs better for similar payment failures.',
            expectedRecovery: atRiskAmount,
            confidence,
            potentialDownside: 'Customer may not act on the link without follow-up.',
            requiresApproval: config.human_approval_required,
            learningInsight: learned.insight,
          };
        }
        return {
          action: 'retry_payment',
          actionLevel: 'low',
          toolName: 'initiate_payment_retry',
          explanation: 'A payment retry is recommended because this customer has previously completed successful payments and the current issue appears temporary.',
          expectedRecovery: atRiskAmount,
          confidence,
          potentialDownside: 'Retry may fail again if the underlying card/bank issue persists.',
          requiresApproval: false,
          learningInsight: learned.insight,
        };
      }
      // Otherwise generate a payment link
      return {
        action: 'create_payment_link',
        actionLevel: 'medium',
        toolName: 'create_payment_link',
        explanation: 'A payment link is recommended because the customer has multiple failures. A fresh link gives them flexibility to use a different payment method.',
        expectedRecovery: atRiskAmount,
        confidence,
        potentialDownside: 'Customer may not act on the link without follow-up.',
        requiresApproval: config.human_approval_required,
      };
    }

    case 'abandoned_checkout': {
      return {
        action: 'send_reminder',
        actionLevel: 'medium',
        toolName: 'send_recovery_message',
        explanation: 'A recovery reminder is recommended because the customer abandoned checkout. A gentle nudge may recover the sale without requiring a new payment flow.',
        expectedRecovery: atRiskAmount,
        confidence,
        potentialDownside: 'Customer may have lost interest; reminder could be ignored.',
        requiresApproval: config.human_approval_required,
      };
    }

    case 'inactive_customer': {
      if (evidence.daysSinceLastPayment !== null && evidence.daysSinceLastPayment > 90) {
        return {
          action: 'offer_recovery_option',
          actionLevel: 'high',
          toolName: 'recommend_recovery_action',
          explanation: 'An incentive-based recovery offer is recommended because the customer has been inactive for an extended period. A targeted offer may re-engage them.',
          expectedRecovery: atRiskAmount,
          confidence,
          potentialDownside: 'Offering a discount reduces margin and may not re-engage a fully churned customer.',
          requiresApproval: true,
        };
      }
      return {
        action: 'send_reminder',
        actionLevel: 'medium',
        toolName: 'send_recovery_message',
        explanation: 'A re-engagement reminder is recommended because the customer has been inactive. A personalized message may prompt a return.',
        expectedRecovery: atRiskAmount,
        confidence,
        potentialDownside: 'Customer may have switched to a competitor.',
        requiresApproval: config.human_approval_required,
      };
    }

    case 'subscription_failure': {
      return {
        action: 'create_payment_link',
        actionLevel: 'medium',
        toolName: 'create_payment_link',
        explanation: 'A payment link is recommended for subscription recovery because it lets the customer complete the failed renewal with an updated payment method.',
        expectedRecovery: atRiskAmount,
        confidence,
        potentialDownside: 'Subscription may cancel if the customer does not complete the link promptly.',
        requiresApproval: config.human_approval_required,
      };
    }

    default:
      return {
        action: 'escalate_human',
        actionLevel: 'low',
        toolName: 'record_agent_action',
        explanation: 'Unknown risk type — escalating to human review.',
        expectedRecovery: 0,
        confidence,
        potentialDownside: 'No automated action taken.',
        requiresApproval: false,
      };
  }
}

function applyHistoricalLearning(
  performance: ActionPerformance[] | undefined,
  candidates: RecoveryAction[]
): { preferredAction: RecoveryAction | null; insight: string | null } {
  if (!performance || performance.length === 0) return { preferredAction: null, insight: null };

  const withData = performance.filter(
    (p) => p.hasSufficientData && candidates.includes(p.action as RecoveryAction)
  );
  if (withData.length < 2) return { preferredAction: null, insight: null };

  withData.sort((a, b) => b.recoveryRate - a.recoveryRate);
  const best = withData[0];
  const second = withData[1];

  if (best.recoveryRate <= second.recoveryRate + 10) return { preferredAction: null, insight: null };

  const labels: Record<string, string> = {
    retry_payment: 'Payment Retry',
    create_payment_link: 'Payment Link',
    send_reminder: 'Reminder',
    escalate_human: 'Escalation',
  };

  const insight = `${labels[best.action] || best.action} is recommended because it has the highest historical recovery rate (${best.recoveryRate}%) for similar cases, compared with ${second.recoveryRate}% for ${(labels[second.action] || second.action).toLowerCase()}.`;

  return {
    preferredAction: best.action as RecoveryAction,
    insight,
  };
}

export function actionLevelForAction(action: RecoveryAction): ActionLevel {
  switch (action) {
    case 'retry_payment':
      return 'low';
    case 'send_reminder':
      return 'medium';
    case 'create_payment_link':
      return 'medium';
    case 'offer_recovery_option':
      return 'high';
    case 'escalate_human':
      return 'low';
    default:
      return 'low';
  }
}

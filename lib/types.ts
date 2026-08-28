export type RiskType =
  | 'failed_payment'
  | 'abandoned_checkout'
  | 'inactive_customer'
  | 'subscription_failure';

export type RiskLevel = 'low' | 'medium' | 'high';
export type RiskStatus =
  | 'open'
  | 'investigating'
  | 'action_pending'
  | 'action_approved'
  | 'action_rejected'
  | 'recovered'
  | 'lost'
  | 'escalated';

export type ActionLevel = 'low' | 'medium' | 'high';
export type ApprovalStatus = 'auto' | 'pending' | 'approved' | 'rejected' | 'modified';
export type ExecutionStatus =
  | 'pending'
  | 'executing'
  | 'success'
  | 'failed'
  | 'skipped';

export type RecoveryAction =
  | 'retry_payment'
  | 'send_reminder'
  | 'create_payment_link'
  | 'offer_recovery_option'
  | 'escalate_human'
  | 'do_nothing';

export interface Business {
  id: string;
  name: string;
  email: string | null;
  total_processed_revenue: number;
  revenue_recovered: number;
  revenue_lost: number;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  customer_number: string | null;
  status: string;
  lifetime_value: number;
  total_orders: number;
  last_payment_at: string | null;
  avg_payment_interval_days: number | null;
  created_at: string;
}

export interface Order {
  id: string;
  business_id: string;
  customer_id: string;
  order_number: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface Payment {
  id: string;
  business_id: string;
  order_id: string;
  customer_id: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  error_code: string | null;
  error_description: string | null;
  retry_count: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  customer_id: string;
  razorpay_subscription_id: string | null;
  razorpay_plan_id: string | null;
  plan_name: string;
  amount: number;
  billing_cycle: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
}

export interface RevenueRisk {
  id: string;
  business_id: string;
  customer_id: string;
  order_id: string | null;
  amount: number;
  risk_type: RiskType;
  risk_level: RiskLevel;
  risk_score: number;
  reason: string | null;
  recommended_action: string | null;
  status: RiskStatus;
  detected_at: string;
  resolved_at: string | null;
}

export interface AgentTask {
  id: string;
  business_id: string;
  revenue_risk_id: string | null;
  customer_id: string | null;
  status: string;
  trigger: string | null;
  summary: string | null;
  confidence: number | null;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AgentAction {
  id: string;
  business_id: string;
  task_id: string | null;
  revenue_risk_id: string | null;
  customer_id: string | null;
  tool_name: string;
  action_level: ActionLevel;
  decision: string | null;
  evidence: Record<string, unknown> | null;
  expected_recovery: number | null;
  approval_status: ApprovalStatus;
  execution_status: ExecutionStatus;
  result: Record<string, unknown> | null;
  revenue_recovered: number | null;
  error: string | null;
  razorpay_resource_id: string | null;
  created_at: string;
  executed_at: string | null;
}

export interface Approval {
  id: string;
  business_id: string;
  action_id: string;
  customer_id: string | null;
  revenue_risk_id: string | null;
  amount: number | null;
  action_type: string;
  reason: string | null;
  status: string;
  modified_amount: number | null;
  reviewer_note: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface Campaign {
  id: string;
  business_id: string;
  customer_id: string;
  revenue_risk_id: string | null;
  message: string;
  channel: string;
  reason: string | null;
  expected_outcome: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
}

export interface WebhookEvent {
  id: string;
  event_id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  business_id: string;
  customer_id: string | null;
  revenue_risk_id: string | null;
  action_id: string | null;
  timestamp: string;
  category: string;
  event: string;
  details: Record<string, unknown> | null;
  revenue_impact: number | null;
  metadata: Record<string, unknown> | null;
}

export interface AgentConfig {
  id: string;
  business_id: string;
  auto_analysis: boolean;
  auto_retry: boolean;
  auto_payment_link: boolean;
  human_approval_required: boolean;
  max_auto_recovery_amount: number;
  max_retry_attempts: number;
  confidence_threshold: number;
  agent_status: string;
  current_task: string | null;
  updated_at: string;
}

export interface RiskAssessment {
  riskScore: number;
  riskLevel: RiskLevel;
  reason: string;
  evidence: {
    lastSuccessfulPayment: string | null;
    previousFailures: number;
    avgPaymentIntervalDays: number | null;
    customerStatus: string;
    daysSinceLastPayment: number | null;
  };
  recommendedAction: RecoveryAction;
  expectedRecovery: number;
  confidence: number;
  potentialDownside: string;
  explanation: string;
}

export interface DashboardMetrics {
  totalProcessedRevenue: number;
  revenueAtRisk: number;
  revenueRecovered: number;
  revenueLost: number;
  recoveryRate: number;
  failedPayments: number;
  customersAtRisk: number;
  activeInterventions: number;
  averageRecoveryTimeHours: number;
  riskBreakdown: {
    failed_payments: number;
    abandoned_checkouts: number;
    inactive_customers: number;
    subscription_failures: number;
  };
}

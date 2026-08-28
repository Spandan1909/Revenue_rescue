import { createServerClient } from '@/lib/supabase/server';
import type {
  Customer,
  Payment,
  Order,
  Subscription,
  RevenueRisk,
  AgentConfig,
  AgentTask,
  AgentAction,
  RiskAssessment,
  DashboardMetrics,
} from '@/lib/types';
import { gatherEvidence, calculateRiskScore, riskLevelFromScore, diagnoseReason, calculateDaysSince } from '@/lib/risk/analyzer';
import { recommendRecoveryAction, type RecoveryDecision } from '@/lib/recovery/decision';
import { getActionPerformance } from '@/lib/learning/outcomes';
import { recordAudit } from '@/lib/audit/logger';
import {
  createPaymentLink,
  createOrder,
  getPaymentStatus,
  isRazorpayConfigured,
  createSimulatedPaymentLink,
  createSimulatedOrder,
  type RazorpayPaymentLink,
} from '@/lib/razorpay/server';

// ─── Agent Tools ──────────────────────────────────────────────

export interface AgentToolContext {
  businessId: string;
  config: AgentConfig;
}

export async function getCustomer(customerId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .maybeSingle();
  if (error) throw new Error(`get_customer failed: ${error.message}`);
  return data as Customer | null;
}

export async function getCustomerPaymentHistory(customerId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`get_customer_payment_history failed: ${error.message}`);
  return (data || []) as Payment[];
}

export async function getCustomerOrders(customerId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`get_customer_orders failed: ${error.message}`);
  return (data || []) as Order[];
}

export async function getCustomerSubscriptions(customerId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`get_subscription_status failed: ${error.message}`);
  return (data || []) as Subscription[];
}

export async function getFailedPayments(businessId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('payments')
    .select('*, customers(name)')
    .eq('business_id', businessId)
    .eq('status', 'failed')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`get_failed_payments failed: ${error.message}`);
  return data || [];
}

export async function getCheckoutStatus(orderId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(`get_checkout_status failed: ${error.message}`);
  return data as Order | null;
}

export function calculateRevenueRisk(
  customer: Customer,
  payments: Payment[],
  orders: Order[],
  subscriptions: Subscription[],
  riskType: string,
  atRiskAmount: number
): RiskAssessment {
  const evidence = gatherEvidence({ customer, payments, orders, subscriptions });
  const riskScore = calculateRiskScore(evidence, riskType, atRiskAmount);
  const riskLevel = riskLevelFromScore(riskScore);
  const reason = diagnoseReason(evidence, riskType);

  return {
    riskScore,
    riskLevel,
    reason,
    evidence: {
      lastSuccessfulPayment: evidence.lastSuccessfulPayment,
      previousFailures: evidence.previousFailures,
      avgPaymentIntervalDays: evidence.avgPaymentIntervalDays,
      customerStatus: evidence.customerStatus,
      daysSinceLastPayment: evidence.daysSinceLastPayment,
    },
    recommendedAction: 'retry_payment',
    expectedRecovery: atRiskAmount,
    confidence: riskScore,
    potentialDownside: '',
    explanation: reason,
  };
}

export function analyzeChurnRisk(
  customer: Customer,
  payments: Payment[],
  orders: Order[]
): { churnScore: number; reason: string } {
  const evidence = gatherEvidence({ customer, payments, orders, subscriptions: [] });
  let churnScore = 0;

  if (evidence.daysSinceLastPayment !== null) {
    if (evidence.daysSinceLastPayment > 90) churnScore += 50;
    else if (evidence.daysSinceLastPayment > 60) churnScore += 35;
    else if (evidence.daysSinceLastPayment > 30) churnScore += 20;
  }

  if (evidence.customerStatus === 'churned') churnScore += 30;
  else if (evidence.customerStatus === 'inactive') churnScore += 20;

  if (evidence.previousFailures >= 3) churnScore += 15;

  churnScore = Math.min(100, churnScore);

  let reason = 'Customer shows signs of disengagement';
  if (evidence.daysSinceLastPayment !== null && evidence.daysSinceLastPayment > 90) {
    reason = 'Customer has been inactive for over 90 days — high churn probability';
  } else if (evidence.daysSinceLastPayment !== null && evidence.daysSinceLastPayment > 60) {
    reason = 'Customer has been inactive for over 60 days — moderate churn risk';
  }

  return { churnScore, reason };
}

// ─── Agent Decision Pipeline ─────────────────────────────────

export interface AgentRunResult {
  task: AgentTask;
  actions: AgentAction[];
  assessment: RiskAssessment;
  decision: RecoveryDecision;
  approvalNeeded: boolean;
  paymentLink?: RazorpayPaymentLink | null;
  simulated: boolean;
  error?: string;
}

export async function runAgentForRisk(
  riskId: string,
  businessId: string
): Promise<AgentRunResult> {
  const supabase = createServerClient();

  // Fetch config
  const { data: configData, error: configFetchError } = await supabase
    .from('agent_config')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();
  if (configFetchError) {
    throw new Error(`Failed to fetch agent config: ${configFetchError.message}`);
  }
  let config = configData as AgentConfig | null;

  if (!config) {
    // Create default config if missing
    const { data: newConfig, error: configInsertError } = await supabase
      .from('agent_config')
      .insert({
        business_id: businessId,
        auto_analysis: true,
        auto_retry: false,
        auto_payment_link: false,
        human_approval_required: true,
        max_auto_recovery_amount: 2000,
        max_retry_attempts: 3,
        confidence_threshold: 65,
        agent_status: 'idle',
      })
      .select()
      .maybeSingle();
    if (configInsertError) {
      throw new Error(`Failed to create agent config: ${configInsertError.message}`);
    }
    config = newConfig as AgentConfig | null;
  }

  if (!config) {
    throw new Error('Agent config could not be found or created');
  }

  // Update agent status
  await supabase
    .from('agent_config')
    .update({ agent_status: 'running', current_task: `Investigating risk ${riskId.slice(0, 8)}` })
    .eq('id', config.id);

  // Fetch the risk
  const { data: risk } = await supabase
    .from('revenue_risks')
    .select('*')
    .eq('id', riskId)
    .maybeSingle();
  const revenueRisk = risk as RevenueRisk | null;

  if (!revenueRisk) throw new Error('Revenue risk not found');

  // Create agent task
  const { data: taskData } = await supabase
    .from('agent_tasks')
    .insert({
      business_id: businessId,
      revenue_risk_id: riskId,
      customer_id: revenueRisk.customer_id,
      status: 'running',
      trigger: `Risk detected: ${revenueRisk.risk_type} (₹${revenueRisk.amount})`,
    })
    .select()
    .single();
  const task = taskData as AgentTask;

  // Audit: detection
  await recordAudit({
    business_id: businessId,
    customer_id: revenueRisk.customer_id,
    revenue_risk_id: riskId,
    task_id: task.id,
    category: 'detection',
    event: 'Revenue risk detected',
    details: {
      risk_type: revenueRisk.risk_type,
      amount: revenueRisk.amount,
      risk_level: revenueRisk.risk_level,
      risk_score: revenueRisk.risk_score,
    },
    metadata: { confidence: revenueRisk.risk_score },
  });

  // Update risk status
  await supabase
    .from('revenue_risks')
    .update({ status: 'investigating' })
    .eq('id', riskId);

  // Step 1: Detect — gather customer data
  const customer = await getCustomer(revenueRisk.customer_id);
  if (!customer) throw new Error('Customer not found');

  const payments = await getCustomerPaymentHistory(revenueRisk.customer_id);
  const orders = await getCustomerOrders(revenueRisk.customer_id);
  const subscriptions = await getCustomerSubscriptions(revenueRisk.customer_id);

  // Audit: investigation
  await recordAudit({
    business_id: businessId,
    customer_id: customer.id,
    revenue_risk_id: riskId,
    action_id: null,
    category: 'diagnosis',
    event: 'Agent inspecting customer history',
    details: {
      customer: customer.name,
      payments_count: payments.length,
      failed_payments: payments.filter((p) => p.status === 'failed').length,
      successful_payments: payments.filter((p) => p.status === 'captured').length,
      orders_count: orders.length,
    },
  });

  // Step 2: Diagnose
  const evidence = gatherEvidence({ customer, payments, orders, subscriptions });
  const riskScore = calculateRiskScore(evidence, revenueRisk.risk_type, revenueRisk.amount);
  const reason = diagnoseReason(evidence, revenueRisk.risk_type);

  // Update risk with diagnosis
  await supabase
    .from('revenue_risks')
    .update({
      risk_score: riskScore,
      risk_level: riskLevelFromScore(riskScore),
      reason,
    })
    .eq('id', riskId);

  // Audit: diagnosis
  await recordAudit({
    business_id: businessId,
    customer_id: customer.id,
    revenue_risk_id: riskId,
    category: 'diagnosis',
    event: 'Diagnosis complete',
    details: { reason, risk_score: riskScore },
    metadata: { confidence: riskScore },
  });

  // Step 3: Decide
  const historicalPerformance = await getActionPerformance(businessId);
  const decision = recommendRecoveryAction(
    evidence,
    revenueRisk.risk_type,
    revenueRisk.amount,
    riskScore,
    {
      auto_retry: config.auto_retry,
      auto_payment_link: config.auto_payment_link,
      human_approval_required: config.human_approval_required,
      max_auto_recovery_amount: config.max_auto_recovery_amount,
      max_retry_attempts: config.max_retry_attempts,
      confidence_threshold: config.confidence_threshold,
    },
    historicalPerformance
  );

  const assessment: RiskAssessment = {
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    reason,
    evidence: {
      lastSuccessfulPayment: evidence.lastSuccessfulPayment,
      previousFailures: evidence.previousFailures,
      avgPaymentIntervalDays: evidence.avgPaymentIntervalDays,
      customerStatus: evidence.customerStatus,
      daysSinceLastPayment: evidence.daysSinceLastPayment,
    },
    recommendedAction: decision.action,
    expectedRecovery: decision.expectedRecovery,
    confidence: decision.confidence,
    potentialDownside: decision.potentialDownside,
    explanation: decision.explanation,
  };

  // Update task
  await supabase
    .from('agent_tasks')
    .update({
      summary: decision.explanation,
      confidence: decision.confidence,
    })
    .eq('id', task.id);

  // Audit: decision
  await recordAudit({
    business_id: businessId,
    customer_id: customer.id,
    revenue_risk_id: riskId,
    category: 'decision',
    event: `Agent recommended: ${decision.action}`,
    details: {
      action: decision.action,
      tool: decision.toolName,
      confidence: decision.confidence,
      explanation: decision.explanation,
      expected_recovery: decision.expectedRecovery,
      learning_insight: decision.learningInsight ?? null,
    },
    metadata: { action_level: decision.actionLevel },
  });

  // Step 4: Act — create agent action record
  const { data: actionData } = await supabase
    .from('agent_actions')
    .insert({
      business_id: businessId,
      task_id: task.id,
      revenue_risk_id: riskId,
      customer_id: customer.id,
      tool_name: decision.toolName,
      action_level: decision.actionLevel,
      decision: decision.action,
      evidence: evidence as unknown as Record<string, unknown>,
      expected_recovery: decision.expectedRecovery,
      approval_status: decision.requiresApproval ? 'pending' : 'auto',
      execution_status: 'pending',
    })
    .select()
    .single();
  const action = actionData as AgentAction;

  const actions: AgentAction[] = [action];

  let paymentLink: RazorpayPaymentLink | null = null;
  let simulated = false;
  let approvalNeeded = decision.requiresApproval;

  // If approval is needed, create approval record and stop
  if (decision.requiresApproval) {
    await supabase
      .from('approvals')
      .insert({
        business_id: businessId,
        action_id: action.id,
        customer_id: customer.id,
        revenue_risk_id: riskId,
        amount: revenueRisk.amount,
        action_type: decision.action,
        reason: decision.explanation,
        status: 'pending',
      });

    await supabase
      .from('revenue_risks')
      .update({ status: 'action_pending', recommended_action: decision.action })
      .eq('id', riskId);

    await recordAudit({
      business_id: businessId,
      customer_id: customer.id,
      revenue_risk_id: riskId,
      action_id: action.id,
      category: 'approval',
      event: 'Human approval requested',
      details: {
        action: decision.action,
        amount: revenueRisk.amount,
        reason: decision.explanation,
      },
    });
  } else {
    // Execute automatically (low-risk action)
    if (decision.action === 'retry_payment' && config.auto_retry) {
      // Auto-retry: create order on Razorpay
      const orderResult = isRazorpayConfigured()
        ? await createOrder({ amount: revenueRisk.amount, receipt: `retry_${riskId.slice(0, 12)}` })
        : createSimulatedOrder({ amount: revenueRisk.amount, receipt: `retry_${riskId.slice(0, 12)}` });

      simulated = orderResult.simulated || false;

      await supabase
        .from('agent_actions')
        .update({
          execution_status: orderResult.success ? 'success' : 'failed',
          result: orderResult.success ? (orderResult.data as unknown as Record<string, unknown>) : null,
          error: orderResult.error || null,
          razorpay_resource_id: orderResult.data?.id || null,
          executed_at: new Date().toISOString(),
        })
        .eq('id', action.id);

      await recordAudit({
        business_id: businessId,
        customer_id: customer.id,
        revenue_risk_id: riskId,
        action_id: action.id,
        category: 'action',
        event: orderResult.success
          ? `Payment retry initiated${simulated ? ' (simulated)' : ''}`
          : 'Payment retry failed',
        details: orderResult.success ? { order_id: orderResult.data?.id } : { error: orderResult.error },
        metadata: { simulated, tool: 'initiate_payment_retry' },
      });
    } else if (decision.action === 'escalate_human') {
      await supabase
        .from('agent_actions')
        .update({
          execution_status: 'skipped',
          executed_at: new Date().toISOString(),
        })
        .eq('id', action.id);

      await supabase
        .from('revenue_risks')
        .update({ status: 'escalated' })
        .eq('id', riskId);

      await recordAudit({
        business_id: businessId,
        customer_id: customer.id,
        revenue_risk_id: riskId,
        action_id: action.id,
        category: 'action',
        event: 'Escalated to manual review',
        details: { reason: decision.explanation },
      });
    }
  }

  // Complete task only if no approval is needed; otherwise leave it running
  // so the UI reflects that the agent is waiting on a human decision.
  if (!decision.requiresApproval) {
    await supabase
      .from('agent_tasks')
      .update({
        status: 'completed',
        result: decision.explanation,
        completed_at: new Date().toISOString(),
      })
      .eq('id', task.id);
  } else {
    await supabase
      .from('agent_tasks')
      .update({
        result: `Awaiting human approval: ${decision.action}`,
      })
      .eq('id', task.id);
  }

  // Reset agent status
  await supabase
    .from('agent_config')
    .update({ agent_status: 'idle', current_task: null })
    .eq('id', config.id);

  return {
    task,
    actions,
    assessment,
    decision,
    approvalNeeded,
    paymentLink,
    simulated,
  };
}

// ─── Execute Approved Action ──────────────────────────────────

export async function executeApprovedAction(
  actionId: string,
  businessId: string,
  modifiedAmount?: number | null
): Promise<{ success: boolean; paymentLink?: RazorpayPaymentLink | null; simulated: boolean; error?: string }> {
  const supabase = createServerClient();

  const { data: action } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .maybeSingle();
  const agentAction = action as AgentAction | null;
  if (!agentAction) throw new Error('Action not found');

  const { data: risk } = await supabase
    .from('revenue_risks')
    .select('*')
    .eq('id', agentAction.revenue_risk_id)
    .maybeSingle();
  const revenueRisk = risk as RevenueRisk | null;

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', agentAction.customer_id)
    .maybeSingle();
  const customerData = customer as Customer | null;

  if (!revenueRisk || !customerData) throw new Error('Risk or customer not found');

  const amount = modifiedAmount || revenueRisk.amount;

  await supabase
    .from('agent_actions')
    .update({ execution_status: 'executing' })
    .eq('id', actionId);

  await recordAudit({
    business_id: businessId,
    customer_id: customerData.id,
    revenue_risk_id: revenueRisk.id,
    action_id: actionId,
    category: 'approval',
    event: 'Human approved action',
    details: { action: agentAction.decision, amount },
  });

  let paymentLink: RazorpayPaymentLink | null = null;
  let simulated = false;
  let error: string | undefined;

  if (agentAction.decision === 'create_payment_link' || agentAction.tool_name === 'create_payment_link') {
    const linkResult = isRazorpayConfigured()
      ? await createPaymentLink({
          amount,
          description: `Payment recovery for ${customerData.name}`,
          reference_id: revenueRisk.id,
          customer: {
            name: customerData.name,
            email: customerData.email || '',
            contact: customerData.phone || '',
          },
        })
      : createSimulatedPaymentLink({
          amount,
          description: `Payment recovery for ${customerData.name}`,
          reference_id: revenueRisk.id,
          customer: {
            name: customerData.name,
            email: customerData.email || '',
            contact: customerData.phone || '',
          },
        });

    simulated = linkResult.simulated || false;

    if (linkResult.success && linkResult.data) {
      paymentLink = linkResult.data;

      await supabase
        .from('agent_actions')
        .update({
          execution_status: 'success',
          result: linkResult.data as unknown as Record<string, unknown>,
          razorpay_resource_id: linkResult.data.id,
          executed_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      await supabase
        .from('revenue_risks')
        .update({ status: 'action_approved', recommended_action: 'create_payment_link' })
        .eq('id', revenueRisk.id);

      await recordAudit({
        business_id: businessId,
        customer_id: customerData.id,
        revenue_risk_id: revenueRisk.id,
        action_id: actionId,
        category: 'action',
        event: `Payment link created${simulated ? ' (simulated)' : ''}`,
        details: {
          link_id: linkResult.data.id,
          short_url: linkResult.data.short_url,
          amount,
        },
        metadata: { simulated, tool: 'create_payment_link' },
      });
    } else {
      error = linkResult.error || 'Payment link creation failed';
      await supabase
        .from('agent_actions')
        .update({
          execution_status: 'failed',
          error,
          executed_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      await supabase
        .from('revenue_risks')
        .update({ status: 'action_pending' })
        .eq('id', revenueRisk.id);

      await recordAudit({
        business_id: businessId,
        customer_id: customerData.id,
        revenue_risk_id: revenueRisk.id,
        action_id: actionId,
        category: 'error',
        event: 'Razorpay payment-link creation failed',
        details: { error },
        metadata: { tool: 'create_payment_link' },
      });
    }
  } else if (agentAction.decision === 'send_reminder' || agentAction.tool_name === 'send_recovery_message') {
    // Simulated message send
    await supabase
      .from('agent_actions')
      .update({
        execution_status: 'success',
        result: { sent: true, channel: 'email', simulated: true },
        executed_at: new Date().toISOString(),
      })
      .eq('id', actionId);

    await supabase
      .from('revenue_risks')
      .update({ status: 'action_approved', recommended_action: 'send_reminder' })
      .eq('id', revenueRisk.id);

    await recordAudit({
      business_id: businessId,
      customer_id: customerData.id,
      revenue_risk_id: revenueRisk.id,
      action_id: actionId,
      category: 'action',
      event: 'Recovery message sent (simulated)',
      details: { channel: 'email', customer: customerData.name },
      metadata: { simulated: true, tool: 'send_recovery_message' },
    });
  } else if (agentAction.decision === 'retry_payment' || agentAction.tool_name === 'initiate_payment_retry') {
    const orderResult = isRazorpayConfigured()
      ? await createOrder({ amount, receipt: `retry_${actionId.slice(0, 12)}` })
      : createSimulatedOrder({ amount, receipt: `retry_${actionId.slice(0, 12)}` });

    simulated = orderResult.simulated || false;

    await supabase
      .from('agent_actions')
      .update({
        execution_status: orderResult.success ? 'success' : 'failed',
        result: orderResult.success ? (orderResult.data as unknown as Record<string, unknown>) : null,
        error: orderResult.error || null,
        razorpay_resource_id: orderResult.data?.id || null,
        executed_at: new Date().toISOString(),
      })
      .eq('id', actionId);

    await recordAudit({
      business_id: businessId,
      customer_id: customerData.id,
      revenue_risk_id: revenueRisk.id,
      action_id: actionId,
      category: 'action',
      event: orderResult.success
        ? `Payment retry initiated${simulated ? ' (simulated)' : ''}`
        : 'Payment retry failed',
      details: orderResult.success ? { order_id: orderResult.data?.id } : { error: orderResult.error },
      metadata: { simulated, tool: 'initiate_payment_retry' },
    });

    if (orderResult.success) {
      await supabase
        .from('revenue_risks')
        .update({ status: 'action_approved', recommended_action: 'retry_payment' })
        .eq('id', revenueRisk.id);
    }
  }

  // Update the agent task to reflect the outcome of the approved action
  if (agentAction.task_id) {
    await supabase
      .from('agent_tasks')
      .update({
        status: error ? 'failed' : 'completed',
        result: error ? `Action failed: ${error}` : `Approved action executed: ${agentAction.decision}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', agentAction.task_id);
  }

  return { success: !error, paymentLink, simulated, error };
}

// ─── Confirm Recovery (mark as recovered) ─────────────────────

export async function confirmRecovery(
  actionId: string,
  businessId: string
): Promise<{ success: boolean; revenueRecovered: number }> {
  const supabase = createServerClient();

  const { data: action } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .maybeSingle();
  const agentAction = action as AgentAction | null;
  if (!agentAction) throw new Error('Action not found');

  const { data: risk } = await supabase
    .from('revenue_risks')
    .select('*')
    .eq('id', agentAction.revenue_risk_id)
    .maybeSingle();
  const revenueRisk = risk as RevenueRisk | null;
  if (!revenueRisk) throw new Error('Risk not found');

  const recoveredAmount = agentAction.expected_recovery || revenueRisk.amount;

  // Update action
  await supabase
    .from('agent_actions')
    .update({
      revenue_recovered: recoveredAmount,
      execution_status: 'success',
    })
    .eq('id', actionId);

  // Update risk
  await supabase
    .from('revenue_risks')
    .update({
      status: 'recovered',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', revenueRisk.id);

  // Update business metrics
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .maybeSingle();

  if (business) {
    await supabase
      .from('businesses')
      .update({
        revenue_recovered: (business.revenue_recovered || 0) + recoveredAmount,
      })
      .eq('id', businessId);
  }

  // Audit: recovery confirmed
  await recordAudit({
    business_id: businessId,
    customer_id: agentAction.customer_id,
    revenue_risk_id: revenueRisk.id,
    action_id: actionId,
    category: 'result',
    event: `Revenue recovered: ₹${recoveredAmount.toLocaleString('en-IN')}`,
    details: { amount: recoveredAmount, action: agentAction.decision },
    revenue_impact: recoveredAmount,
  });

  return { success: true, revenueRecovered: recoveredAmount };
}

// ─── Dashboard Metrics ────────────────────────────────────────

export async function getDashboardMetrics(businessId: string): Promise<DashboardMetrics> {
  const supabase = createServerClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .maybeSingle();

  const { data: risks } = await supabase
    .from('revenue_risks')
    .select('*')
    .eq('business_id', businessId);

  const { count: failedPaymentsCount } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'failed');

  const openRisks = (risks || []).filter(
    (r) => r.status !== 'recovered' && r.status !== 'lost'
  );

  const revenueAtRisk = openRisks.reduce((sum, r) => sum + (r.amount || 0), 0);
  const recovered = (risks || [])
    .filter((r) => r.status === 'recovered')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const customersAtRisk = new Set(openRisks.map((r) => r.customer_id)).size;

  const activeInterventions = (risks || []).filter(
    (r) =>
      r.status === 'investigating' ||
      r.status === 'action_pending' ||
      r.status === 'action_approved'
  ).length;

  const riskBreakdown = {
    failed_payments: openRisks
      .filter((r) => r.risk_type === 'failed_payment')
      .reduce((s, r) => s + r.amount, 0),
    abandoned_checkouts: openRisks
      .filter((r) => r.risk_type === 'abandoned_checkout')
      .reduce((s, r) => s + r.amount, 0),
    inactive_customers: openRisks
      .filter((r) => r.risk_type === 'inactive_customer')
      .reduce((s, r) => s + r.amount, 0),
    subscription_failures: openRisks
      .filter((r) => r.risk_type === 'subscription_failure')
      .reduce((s, r) => s + r.amount, 0),
  };

  const totalProcessed = business?.total_processed_revenue || 0;
  const totalRecovered = (business?.revenue_recovered || 0) + recovered;
  const recoveryRate = totalProcessed > 0
    ? Math.round((totalRecovered / (totalProcessed + revenueAtRisk)) * 100)
    : 0;

  return {
    totalProcessedRevenue: totalProcessed,
    revenueAtRisk,
    revenueRecovered: totalRecovered,
    revenueLost: business?.revenue_lost || 0,
    recoveryRate,
    failedPayments: failedPaymentsCount || 0,
    customersAtRisk,
    activeInterventions,
    averageRecoveryTimeHours: 18,
    riskBreakdown,
  };
}

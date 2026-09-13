import { createServerClient } from '@/lib/supabase/server';
import { recordAudit } from '@/lib/audit/logger';

export interface SeedResult {
  businessId: string;
  customersCreated: number;
  ordersCreated: number;
  paymentsCreated: number;
  risksCreated: number;
  subscriptionsCreated: number;
}

class SeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedError';
  }
}

export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('timeout') ||
      msg.includes('socket') ||
      msg.includes('aborted') ||
      msg.includes('tcp') ||
      msg.includes('etimedout') ||
      msg.includes('enotfound')
    );
  }
  return false;
}

export async function seedDemoData(): Promise<SeedResult> {
  const supabase = createServerClient();

  // Check if business already exists
  const { data: existingBusiness, error: businessCheckError } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (businessCheckError) {
    throw new SeedError(`Failed to check existing business: ${businessCheckError.message}`);
  }

  let businessId: string;

  if (existingBusiness) {
    businessId = existingBusiness.id;
    const { error: configUpsertError } = await supabase.from('agent_config').upsert({
      business_id: businessId,
      auto_analysis: true,
      auto_retry: false,
      auto_payment_link: false,
      human_approval_required: true,
      max_auto_recovery_amount: 2000,
      max_retry_attempts: 3,
      confidence_threshold: 65,
      agent_status: 'idle',
    });
    if (configUpsertError) {
      throw new SeedError(`Failed to create agent config: ${configUpsertError.message}`);
    }

    const { count, error: countError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if (countError) {
      throw new SeedError(`Failed to check existing customers: ${countError.message}`);
    }

    if (count && count > 0) {
      return {
        businessId,
        customersCreated: 0,
        ordersCreated: 0,
        paymentsCreated: 0,
        risksCreated: 0,
        subscriptionsCreated: 0,
      };
    }
  } else {
    const { data: newBusiness, error: businessInsertError } = await supabase
      .from('businesses')
      .insert({
        name: 'ShopNest India',
        email: 'owner@shopnest.in',
        total_processed_revenue: 1847500,
        revenue_recovered: 0,
        revenue_lost: 12500,
      })
      .select()
      .single();

    if (businessInsertError || !newBusiness) {
      throw new SeedError(
        `Failed to create business: ${businessInsertError?.message ?? 'No data returned'}`
      );
    }
    businessId = newBusiness.id;
  }

  // Create agent config
  const { error: configError } = await supabase.from('agent_config').upsert({
    business_id: businessId,
    auto_analysis: true,
    auto_retry: false,
    auto_payment_link: false,
    human_approval_required: true,
    max_auto_recovery_amount: 2000,
    max_retry_attempts: 3,
    confidence_threshold: 65,
    agent_status: 'idle',
  });
  if (configError) {
    throw new SeedError(`Failed to create agent config: ${configError.message}`);
  }

  // Seed customers
  const customers = [
    { name: 'Rahul Sharma', email: 'rahul.sharma@gmail.com', phone: '9876543210', customer_number: 'CUST-0184', status: 'active', lifetime_value: 89982, total_orders: 18, last_payment_at: daysAgo(47), avg_payment_interval_days: 30 },
    { name: 'Priya Patel', email: 'priya.patel@yahoo.in', phone: '9812345678', customer_number: 'CUST-0192', status: 'active', lifetime_value: 45990, total_orders: 9, last_payment_at: daysAgo(12), avg_payment_interval_days: 45 },
    { name: 'Arun Kumar', email: 'arun.kumar@outlook.com', phone: '9988776655', customer_number: 'CUST-0207', status: 'inactive', lifetime_value: 124500, total_orders: 25, last_payment_at: daysAgo(95), avg_payment_interval_days: 30 },
    { name: 'Sneha Reddy', email: 'sneha.reddy@gmail.com', phone: '9090909090', customer_number: 'CUST-0215', status: 'active', lifetime_value: 23994, total_orders: 6, last_payment_at: daysAgo(5), avg_payment_interval_days: 60 },
    { name: 'Vikram Singh', email: 'vikram.singh@gmail.com', phone: '9123456789', customer_number: 'CUST-0223', status: 'inactive', lifetime_value: 67989, total_orders: 14, last_payment_at: daysAgo(72), avg_payment_interval_days: 30 },
    { name: 'Ananya Gupta', email: 'ananya.gupta@yahoo.com', phone: '9001122334', customer_number: 'CUST-0231', status: 'active', lifetime_value: 156000, total_orders: 31, last_payment_at: daysAgo(3), avg_payment_interval_days: 30 },
    { name: 'Karthik Iyer', email: 'karthik.iyer@gmail.com', phone: '8888777666', customer_number: 'CUST-0245', status: 'active', lifetime_value: 34993, total_orders: 7, last_payment_at: daysAgo(18), avg_payment_interval_days: 45 },
    { name: 'Meera Joshi', email: 'meera.joshi@gmail.com', phone: '7777666555', customer_number: 'CUST-0258', status: 'inactive', lifetime_value: 78990, total_orders: 16, last_payment_at: daysAgo(110), avg_payment_interval_days: 30 },
    { name: 'Rohan Das', email: 'rohan.das@outlook.com', phone: '6666555544', customer_number: 'CUST-0266', status: 'active', lifetime_value: 54990, total_orders: 11, last_payment_at: daysAgo(8), avg_payment_interval_days: 30 },
    { name: 'Divya Nair', email: 'divya.nair@gmail.com', phone: '5555444433', customer_number: 'CUST-0274', status: 'active', lifetime_value: 92997, total_orders: 19, last_payment_at: daysAgo(2), avg_payment_interval_days: 30 },
  ];

  const { data: customerRows, error: customerInsertError } = await supabase
    .from('customers')
    .insert(customers.map((c) => ({ ...c, business_id: businessId })))
    .select();

  if (customerInsertError) {
    throw new SeedError(`Failed to create customers: ${customerInsertError.message}`);
  }
  if (!customerRows || customerRows.length === 0) {
    throw new SeedError('Failed to create customers: no rows returned');
  }

  const createdCustomers = customerRows as { id: string; name: string; email: string; phone: string; customer_number: string }[];

  // Collect all orders, payments, and subscriptions to batch-insert
  // This reduces ~40 sequential network round-trips to just 4 batch inserts
  const ordersToInsert: Array<{
    business_id: string;
    customer_id: string;
    order_number: string;
    amount: number;
    status: string;
    created_at: string;
  }> = [];
  const paymentsToInsert: Array<{
    business_id: string;
    order_id: string | null;
    customer_id: string;
    amount: number;
    status: string;
    method: string;
    error_code?: string;
    error_description?: string;
    retry_count?: number;
    created_at: string;
  }> = [];
  const subscriptionsToInsert: Array<{
    business_id: string;
    customer_id: string;
    plan_name: string;
    amount: number;
    billing_cycle: string;
    status: string;
    current_period_end: string;
  }> = [];

  for (const c of createdCustomers) {
    // Rahul Sharma — failed payment (the main demo scenario)
    if (c.name === 'Rahul Sharma') {
      for (let j = 0; j < 2; j++) {
        const orderNum = `ORD-RS-${100 + j}`;
        ordersToInsert.push({
          business_id: businessId, customer_id: c.id, order_number: orderNum, amount: 4999, status: 'paid', created_at: daysAgo(47 + j * 30),
        });
        paymentsToInsert.push({
          business_id: businessId, order_id: null, customer_id: c.id, amount: 4999, status: 'captured', method: 'upi', created_at: daysAgo(47 + j * 30),
        });
      }
      ordersToInsert.push({
        business_id: businessId, customer_id: c.id, order_number: 'ORD-RS-103', amount: 4999, status: 'failed', created_at: daysAgo(3),
      });
      paymentsToInsert.push({
        business_id: businessId, order_id: null, customer_id: c.id, amount: 4999, status: 'failed', method: 'card', error_code: 'CARD_DECLINED', error_description: 'Card has been declined by the bank', retry_count: 1, created_at: daysAgo(3),
      });
    }

    // Arun Kumar — inactive customer, subscription failure
    if (c.name === 'Arun Kumar') {
      subscriptionsToInsert.push({
        business_id: businessId, customer_id: c.id, plan_name: 'Premium Monthly', amount: 2999, billing_cycle: 'monthly', status: 'failed', current_period_end: daysAgo(95),
      });
      for (let j = 0; j < 5; j++) {
        paymentsToInsert.push({
          business_id: businessId, order_id: null, customer_id: c.id, amount: 2999, status: 'captured', method: 'upi', created_at: daysAgo(95 + j * 30),
        });
      }
      paymentsToInsert.push({
        business_id: businessId, order_id: null, customer_id: c.id, amount: 2999, status: 'failed', method: 'card', error_code: 'EXPIRED_CARD', error_description: 'Card has expired', retry_count: 2, created_at: daysAgo(95),
      });
    }

    // Priya Patel — abandoned checkout
    if (c.name === 'Priya Patel') {
      ordersToInsert.push({
        business_id: businessId, customer_id: c.id, order_number: 'ORD-PP-201', amount: 3499, status: 'abandoned', created_at: daysAgo(2),
      });
      for (let j = 0; j < 3; j++) {
        paymentsToInsert.push({
          business_id: businessId, order_id: null, customer_id: c.id, amount: 3499, status: 'captured', method: 'upi', created_at: daysAgo(12 + j * 45),
        });
      }
    }

    // Vikram Singh — inactive customer
    if (c.name === 'Vikram Singh') {
      for (let j = 0; j < 4; j++) {
        paymentsToInsert.push({
          business_id: businessId, order_id: null, customer_id: c.id, amount: 1999, status: 'captured', method: 'upi', created_at: daysAgo(72 + j * 30),
        });
      }
    }

    // Sneha Reddy — failed payment
    if (c.name === 'Sneha Reddy') {
      ordersToInsert.push({
        business_id: businessId, customer_id: c.id, order_number: 'ORD-SR-301', amount: 2999, status: 'failed', created_at: daysAgo(1),
      });
      paymentsToInsert.push({
        business_id: businessId, order_id: null, customer_id: c.id, amount: 2999, status: 'failed', method: 'upi', error_code: 'INSUFFICIENT_BALANCE', error_description: 'Insufficient balance in account', retry_count: 0, created_at: daysAgo(1),
      });
      for (let j = 0; j < 2; j++) {
        paymentsToInsert.push({
          business_id: businessId, order_id: null, customer_id: c.id, amount: 2999, status: 'captured', method: 'upi', created_at: daysAgo(5 + j * 60),
        });
      }
    }

    // Meera Joshi — inactive + subscription failure
    if (c.name === 'Meera Joshi') {
      subscriptionsToInsert.push({
        business_id: businessId, customer_id: c.id, plan_name: 'Pro Annual', amount: 9999, billing_cycle: 'yearly', status: 'failed', current_period_end: daysAgo(110),
      });
      for (let j = 0; j < 3; j++) {
        paymentsToInsert.push({
          business_id: businessId, order_id: null, customer_id: c.id, amount: 9999, status: 'captured', method: 'card', created_at: daysAgo(110 + j * 365),
        });
      }
      paymentsToInsert.push({
        business_id: businessId, order_id: null, customer_id: c.id, amount: 9999, status: 'failed', method: 'card', error_code: 'CARD_DECLINED', error_description: 'Card declined', retry_count: 3, created_at: daysAgo(110),
      });
    }

    // Karthik Iyer — abandoned checkout
    if (c.name === 'Karthik Iyer') {
      ordersToInsert.push({
        business_id: businessId, customer_id: c.id, order_number: 'ORD-KI-401', amount: 4999, status: 'abandoned', created_at: daysAgo(4),
      });
      for (let j = 0; j < 3; j++) {
        paymentsToInsert.push({
          business_id: businessId, order_id: null, customer_id: c.id, amount: 4999, status: 'captured', method: 'upi', created_at: daysAgo(18 + j * 45),
        });
      }
    }
  }

  // Batch insert all orders, then link payments to order IDs
  if (ordersToInsert.length > 0) {
    const { data: orderRows, error: orderInsertError } = await supabase
      .from('orders')
      .insert(ordersToInsert)
      .select();

    if (orderInsertError) {
      throw new SeedError(`Failed to create orders: ${orderInsertError.message}`);
    }
    if (!orderRows || orderRows.length === 0) {
      throw new SeedError('Failed to create orders: no rows returned');
    }

    // Link payments to their order IDs
    const orderRowsTyped = orderRows as { id: string; order_number: string }[];
    const orderMap = new Map<string, string>();
    for (const o of orderRowsTyped) {
      orderMap.set(o.order_number, o.id);
    }

    // Fix up payment order_id references for payments that should link to orders
    // Payment array order matches insertion order above:
    // Rahul: 2 captured (ORD-RS-100, ORD-RS-101) + 1 failed (ORD-RS-103)
    // Arun: 5 captured + 1 failed (no order)
    // Priya: 3 captured (no order)
    // Vikram: 4 captured (no order)
    // Sneha: 1 failed (ORD-SR-301) + 2 captured (no order)
    // Meera: 3 captured + 1 failed (no order)
    // Karthik: 3 captured (no order)
    let idx = 0;
    // Rahul's 2 captured payments
    for (let j = 0; j < 2; j++) {
      const orderId = orderMap.get(`ORD-RS-${100 + j}`);
      if (orderId) paymentsToInsert[idx].order_id = orderId;
      idx++;
    }
    // Rahul's failed payment
    const rahulFailedId = orderMap.get('ORD-RS-103');
    if (rahulFailedId) paymentsToInsert[idx].order_id = rahulFailedId;
    idx++;
    // Arun's 6 payments (no order)
    idx += 6;
    // Priya's 3 payments (no order)
    idx += 3;
    // Vikram's 4 payments (no order)
    idx += 4;
    // Sneha's failed payment
    const snehaOrderId = orderMap.get('ORD-SR-301');
    if (snehaOrderId) paymentsToInsert[idx].order_id = snehaOrderId;
    idx++;
    // Sneha's 2 captured + Meera's 4 + Karthik's 3 (no order)
  }

  // Batch insert all payments
  if (paymentsToInsert.length > 0) {
    const { error: paymentInsertError } = await supabase
      .from('payments')
      .insert(paymentsToInsert);
    if (paymentInsertError) {
      throw new SeedError(`Failed to create payments: ${paymentInsertError.message}`);
    }
  }

  // Batch insert all subscriptions
  if (subscriptionsToInsert.length > 0) {
    const { error: subInsertError } = await supabase
      .from('subscriptions')
      .insert(subscriptionsToInsert);
    if (subInsertError) {
      throw new SeedError(`Failed to create subscriptions: ${subInsertError.message}`);
    }
  }

  // Create revenue risks based on the data
  const risksToCreate: Array<{
    customer_name: string;
    amount: number;
    risk_type: string;
    risk_level: string;
    risk_score: number;
    reason: string;
    recommended_action: string;
  }> = [
    { customer_name: 'Rahul Sharma', amount: 4999, risk_type: 'failed_payment', risk_level: 'high', risk_score: 86, reason: 'Likely cause: payment failure — may be a temporary issue (insufficient balance or network error)', recommended_action: 'retry_payment' },
    { customer_name: 'Arun Kumar', amount: 2999, risk_type: 'subscription_failure', risk_level: 'high', risk_score: 88, reason: 'Likely cause: subscription renewal failure — payment method may need updating', recommended_action: 'create_payment_link' },
    { customer_name: 'Priya Patel', amount: 3499, risk_type: 'abandoned_checkout', risk_level: 'medium', risk_score: 58, reason: 'Likely cause: checkout abandonment — customer may have been distracted or had a payment method issue', recommended_action: 'send_reminder' },
    { customer_name: 'Vikram Singh', amount: 1999, risk_type: 'inactive_customer', risk_level: 'medium', risk_score: 62, reason: 'Likely cause: customer inactivity — payment cycle may have lapsed', recommended_action: 'send_reminder' },
    { customer_name: 'Sneha Reddy', amount: 2999, risk_type: 'failed_payment', risk_level: 'medium', risk_score: 55, reason: 'Likely cause: payment failure — may be a temporary issue (insufficient balance or network error)', recommended_action: 'retry_payment' },
    { customer_name: 'Meera Joshi', amount: 9999, risk_type: 'subscription_failure', risk_level: 'high', risk_score: 92, reason: 'Likely cause: subscription renewal failure — payment method may need updating', recommended_action: 'create_payment_link' },
    { customer_name: 'Karthik Iyer', amount: 4999, risk_type: 'abandoned_checkout', risk_level: 'medium', risk_score: 48, reason: 'Likely cause: checkout abandonment — customer may have been distracted or had a payment method issue', recommended_action: 'send_reminder' },
  ];

  const risksToInsert: Array<{
    business_id: string;
    customer_id: string;
    amount: number;
    risk_type: string;
    risk_level: string;
    risk_score: number;
    reason: string;
    recommended_action: string;
    status: string;
  }> = [];

  for (const risk of risksToCreate) {
    const customer = createdCustomers.find((c) => c.name === risk.customer_name);
    if (!customer) continue;
    risksToInsert.push({
      business_id: businessId,
      customer_id: customer.id,
      amount: risk.amount,
      risk_type: risk.risk_type,
      risk_level: risk.risk_level,
      risk_score: risk.risk_score,
      reason: risk.reason,
      recommended_action: risk.recommended_action,
      status: 'open',
    });
  }

  let risksCreated = 0;
  if (risksToInsert.length > 0) {
    const { error: riskInsertError } = await supabase
      .from('revenue_risks')
      .insert(risksToInsert);
    if (riskInsertError) {
      throw new SeedError(`Failed to create revenue risks: ${riskInsertError.message}`);
    }
    risksCreated = risksToInsert.length;
  }

  // Record audit for seeding
  await recordAudit({
    business_id: businessId,
    category: 'detection',
    event: 'Demo data initialized',
    details: {
      customers: createdCustomers.length,
      orders: ordersToInsert.length,
      payments: paymentsToInsert.length,
      risks: risksCreated,
    },
  });

  return {
    businessId,
    customersCreated: createdCustomers.length,
    ordersCreated: ordersToInsert.length,
    paymentsCreated: paymentsToInsert.length,
    risksCreated,
    subscriptionsCreated: subscriptionsToInsert.length,
  };
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

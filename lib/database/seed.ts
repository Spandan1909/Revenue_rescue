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
    // Ensure agent_config exists (idempotent)
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
    // Check if we already have customers
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

  // Create orders and payments for each customer
  let ordersCreated = 0;
  let paymentsCreated = 0;
  let subscriptionsCreated = 0;

  for (let i = 0; i < createdCustomers.length; i++) {
    const c = createdCustomers[i];

    // Rahul Sharma — failed payment (the main demo scenario)
    if (c.name === 'Rahul Sharma') {
      // Two previous successful payments
      for (let j = 0; j < 2; j++) {
        const orderNum = `ORD-RS-${100 + j}`;
        const amount = 4999;
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            business_id: businessId,
            customer_id: c.id,
            order_number: orderNum,
            amount,
            status: 'paid',
            created_at: daysAgo(47 + j * 30),
          })
          .select()
          .single();

        if (orderError || !order) {
          throw new SeedError(`Failed to create order ${orderNum}: ${orderError?.message ?? 'No data returned'}`);
        }
        ordersCreated++;

        const { error: paymentError } = await supabase.from('payments').insert({
          business_id: businessId,
          order_id: order.id,
          customer_id: c.id,
          amount,
          status: 'captured',
          method: 'upi',
          created_at: daysAgo(47 + j * 30),
        });
        if (paymentError) {
          throw new SeedError(`Failed to create payment for order ${orderNum}: ${paymentError.message}`);
        }
        paymentsCreated++;
      }

      // Current failed payment
      const { data: failedOrder, error: failedOrderError } = await supabase
        .from('orders')
        .insert({
          business_id: businessId,
          customer_id: c.id,
          order_number: 'ORD-RS-103',
          amount: 4999,
          status: 'failed',
          created_at: daysAgo(3),
        })
        .select()
        .single();

      if (failedOrderError || !failedOrder) {
        throw new SeedError(`Failed to create failed order: ${failedOrderError?.message ?? 'No data returned'}`);
      }
      ordersCreated++;

      const { error: failedPaymentError } = await supabase.from('payments').insert({
        business_id: businessId,
        order_id: failedOrder.id,
        customer_id: c.id,
        amount: 4999,
        status: 'failed',
        method: 'card',
        error_code: 'CARD_DECLINED',
        error_description: 'Card has been declined by the bank',
        retry_count: 1,
        created_at: daysAgo(3),
      });
      if (failedPaymentError) {
        throw new SeedError(`Failed to create failed payment: ${failedPaymentError.message}`);
      }
      paymentsCreated++;
    }

    // Arun Kumar — inactive customer, subscription failure
    if (c.name === 'Arun Kumar') {
      const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          business_id: businessId,
          customer_id: c.id,
          plan_name: 'Premium Monthly',
          amount: 2999,
          billing_cycle: 'monthly',
          status: 'failed',
          current_period_end: daysAgo(95),
        })
        .select()
        .single();

      if (subError || !sub) {
        throw new SeedError(`Failed to create subscription for Arun Kumar: ${subError?.message ?? 'No data returned'}`);
      }
      subscriptionsCreated++;

      // Previous successful payments
      for (let j = 0; j < 5; j++) {
        const { error: paymentError } = await supabase.from('payments').insert({
          business_id: businessId,
          order_id: null,
          customer_id: c.id,
          amount: 2999,
          status: 'captured',
          method: 'upi',
          created_at: daysAgo(95 + j * 30),
        });
        if (paymentError) {
          throw new SeedError(`Failed to create payment for Arun Kumar: ${paymentError.message}`);
        }
        paymentsCreated++;
      }

      // Failed subscription payment
      const { error: failedSubPaymentError } = await supabase.from('payments').insert({
        business_id: businessId,
        order_id: null,
        customer_id: c.id,
        amount: 2999,
        status: 'failed',
        method: 'card',
        error_code: 'EXPIRED_CARD',
        error_description: 'Card has expired',
        retry_count: 2,
        created_at: daysAgo(95),
      });
      if (failedSubPaymentError) {
        throw new SeedError(`Failed to create failed subscription payment: ${failedSubPaymentError.message}`);
      }
      paymentsCreated++;
    }

    // Priya Patel — abandoned checkout
    if (c.name === 'Priya Patel') {
      const { data: abandonedOrder, error: abandonedError } = await supabase
        .from('orders')
        .insert({
          business_id: businessId,
          customer_id: c.id,
          order_number: 'ORD-PP-201',
          amount: 3499,
          status: 'abandoned',
          created_at: daysAgo(2),
        })
        .select()
        .single();

      if (abandonedError || !abandonedOrder) {
        throw new SeedError(`Failed to create abandoned order: ${abandonedError?.message ?? 'No data returned'}`);
      }
      ordersCreated++;

      // Previous successful payments
      for (let j = 0; j < 3; j++) {
        const { error: paymentError } = await supabase.from('payments').insert({
          business_id: businessId,
          order_id: null,
          customer_id: c.id,
          amount: 3499,
          status: 'captured',
          method: 'upi',
          created_at: daysAgo(12 + j * 45),
        });
        if (paymentError) {
          throw new SeedError(`Failed to create payment for Priya Patel: ${paymentError.message}`);
        }
        paymentsCreated++;
      }
    }

    // Vikram Singh — inactive customer
    if (c.name === 'Vikram Singh') {
      for (let j = 0; j < 4; j++) {
        const { error: paymentError } = await supabase.from('payments').insert({
          business_id: businessId,
          order_id: null,
          customer_id: c.id,
          amount: 1999,
          status: 'captured',
          method: 'upi',
          created_at: daysAgo(72 + j * 30),
        });
        if (paymentError) {
          throw new SeedError(`Failed to create payment for Vikram Singh: ${paymentError.message}`);
        }
        paymentsCreated++;
      }
    }

    // Sneha Reddy — failed payment
    if (c.name === 'Sneha Reddy') {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          business_id: businessId,
          customer_id: c.id,
          order_number: 'ORD-SR-301',
          amount: 2999,
          status: 'failed',
          created_at: daysAgo(1),
        })
        .select()
        .single();

      if (orderError || !order) {
        throw new SeedError(`Failed to create order for Sneha Reddy: ${orderError?.message ?? 'No data returned'}`);
      }
      ordersCreated++;

      const { error: failedPaymentError } = await supabase.from('payments').insert({
        business_id: businessId,
        order_id: order.id,
        customer_id: c.id,
        amount: 2999,
        status: 'failed',
        method: 'upi',
        error_code: 'INSUFFICIENT_BALANCE',
        error_description: 'Insufficient balance in account',
        retry_count: 0,
        created_at: daysAgo(1),
      });
      if (failedPaymentError) {
        throw new SeedError(`Failed to create failed payment for Sneha Reddy: ${failedPaymentError.message}`);
      }
      paymentsCreated++;

      // Previous successful payments
      for (let j = 0; j < 2; j++) {
        const { error: paymentError } = await supabase.from('payments').insert({
          business_id: businessId,
          order_id: null,
          customer_id: c.id,
          amount: 2999,
          status: 'captured',
          method: 'upi',
          created_at: daysAgo(5 + j * 60),
        });
        if (paymentError) {
          throw new SeedError(`Failed to create payment for Sneha Reddy: ${paymentError.message}`);
        }
        paymentsCreated++;
      }
    }

    // Meera Joshi — inactive + subscription failure
    if (c.name === 'Meera Joshi') {
      const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          business_id: businessId,
          customer_id: c.id,
          plan_name: 'Pro Annual',
          amount: 9999,
          billing_cycle: 'yearly',
          status: 'failed',
          current_period_end: daysAgo(110),
        })
        .select()
        .single();

      if (subError || !sub) {
        throw new SeedError(`Failed to create subscription for Meera Joshi: ${subError?.message ?? 'No data returned'}`);
      }
      subscriptionsCreated++;

      for (let j = 0; j < 3; j++) {
        const { error: paymentError } = await supabase.from('payments').insert({
          business_id: businessId,
          order_id: null,
          customer_id: c.id,
          amount: 9999,
          status: 'captured',
          method: 'card',
          created_at: daysAgo(110 + j * 365),
        });
        if (paymentError) {
          throw new SeedError(`Failed to create payment for Meera Joshi: ${paymentError.message}`);
        }
        paymentsCreated++;
      }

      const { error: failedSubPaymentError } = await supabase.from('payments').insert({
        business_id: businessId,
        order_id: null,
        customer_id: c.id,
        amount: 9999,
        status: 'failed',
        method: 'card',
        error_code: 'CARD_DECLINED',
        error_description: 'Card declined',
        retry_count: 3,
        created_at: daysAgo(110),
      });
      if (failedSubPaymentError) {
        throw new SeedError(`Failed to create failed subscription payment for Meera Joshi: ${failedSubPaymentError.message}`);
      }
      paymentsCreated++;
    }

    // Karthik Iyer — abandoned checkout
    if (c.name === 'Karthik Iyer') {
      const { error: orderError } = await supabase.from('orders').insert({
        business_id: businessId,
        customer_id: c.id,
        order_number: 'ORD-KI-401',
        amount: 4999,
        status: 'abandoned',
        created_at: daysAgo(4),
      });
      if (orderError) {
        throw new SeedError(`Failed to create order for Karthik Iyer: ${orderError.message}`);
      }
      ordersCreated++;

      for (let j = 0; j < 3; j++) {
        const { error: paymentError } = await supabase.from('payments').insert({
          business_id: businessId,
          order_id: null,
          customer_id: c.id,
          amount: 4999,
          status: 'captured',
          method: 'upi',
          created_at: daysAgo(18 + j * 45),
        });
        if (paymentError) {
          throw new SeedError(`Failed to create payment for Karthik Iyer: ${paymentError.message}`);
        }
        paymentsCreated++;
      }
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

  let risksCreated = 0;
  for (const risk of risksToCreate) {
    const customer = createdCustomers.find((c) => c.name === risk.customer_name);
    if (!customer) continue;

    const { error: riskError } = await supabase.from('revenue_risks').insert({
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
    if (riskError) {
      throw new SeedError(`Failed to create risk for ${risk.customer_name}: ${riskError.message}`);
    }
    risksCreated++;
  }

  // Record audit for seeding
  await recordAudit({
    business_id: businessId,
    category: 'detection',
    event: 'Demo data initialized',
    details: {
      customers: createdCustomers.length,
      orders: ordersCreated,
      payments: paymentsCreated,
      risks: risksCreated,
    },
  });

  return {
    businessId,
    customersCreated: createdCustomers.length,
    ordersCreated,
    paymentsCreated,
    risksCreated,
    subscriptionsCreated,
  };
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

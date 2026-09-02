/*
# Revenue Rescue AI — Initial Schema

## Overview
Creates the full database for an autonomous AI revenue-recovery agent.
This is a single-tenant demo app (no sign-in screen), so all policies use
`TO anon, authenticated` with `USING (true)` — the data is intentionally shared.

## Tables
1. `businesses` — the business using the product (single demo business)
2. `customers` — customers of the business
3. `orders` — orders placed by customers
4. `payments` — payment attempts for orders
5. `subscriptions` — recurring subscription records
6. `revenue_risks` — detected revenue-at-risk entries
7. `agent_tasks` — investigation tasks the agent runs
8. `agent_actions` — individual actions taken by the agent
9. `approvals` — human approval requests for medium/high risk actions
10. `campaigns` — AI-generated recovery message campaigns
11. `webhook_events` — incoming Razorpay webhook events (idempotent)
12. `audit_logs` — full audit trail of agent activity
13. `agent_config` — automation settings (single row)

## Security
- RLS enabled on every table.
- All policies `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
  because this is a single-tenant demo app with no sign-in screen.
*/

-- businesses
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  total_processed_revenue numeric(14,2) NOT NULL DEFAULT 0,
  revenue_recovered numeric(14,2) NOT NULL DEFAULT 0,
  revenue_lost numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_businesses" ON businesses;
CREATE POLICY "anon_crud_businesses" ON businesses
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  customer_number text,
  status text NOT NULL DEFAULT 'active', -- active, inactive, churned
  lifetime_value numeric(14,2) NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  last_payment_at timestamptz,
  avg_payment_interval_days numeric(10,1),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_customers" ON customers;
CREATE POLICY "anon_crud_customers" ON customers
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created', -- created, paid, failed, abandoned, refunded
  created_at timestamptz DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_orders" ON orders;
CREATE POLICY "anon_crud_orders" ON orders
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  razorpay_payment_id text,
  razorpay_order_id text,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created', -- created, authorized, captured, failed, refunded, pending
  method text, -- card, upi, netbanking, etc.
  error_code text,
  error_description text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_payments" ON payments;
CREATE POLICY "anon_crud_payments" ON payments
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  razorpay_subscription_id text,
  razorpay_plan_id text,
  plan_name text NOT NULL,
  amount numeric(14,2) NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'active', -- active, expired, cancelled, pending, failed
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_subscriptions" ON subscriptions;
CREATE POLICY "anon_crud_subscriptions" ON subscriptions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_subs_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);

-- revenue_risks
CREATE TABLE IF NOT EXISTS revenue_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  risk_type text NOT NULL, -- failed_payment, abandoned_checkout, inactive_customer, subscription_failure
  risk_level text NOT NULL DEFAULT 'medium', -- low, medium, high
  risk_score numeric(5,2) NOT NULL DEFAULT 0, -- 0-100
  reason text,
  recommended_action text,
  status text NOT NULL DEFAULT 'open', -- open, investigating, action_pending, action_approved, action_rejected, recovered, lost, escalated
  detected_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE revenue_risks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_revenue_risks" ON revenue_risks;
CREATE POLICY "anon_crud_revenue_risks" ON revenue_risks
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_risks_customer ON revenue_risks(customer_id);
CREATE INDEX IF NOT EXISTS idx_risks_status ON revenue_risks(status);
CREATE INDEX IF NOT EXISTS idx_risks_level ON revenue_risks(risk_level);
CREATE INDEX IF NOT EXISTS idx_risks_type ON revenue_risks(risk_type);

-- agent_tasks
CREATE TABLE IF NOT EXISTS agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  revenue_risk_id uuid REFERENCES revenue_risks(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  trigger text, -- what triggered this task
  summary text,
  confidence numeric(5,2),
  result text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_agent_tasks" ON agent_tasks;
CREATE POLICY "anon_crud_agent_tasks" ON agent_tasks
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON agent_tasks(status);

-- agent_actions
CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  task_id uuid REFERENCES agent_tasks(id) ON DELETE SET NULL,
  revenue_risk_id uuid REFERENCES revenue_risks(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  action_level text NOT NULL DEFAULT 'low', -- low, medium, high
  decision text,
  evidence jsonb,
  expected_recovery numeric(14,2),
  approval_status text NOT NULL DEFAULT 'auto', -- auto, pending, approved, rejected, modified
  execution_status text NOT NULL DEFAULT 'pending', -- pending, executing, success, failed, skipped
  result jsonb,
  revenue_recovered numeric(14,2),
  error text,
  razorpay_resource_id text,
  created_at timestamptz DEFAULT now(),
  executed_at timestamptz
);
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_agent_actions" ON agent_actions;
CREATE POLICY "anon_crud_agent_actions" ON agent_actions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_actions_task ON agent_actions(task_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON agent_actions(execution_status);

-- approvals
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  action_id uuid REFERENCES agent_actions(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  revenue_risk_id uuid REFERENCES revenue_risks(id) ON DELETE SET NULL,
  amount numeric(14,2),
  action_type text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected, modified
  modified_amount numeric(14,2),
  reviewer_note text,
  created_at timestamptz DEFAULT now(),
  decided_at timestamptz
);
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_approvals" ON approvals;
CREATE POLICY "anon_crud_approvals" ON approvals
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

-- campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  revenue_risk_id uuid REFERENCES revenue_risks(id) ON DELETE SET NULL,
  message text NOT NULL,
  channel text NOT NULL DEFAULT 'email', -- email, sms
  reason text,
  expected_outcome text,
  status text NOT NULL DEFAULT 'draft', -- draft, pending_approval, approved, sent, rejected
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_campaigns" ON campaigns;
CREATE POLICY "anon_crud_campaigns" ON campaigns
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- webhook_events
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_webhook_events" ON webhook_events;
CREATE POLICY "anon_crud_webhook_events" ON webhook_events
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_webhook_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_type ON webhook_events(event_type);

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  revenue_risk_id uuid REFERENCES revenue_risks(id) ON DELETE SET NULL,
  action_id uuid REFERENCES agent_actions(id) ON DELETE SET NULL,
  timestamp timestamptz DEFAULT now(),
  category text NOT NULL, -- detection, diagnosis, decision, action, approval, webhook, result, error
  event text NOT NULL,
  details jsonb,
  revenue_impact numeric(14,2),
  metadata jsonb
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_audit_logs" ON audit_logs;
CREATE POLICY "anon_crud_audit_logs" ON audit_logs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);

-- agent_config (single row)
CREATE TABLE IF NOT EXISTS agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  auto_analysis boolean NOT NULL DEFAULT true,
  auto_retry boolean NOT NULL DEFAULT false,
  auto_payment_link boolean NOT NULL DEFAULT false,
  human_approval_required boolean NOT NULL DEFAULT true,
  max_auto_recovery_amount numeric(14,2) NOT NULL DEFAULT 2000,
  max_retry_attempts integer NOT NULL DEFAULT 3,
  confidence_threshold numeric(5,2) NOT NULL DEFAULT 65,
  agent_status text NOT NULL DEFAULT 'idle', -- idle, running, paused
  current_task text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_agent_config" ON agent_config;
CREATE POLICY "anon_crud_agent_config" ON agent_config
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

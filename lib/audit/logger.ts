import { createServerClient } from '@/lib/supabase/server';

export interface AuditEntry {
  business_id: string;
  customer_id?: string | null;
  revenue_risk_id?: string | null;
  action_id?: string | null;
  task_id?: string | null;
  category: string;
  event: string;
  details?: Record<string, unknown> | null;
  revenue_impact?: number | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('audit_logs').insert({
    business_id: entry.business_id,
    customer_id: entry.customer_id || null,
    revenue_risk_id: entry.revenue_risk_id || null,
    action_id: entry.action_id || null,
    category: entry.category,
    event: entry.event,
    details: entry.details || null,
    revenue_impact: entry.revenue_impact || null,
    metadata: { ...entry.metadata, task_id: entry.task_id } as Record<string, unknown> | null,
  });
  if (error) {
    console.error('Failed to record audit log:', error.message);
  }
}

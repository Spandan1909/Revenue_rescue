'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RiskBadge, StatusBadge } from '@/components/dashboard/badges';
import { formatCurrency, formatDateTime, formatTimeAgo } from '@/lib/format';
import {
  ArrowLeft,
  Mail,
  Phone,
  TrendingUp,
  AlertTriangle,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Activity,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CustomerData {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    customer_number: string;
    status: string;
    lifetime_value: number;
    total_orders: number;
    last_payment_at: string;
    avg_payment_interval_days: number;
    created_at: string;
  };
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
    error_code: string | null;
    error_description: string | null;
    retry_count: number;
    created_at: string;
  }>;
  orders: Array<{
    id: string;
    order_number: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
  subscriptions: Array<{
    id: string;
    plan_name: string;
    amount: number;
    billing_cycle: string;
    status: string;
    current_period_end: string;
  }>;
  risks: Array<{
    id: string;
    amount: number;
    risk_type: string;
    risk_level: string;
    risk_score: number;
    reason: string;
    recommended_action: string;
    status: string;
    detected_at: string;
  }>;
  actions: Array<{
    id: string;
    tool_name: string;
    decision: string;
    approval_status: string;
    execution_status: string;
    revenue_recovered: number;
    error: string;
    created_at: string;
  }>;
  audit: Array<{
    id: string;
    timestamp: string;
    category: string;
    event: string;
    revenue_impact: number;
  }>;
  assessment: {
    riskScore: number;
    riskLevel: string;
    reason: string;
    confidence: number;
    explanation: string;
    potentialDownside: string;
    expectedRecovery: number;
    evidence: {
      lastSuccessfulPayment: string;
      previousFailures: number;
      avgPaymentIntervalDays: number;
      customerStatus: string;
      daysSinceLastPayment: number;
    };
  } | null;
}

export default function CustomerProfilePage() {
  const params = useParams();
  const customerId = params.id as string;
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      const d = await res.json();
      if (d.customer) setData(d);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Customer not found</p>
        <Link href="/risks"><Button variant="outline" size="sm" className="mt-4">Back to Risks</Button></Link>
      </div>
    );
  }

  const { customer, payments, orders, subscriptions, risks, actions, audit, assessment } = data;

  const timeline = [
    ...payments.map((p) => ({ type: 'payment', date: p.created_at, data: p })),
    ...orders.map((o) => ({ type: 'order', date: o.created_at, data: o })),
    ...actions.map((a) => ({ type: 'action', date: a.created_at, data: a })),
    ...audit.map((l) => ({ type: 'audit', date: l.timestamp, data: l })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const paymentChartData = [...payments]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((p, i) => ({
      date: formatDateTime(p.created_at),
      amount: p.amount,
      successful: p.status === 'captured' ? p.amount : 0,
      failed: p.status === 'failed' ? p.amount : 0,
    }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <Link href="/risks" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Revenue Risks
      </Link>

      {/* Customer Header */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary text-xl font-bold">
            {customer.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>
              <span className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>
              <Badge variant="outline" className="text-xs">{customer.customer_number}</Badge>
              <StatusBadge status={customer.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="h-3.5 w-3.5" /> Lifetime Value</div>
            <div className="text-xl font-bold">{formatCurrency(customer.lifetime_value)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><CreditCard className="h-3.5 w-3.5" /> Total Orders</div>
            <div className="text-xl font-bold">{customer.total_orders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /> Avg Payment Interval</div>
            <div className="text-xl font-bold">{customer.avg_payment_interval_days || 0} days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Activity className="h-3.5 w-3.5" /> Last Payment</div>
            <div className="text-xl font-bold">{customer.last_payment_at ? formatTimeAgo(customer.last_payment_at) : '—'}</div>
          </CardContent>
        </Card>
      </div>

      {/* AI Assessment */}
      {assessment && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">AI Risk Assessment</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Risk Score</span>
                <span className="text-2xl font-bold">{assessment.riskScore}%</span>
              </div>
              <RiskBadge level={assessment.riskLevel} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Confidence</span>
                <span className="text-lg font-semibold">{assessment.confidence}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Expected Recovery</span>
                <span className="text-lg font-semibold text-success">{formatCurrency(assessment.expectedRecovery)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg bg-card border border-border">
              <div>
                <div className="text-xs text-muted-foreground">Last Successful Payment</div>
                <div className="text-sm font-medium">{assessment.evidence.lastSuccessfulPayment ? formatTimeAgo(assessment.evidence.lastSuccessfulPayment) : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Previous Failures</div>
                <div className="text-sm font-medium">{assessment.evidence.previousFailures}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Days Since Last Payment</div>
                <div className="text-sm font-medium">{assessment.evidence.daysSinceLastPayment || 0} days</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Customer Status</div>
                <div className="text-sm font-medium capitalize">{assessment.evidence.customerStatus}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why this customer was selected</span>
                <p className="text-sm mt-1">{assessment.reason}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Explanation</span>
                <p className="text-sm mt-1">{assessment.explanation}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Potential Downside</span>
                <p className="text-sm mt-1 text-muted-foreground">{assessment.potentialDownside}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History Chart */}
      {paymentChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={paymentChartData}>
                <defs>
                  <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `₹${v/1000}K`} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="successful" name="Successful" stroke="hsl(142, 71%, 45%)" fill="url(#successGrad)" />
                <Area type="monotone" dataKey="failed" name="Failed" stroke="hsl(0, 72%, 51%)" fill="url(#failGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Revenue Risks */}
      {risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Risks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {risks.map((risk) => (
              <div key={risk.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <div>
                    <div className="text-sm font-medium">{formatCurrency(risk.amount)} at risk</div>
                    <div className="text-xs text-muted-foreground">{risk.reason}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={risk.risk_level} />
                  <StatusBadge status={risk.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Subscriptions */}
      {subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <div className="text-sm font-medium">{sub.plan_name} ({sub.billing_cycle})</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(sub.amount)} · ends {sub.current_period_end ? formatDateTime(sub.current_period_end) : '—'}</div>
                </div>
                <StatusBadge status={sub.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Previous Interventions */}
      {actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Previous AI Interventions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actions.map((action) => (
              <div key={action.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Zap className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-sm font-medium">{action.tool_name}</div>
                    <div className="text-xs text-muted-foreground">{action.decision || '—'}</div>
                    {action.error && <div className="text-xs text-destructive mt-0.5">{action.error}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {action.revenue_recovered && (
                    <Badge variant="outline" className="text-xs text-success border-success/20">+{formatCurrency(action.revenue_recovered)}</Badge>
                  )}
                  <StatusBadge status={action.execution_status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-4 pl-6">
            <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
            {timeline.slice(0, 30).map((item) => {
              const d = item.data as Record<string, unknown>;
              const status = d.status as string;
              const icon = item.type === 'payment' ? (status === 'captured' ? CheckCircle2 : status === 'failed' ? XCircle : CreditCard)
                : item.type === 'order' ? CreditCard
                : item.type === 'action' ? Zap
                : Activity;
              const Icon = icon;
              const color = item.type === 'payment' ? (status === 'captured' ? 'text-success' : status === 'failed' ? 'text-destructive' : 'text-muted-foreground')
                : item.type === 'action' ? 'text-primary'
                : 'text-muted-foreground';

              let label = '';
              if (item.type === 'payment') label = `Payment ${status} — ${formatCurrency(d.amount as number)}`;
              else if (item.type === 'order') label = `Order ${d.order_number} — ${formatCurrency(d.amount as number)} (${status})`;
              else if (item.type === 'action') label = `${d.tool_name}: ${(d.decision as string) || ''}`;
              else if (item.type === 'audit') label = d.event as string;

              return (
                <div key={`${item.type}-${d.id}`} className="relative">
                  <div className={`absolute -left-5 flex h-3 w-3 items-center justify-center rounded-full bg-card border border-border`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${color.replace('text-', 'bg-')}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                    <span className="text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(item.date)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

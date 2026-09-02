'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Percent,
  XCircle,
  Users,
  Bot,
  Clock,
  ArrowRight,
  Zap,
  Brain,
} from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import Link from 'next/link';

interface Metrics {
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

interface AuditEntry {
  id: string;
  timestamp: string;
  category: string;
  event: string;
  customer_name?: string;
  revenue_impact?: number;
}

interface ActionPerformance {
  action: string;
  totalAttempts: number;
  successfulRecoveries: number;
  recoveryRate: number;
  totalRevenueRecovered: number;
  averageRecoveryAmount: number;
  hasSufficientData: boolean;
}

interface LearningSummary {
  totalInterventions: number;
  bestAction: string | null;
  bestRecoveryRate: number;
  overallRecoveryRate: number;
  totalRevenueRecovered: number;
  performance: ActionPerformance[];
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [auditFeed, setAuditFeed] = useState<AuditEntry[]>([]);
  const [learning, setLearning] = useState<LearningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, auditRes, learningRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/api/audit-feed?limit=8'),
        fetch('/api/learning'),
      ]);
      const metricsData = await metricsRes.json();
      const auditData = await auditRes.json();
      const learningData = await learningRes.json();

      if (metricsData.totalProcessedRevenue !== undefined) {
        setMetrics(metricsData);
        setHasData(true);
      }
      if (auditData.entries) setAuditFeed(auditData.entries);
      if (learningData) setLearning(learningData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Welcome to Revenue Rescue AI</h2>
          <p className="text-muted-foreground text-sm max-w-md mb-6">
            Click "Load Demo Data" in the top bar to initialize realistic customers, payments, and revenue risk scenarios.
          </p>
        </div>
      </div>
    );
  }

  const riskBreakdownData = [
    { name: 'Failed Payments', value: metrics!.riskBreakdown.failed_payments, color: 'hsl(0, 72%, 51%)' },
    { name: 'Abandoned Checkouts', value: metrics!.riskBreakdown.abandoned_checkouts, color: 'hsl(38, 92%, 50%)' },
    { name: 'Inactive Customers', value: metrics!.riskBreakdown.inactive_customers, color: 'hsl(270, 65%, 55%)' },
    { name: 'Subscription Failures', value: metrics!.riskBreakdown.subscription_failures, color: 'hsl(199, 89%, 48%)' },
  ];

  const revenueTrendData = [
    { day: 'Mon', atRisk: 185000, recovered: 32000 },
    { day: 'Tue', atRisk: 210000, recovered: 45000 },
    { day: 'Wed', atRisk: 195000, recovered: 52000 },
    { day: 'Thu', atRisk: 248500, recovered: 68000 },
    { day: 'Fri', atRisk: 220000, recovered: 85000 },
    { day: 'Sat', atRisk: 198000, recovered: 92000 },
    { day: 'Sun', atRisk: 215000, recovered: 105000 },
  ];

  const interventionData = (learning?.performance ?? []).map((p) => ({
    name: p.action === 'retry_payment' ? 'Payment Retry'
      : p.action === 'create_payment_link' ? 'Payment Link'
      : p.action === 'send_reminder' ? 'Reminder'
      : p.action === 'escalate_human' ? 'Escalation'
      : p.action === 'offer_recovery_option' ? 'Recovery Offer'
      : p.action,
    recovery: p.recoveryRate,
    attempts: p.totalAttempts,
    hasData: p.hasSufficientData,
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* AI Revenue Risk Hero */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">AI Revenue Risk</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">
                  {formatCurrency(metrics!.revenueAtRisk)} <span className="text-base font-normal text-muted-foreground">currently at risk</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {metrics!.customersAtRisk} customers affected · {metrics!.activeInterventions} active AI interventions
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {riskBreakdownData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <div>
                    <div className="text-xs text-muted-foreground">{item.name}</div>
                    <div className="text-sm font-semibold">{formatCurrencyCompact(item.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Processed Revenue" value={formatCurrency(metrics!.totalProcessedRevenue)} icon={TrendingUp} variant="default" />
        <MetricCard label="Revenue at Risk" value={formatCurrency(metrics!.revenueAtRisk)} icon={AlertTriangle} variant="destructive" />
        <MetricCard label="Revenue Recovered" value={formatCurrency(metrics!.revenueRecovered)} icon={CheckCircle2} variant="success" />
        <MetricCard label="Recovery Rate" value={`${metrics!.recoveryRate}%`} icon={Percent} variant="default" />
        <MetricCard label="Failed Payments" value={String(metrics!.failedPayments)} icon={XCircle} variant="destructive" />
        <MetricCard label="Customers at Risk" value={String(metrics!.customersAtRisk)} icon={Users} variant="warning" />
        <MetricCard label="Active AI Interventions" value={String(metrics!.activeInterventions)} icon={Bot} variant="default" />
        <MetricCard label="Avg Recovery Time" value={`${metrics!.averageRecoveryTimeHours}h`} icon={Clock} variant="success" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue at Risk vs Recovered */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue at Risk vs Recovered (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="colorAtRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRecovered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatCurrencyCompact(v)} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="atRisk" name="At Risk" stroke="hsl(0, 72%, 51%)" fillOpacity={1} fill="url(#colorAtRisk)" />
                <Area type="monotone" dataKey="recovered" name="Recovered" stroke="hsl(142, 71%, 45%)" fillOpacity={1} fill="url(#colorRecovered)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk Breakdown Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue at Risk Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={riskBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {riskBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* AI Recovery Learning */}
      {learning && learning.totalInterventions > 0 && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">AI Recovery Learning</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-card border border-border">
                <div className="text-xs text-muted-foreground">Interventions Analyzed</div>
                <div className="text-lg font-bold">{learning.totalInterventions}</div>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border">
                <div className="text-xs text-muted-foreground">Best Action</div>
                <div className="text-lg font-bold text-primary">
                  {learning.bestAction
                    ? learning.bestAction === 'retry_payment' ? 'Payment Retry'
                      : learning.bestAction === 'create_payment_link' ? 'Payment Link'
                      : learning.bestAction === 'send_reminder' ? 'Reminder'
                      : learning.bestAction === 'escalate_human' ? 'Escalation'
                      : learning.bestAction
                    : '—'}
                </div>
                {learning.bestAction && (
                  <div className="text-xs text-muted-foreground">{learning.bestRecoveryRate}% recovery rate</div>
                )}
              </div>
              <div className="p-3 rounded-lg bg-card border border-border">
                <div className="text-xs text-muted-foreground">Overall Recovery Rate</div>
                <div className="text-lg font-bold">{learning.overallRecoveryRate}%</div>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border">
                <div className="text-xs text-muted-foreground">Revenue Recovered</div>
                <div className="text-lg font-bold text-success">{formatCurrency(learning.totalRevenueRecovered)}</div>
              </div>
            </div>

            {learning.performance.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Comparison</div>
                {learning.performance.map((p) => (
                  <div key={p.action} className="flex items-center gap-3">
                    <span className="text-sm w-32 shrink-0">
                      {p.action === 'retry_payment' ? 'Payment Retry'
                        : p.action === 'create_payment_link' ? 'Payment Link'
                        : p.action === 'send_reminder' ? 'Reminder'
                        : p.action === 'escalate_human' ? 'Escalation'
                        : p.action === 'offer_recovery_option' ? 'Recovery Offer'
                        : p.action}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${p.recoveryRate}%`,
                          backgroundColor: p.recoveryRate > 50 ? 'hsl(142, 71%, 45%)' : p.recoveryRate > 30 ? 'hsl(199, 89%, 48%)' : 'hsl(38, 92%, 50%)',
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-12 text-right">
                      {p.hasSufficientData ? `${p.recoveryRate}%` : '—'}
                    </span>
                    <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
                      {p.hasSufficientData
                        ? `${p.successfulRecoveries}/${p.totalAttempts} recovered`
                        : `${p.totalAttempts} attempt${p.totalAttempts === 1 ? '' : 's'}`}
                    </span>
                  </div>
                ))}
                {!learning.performance.some((p) => p.hasSufficientData) && (
                  <p className="text-xs text-muted-foreground">
                    Fewer than 5 historical examples per action — learning will activate once more data is collected.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bottom Row: Intervention Performance + Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Intervention Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {interventionData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground text-center">
                  No intervention data yet.<br />Run the AI agent to start collecting performance metrics.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={interventionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => `${value}% recovery rate`}
                  />
                  <Bar dataKey="recovery" name="Recovery %" radius={[4, 4, 0, 0]}>
                    {interventionData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.recovery > 50 ? 'hsl(142, 71%, 45%)' : entry.recovery > 35 ? 'hsl(199, 89%, 48%)' : 'hsl(38, 92%, 50%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Live Audit Feed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Live Agent Activity</CardTitle>
            <Link href="/audit">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[240px] overflow-y-auto scrollbar-thin">
            {auditFeed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No agent activity yet</p>
            ) : (
              auditFeed.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                    entry.category === 'result' ? 'bg-success' :
                    entry.category === 'error' ? 'bg-destructive' :
                    entry.category === 'approval' ? 'bg-warning' :
                    entry.category === 'action' ? 'bg-primary' :
                    'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.event}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.customer_name && `${entry.customer_name} · `}
                      {new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      {entry.revenue_impact ? ` · ${formatCurrency(entry.revenue_impact)}` : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/agent">
          <Button className="gap-2">
            <Bot className="h-4 w-4" /> Run AI Agent
          </Button>
        </Link>
        <Link href="/risks">
          <Button variant="outline" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> View Revenue Risks
          </Button>
        </Link>
        <Link href="/approvals">
          <Button variant="outline" className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> Pending Approvals
          </Button>
        </Link>
      </div>
    </div>
  );
}

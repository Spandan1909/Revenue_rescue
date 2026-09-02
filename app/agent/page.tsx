'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RiskBadge, StatusBadge } from '@/components/dashboard/badges';
import { formatCurrency, formatTimeAgo, formatDateTime } from '@/lib/format';
import {
  Bot, Zap, Search, AlertTriangle, CheckCircle2, Loader2, Activity,
  TrendingUp, ArrowRight, FileText, Brain, Target,
} from 'lucide-react';
import Link from 'next/link';

interface AgentRisk {
  id: string;
  customer_id: string;
  amount: number;
  risk_type: string;
  risk_level: string;
  risk_score: number;
  reason: string;
  recommended_action: string;
  status: string;
  detected_at: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_number?: string;
  customer_status?: string;
  customer_lifetime_value?: number;
  customer_total_orders?: number;
  customer_last_payment_at?: string;
}

interface AgentTask {
  id: string;
  status: string;
  trigger: string;
  summary: string;
  confidence: number;
  created_at: string;
  completed_at: string;
}

const riskTypeLabels: Record<string, string> = {
  failed_payment: 'Failed Payment',
  abandoned_checkout: 'Abandoned Checkout',
  inactive_customer: 'Inactive Customer',
  subscription_failure: 'Subscription Failure',
};

const actionLabels: Record<string, string> = {
  retry_payment: 'Retry Payment',
  send_reminder: 'Send Reminder',
  create_payment_link: 'Create Payment Link',
  offer_recovery_option: 'Recovery Offer',
  escalate_human: 'Escalate to Human',
  do_nothing: 'No Action',
};

export default function AgentPage() {
  const [risks, setRisks] = useState<AgentRisk[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<null | Record<string, unknown>>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/run');
      const data = await res.json();
      if (data.risks) setRisks(data.risks);
      if (data.tasks) setTasks(data.tasks);
      if (data.businessId) setBusinessId(data.businessId);
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

  const runAgent = async (riskId: string) => {
    setRunning(riskId);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskId, businessId: businessId || '' }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
      fetchData();
    } catch {
      setError('Failed to run agent');
    }
    setRunning(null);
  };

  const runSimulation = async () => {
    setRunning('simulation');
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/simulate', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
      fetchData();
    } catch {
      setError('Failed to run simulation');
    }
    setRunning(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Revenue Rescue Agent</h1>
            <p className="text-sm text-muted-foreground">Autonomous AI revenue recovery — Detect, Diagnose, Decide, Act, Verify, Learn</p>
          </div>
        </div>
        <Button onClick={runSimulation} disabled={running === 'simulation'} className="gap-2">
          {running === 'simulation' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Run Revenue Rescue Simulation
        </Button>
      </div>

      {/* Pipeline Visualization */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {['Detect', 'Diagnose', 'Decide', 'Act', 'Verify', 'Learn'].map((step, i) => (
          <div key={step} className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
              <span className="text-sm font-medium">{step}</span>
            </div>
            {i < 5 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Agent Result */}
      {result && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card animate-fade-in">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <CardTitle className="text-base">Agent Analysis Complete</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(result as { assessment?: Record<string, unknown> }).assessment && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-card border border-border">
                  <div className="text-xs text-muted-foreground">Risk Score</div>
                  <div className="text-lg font-bold">{(result as { assessment: { riskScore: number } }).assessment.riskScore}%</div>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border">
                  <div className="text-xs text-muted-foreground">Confidence</div>
                  <div className="text-lg font-bold">{(result as { assessment: { confidence: number } }).assessment.confidence}%</div>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border">
                  <div className="text-xs text-muted-foreground">Expected Recovery</div>
                  <div className="text-lg font-bold text-success">{formatCurrency((result as { assessment: { expectedRecovery: number } }).assessment.expectedRecovery)}</div>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border">
                  <div className="text-xs text-muted-foreground">Approval Needed</div>
                  <div className="text-lg font-bold">{(result as { approvalNeeded: boolean }).approvalNeeded ? 'Yes' : 'No'}</div>
                </div>
              </div>
            )}
            {(result as { decision?: Record<string, unknown> }).decision && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">AI Decision</span>
                </div>
                <p className="text-sm">{(result as { decision: { explanation: string } }).decision.explanation}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Recommended action: </span>
                  <Badge variant="outline" className="text-xs">{actionLabels[(result as { decision: { action: string } }).decision.action] || (result as { decision: { action: string } }).decision.action}</Badge>
                </div>
                {(result as { decision: { learningInsight?: string | null } }).decision?.learningInsight && (
                  <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      {(result as { decision: { learningInsight: string } }).decision.learningInsight}
                    </p>
                  </div>
                )}
                {(result as { approvalNeeded: boolean }).approvalNeeded && (
                  <Link href="/approvals">
                    <Button size="sm" className="mt-3 gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Review Pending Approval
                    </Button>
                  </Link>
                )}
              </div>
            )}
            {(result as { simulated?: boolean }).simulated && (
              <Badge variant="outline" className="text-xs text-warning border-warning/20">Simulated Razorpay API</Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Open Risks — Agent Queue */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Open Revenue Risks — Agent Queue</h2>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : risks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-success/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No open revenue risks. The agent is idle.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {risks.map((risk) => (
              <Card key={risk.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">{risk.customer_name}</span>
                          <RiskBadge level={risk.risk_level} />
                          <StatusBadge status={risk.status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-destructive">{formatCurrency(risk.amount)} at risk</span>
                          <span>{riskTypeLabels[risk.risk_type]}</span>
                          <span>Score: {risk.risk_score}%</span>
                          <span>Detected {formatTimeAgo(risk.detected_at)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{risk.reason}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => runAgent(risk.id)}
                        disabled={running === risk.id || risk.status !== 'open'}
                        className="gap-2"
                      >
                        {running === risk.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                        {risk.status === 'open' ? 'Run Agent' : 'Processing...'}
                      </Button>
                      <Link href={`/customers/${risk.customer_id}`}>
                        <Button variant="ghost" size="sm" className="text-xs gap-1">
                          Details <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Agent Tasks */}
      {tasks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Agent Tasks</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {tasks.slice(0, 10).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <div className="text-sm font-medium">{task.trigger}</div>
                        {task.summary && <div className="text-xs text-muted-foreground truncate max-w-md">{task.summary}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {task.confidence && <span className="text-xs text-muted-foreground">{task.confidence}% confidence</span>}
                      <StatusBadge status={task.status} />
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(task.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

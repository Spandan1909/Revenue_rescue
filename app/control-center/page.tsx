'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/dashboard/badges';
import { formatCurrency } from '@/lib/format';
import {
  Settings, Bot, Activity, CheckCircle2, XCircle, AlertTriangle,
  ShieldCheck, Clock, TrendingUp, Loader2, Save,
} from 'lucide-react';

interface AgentConfig {
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
}

interface Stats {
  completedActions: number;
  failedActions: number;
  pendingApprovals: number;
  activeInvestigations: number;
  completedTasks: number;
  recoveredRevenue: number;
  totalRisks: number;
  openRisks: number;
}

export default function ControlCenterPage() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/control-center');
      const data = await res.json();
      if (data.config) setConfig(data.config);
      if (data.stats) setStats(data.stats);
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

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/control-center', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: config.business_id,
          auto_analysis: config.auto_analysis,
          auto_retry: config.auto_retry,
          auto_payment_link: config.auto_payment_link,
          human_approval_required: config.human_approval_required,
          max_auto_recovery_amount: config.max_auto_recovery_amount,
          max_retry_attempts: config.max_retry_attempts,
          confidence_threshold: config.confidence_threshold,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError('Failed to save settings');
    }
    setSaving(false);
  };

  const updateConfig = (key: keyof AgentConfig, value: boolean | number) => {
    setConfig((prev) => prev ? { ...prev, [key]: value } : null);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-16 text-center">
          <Settings className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No agent configuration found. Load demo data first.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agent Control Center</h1>
            <p className="text-sm text-muted-foreground">Configure automation limits and monitor agent activity</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-4"><p className="text-sm text-destructive">{error}</p></CardContent>
        </Card>
      )}

      {/* Agent Status */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${config.agent_status === 'running' ? 'bg-warning/10' : 'bg-success/10'}`}>
                <Bot className={`h-6 w-6 ${config.agent_status === 'running' ? 'text-warning' : 'text-success'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold capitalize">{config.agent_status}</span>
                  <div className={`h-2 w-2 rounded-full ${config.agent_status === 'running' ? 'bg-warning animate-pulse' : 'bg-success'}`} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {config.current_task || 'No active task'}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">Agent ID: {config.id.slice(0, 8)}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Activity className="h-3.5 w-3.5" /> Active Investigations</div>
            <div className="text-2xl font-bold">{stats?.activeInvestigations || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><ShieldCheck className="h-3.5 w-3.5 text-warning" /> Pending Approvals</div>
            <div className="text-2xl font-bold">{stats?.pendingApprovals || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Completed Actions</div>
            <div className="text-2xl font-bold text-success">{stats?.completedActions || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><XCircle className="h-3.5 w-3.5 text-destructive" /> Failed Actions</div>
            <div className="text-2xl font-bold text-destructive">{stats?.failedActions || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="h-3.5 w-3.5 text-success" /> Revenue Recovered</div>
            <div className="text-2xl font-bold text-success">{formatCurrency(stats?.recoveredRevenue || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><AlertTriangle className="h-3.5 w-3.5" /> Open Risks</div>
            <div className="text-2xl font-bold">{stats?.openRisks || 0}/{stats?.totalRisks || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><CheckCircle2 className="h-3.5 w-3.5" /> Completed Tasks</div>
            <div className="text-2xl font-bold">{stats?.completedTasks || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /> Avg Recovery Time</div>
            <div className="text-2xl font-bold">18h</div>
          </CardContent>
        </Card>
      </div>

      {/* Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automation Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <div className="text-sm font-medium">Auto-Analysis</div>
                <div className="text-xs text-muted-foreground">Automatically analyze customers for revenue risk</div>
              </div>
              <Switch checked={config.auto_analysis} onCheckedChange={(v) => updateConfig('auto_analysis', v)} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <div className="text-sm font-medium">Auto-Retry</div>
                <div className="text-xs text-muted-foreground">Automatically retry failed payments (low risk only)</div>
              </div>
              <Switch checked={config.auto_retry} onCheckedChange={(v) => updateConfig('auto_retry', v)} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <div className="text-sm font-medium">Auto Payment-Link Generation</div>
                <div className="text-xs text-muted-foreground">Automatically generate Razorpay payment links (medium risk)</div>
              </div>
              <Switch checked={config.auto_payment_link} onCheckedChange={(v) => updateConfig('auto_payment_link', v)} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <div className="text-sm font-medium">Human Approval Required</div>
                <div className="text-xs text-muted-foreground">Require human approval for medium/high risk actions</div>
              </div>
              <Switch checked={config.human_approval_required} onCheckedChange={(v) => updateConfig('human_approval_required', v)} />
            </div>
          </div>

          {/* Numeric Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border">
            <div>
              <label className="text-sm font-medium mb-2 block">Max Auto Recovery Amount</label>
              <Input
                type="number"
                value={config.max_auto_recovery_amount}
                onChange={(e) => updateConfig('max_auto_recovery_amount', parseFloat(e.target.value) || 0)}
                className="mb-1"
              />
              <p className="text-xs text-muted-foreground">Maximum amount the agent can recover without approval</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Max Retry Attempts</label>
              <Input
                type="number"
                value={config.max_retry_attempts}
                onChange={(e) => updateConfig('max_retry_attempts', parseInt(e.target.value) || 0)}
                className="mb-1"
              />
              <p className="text-xs text-muted-foreground">Maximum payment retry attempts per customer</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Confidence Threshold: {config.confidence_threshold}%</label>
              <Slider
                value={[config.confidence_threshold]}
                onValueChange={(v) => updateConfig('confidence_threshold', v[0])}
                min={0}
                max={100}
                step={5}
                className="mb-2"
              />
              <p className="text-xs text-muted-foreground">Minimum confidence for autonomous action</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety Notice */}
      <Card className="border-warning/20 bg-warning/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Safety Guarantees</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <li>• The agent will never bypass the limits configured above</li>
                <li>• High-risk actions (discounts, refunds, large amounts) always require human approval</li>
                <li>• All actions are recorded in the audit trail with full evidence</li>
                <li>• Failed actions are escalated to human review, not retried indefinitely</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

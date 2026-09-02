'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RiskBadge, StatusBadge } from '@/components/dashboard/badges';
import { formatCurrency, formatTimeAgo } from '@/lib/format';
import {
  ShieldCheck, CheckCircle2, XCircle, Edit, Loader2, AlertTriangle,
  Bot, TrendingUp, FileText, Link2, Mail, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface Approval {
  id: string;
  action_id: string;
  customer_id: string;
  revenue_risk_id: string;
  amount: number;
  action_type: string;
  reason: string;
  status: string;
  modified_amount: number | null;
  reviewer_note: string | null;
  created_at: string;
  decided_at: string | null;
  customer_name: string;
  customer_email: string;
  risk_amount: number;
  risk_type: string;
  risk_reason: string;
}

const actionLabels: Record<string, string> = {
  retry_payment: 'Retry Payment',
  send_reminder: 'Send Recovery Message',
  create_payment_link: 'Generate Razorpay Payment Link',
  offer_recovery_option: 'Offer Recovery Option',
  escalate_human: 'Escalate to Human',
};

const actionIcons: Record<string, typeof Bot> = {
  retry_payment: TrendingUp,
  send_reminder: Mail,
  create_payment_link: Link2,
  offer_recovery_option: AlertTriangle,
  escalate_human: ShieldCheck,
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modifiedAmount, setModifiedAmount] = useState<string>('');

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals');
      const data = await res.json();
      if (data.approvals) setApprovals(data.approvals);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 5000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const handleApprove = async (approval: Approval) => {
    setProcessing(approval.id);
    setError(null);
    setSuccess(null);
    try {
      const businessId = approval.customer_id;
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          approvalId: approval.id,
          actionId: approval.action_id,
          businessId,
          modifiedAmount: editingId === approval.id && modifiedAmount ? parseFloat(modifiedAmount) : null,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.paymentLink) {
        setSuccess(`Payment link created! ${data.simulated ? '(Simulated)' : ''} — ${data.paymentLink.short_url}`);
      } else {
        setSuccess('Action approved and executed successfully.');
      }
      fetchApprovals();
    } catch {
      setError('Failed to approve action');
    }
    setProcessing(null);
    setEditingId(null);
    setModifiedAmount('');
  };

  const handleReject = async (approval: Approval) => {
    setProcessing(approval.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          approvalId: approval.id,
          actionId: approval.action_id,
          businessId: approval.customer_id,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('Action rejected. The risk remains open for future review.');
      }
      fetchApprovals();
    } catch {
      setError('Failed to reject action');
    }
    setProcessing(null);
  };

  const pending = approvals.filter((a) => a.status === 'pending');
  const decided = approvals.filter((a) => a.status !== 'pending');

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
          <ShieldCheck className="h-6 w-6 text-warning" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Human Approvals</h1>
          <p className="text-sm text-muted-foreground">
            {pending.length} pending · Revenue-affecting actions require human approval
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-success/20 bg-success/5">
          <CardContent className="pt-4">
            <p className="text-sm text-success">{success}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : pending.length === 0 && decided.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No approval requests yet. Run the AI agent to generate recovery actions.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pending Approvals */}
          {pending.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Approvals</h2>
              {pending.map((approval) => {
                const ActionIcon = actionIcons[approval.action_type] || Bot;
                return (
                  <Card key={approval.id} className="border-warning/20">
                    <CardContent className="pt-5 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                            <ActionIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold">Recover {formatCurrency(approval.amount)} from {approval.customer_name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                              Action: {actionLabels[approval.action_type] || approval.action_type}
                            </div>
                            <div className="p-3 rounded-lg bg-muted/50 border border-border">
                              <div className="flex items-center gap-2 mb-1">
                                <Bot className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Recommendation</span>
                              </div>
                              <p className="text-sm">{approval.reason}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <RiskBadge level={approval.risk_type === 'failed_payment' ? 'high' : 'medium'} />
                              <span className="text-xs text-muted-foreground">{approval.risk_reason}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-bold text-destructive">{formatCurrency(approval.amount)}</div>
                          <div className="text-xs text-muted-foreground">at risk</div>
                        </div>
                      </div>

                      {/* Modify Section */}
                      {editingId === approval.id && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                          <span className="text-xs text-muted-foreground">Modified amount:</span>
                          <Input
                            type="number"
                            value={modifiedAmount}
                            onChange={(e) => setModifiedAmount(e.target.value)}
                            placeholder={String(approval.amount)}
                            className="w-32 h-8 text-sm"
                          />
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setModifiedAmount(''); }}>
                            Cancel
                          </Button>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(approval)}
                          disabled={processing === approval.id}
                          className="gap-2 bg-success hover:bg-success/90"
                        >
                          {processing === approval.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(approval)}
                          disabled={processing === approval.id}
                          className="gap-2"
                        >
                          {processing === approval.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditingId(approval.id); setModifiedAmount(String(approval.amount)); }}
                          disabled={processing === approval.id}
                          className="gap-2"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Modify
                        </Button>
                        <Link href={`/customers/${approval.customer_id}`}>
                          <Button variant="ghost" size="sm" className="text-xs gap-1 ml-auto">
                            View Customer <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Decided Approvals */}
          {decided.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Decision History</h2>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {decided.slice(0, 15).map((approval) => (
                      <div key={approval.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                            {approval.status === 'approved' ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{approval.customer_name} — {actionLabels[approval.action_type] || approval.action_type}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(approval.amount)} · {formatTimeAgo(approval.created_at)}</div>
                          </div>
                        </div>
                        <StatusBadge status={approval.status} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

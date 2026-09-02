'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/dashboard/badges';
import { formatCurrency, formatTimeAgo } from '@/lib/format';
import {
  Mail, Bot, Send, CheckCircle2, XCircle, Loader2, Sparkles,
  MessageSquare, Target, TrendingUp,
} from 'lucide-react';

interface Campaign {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  message: string;
  channel: string;
  reason: string;
  expected_outcome: string;
  status: string;
  created_at: string;
  sent_at: string | null;
}

interface RiskOption {
  id: string;
  customer_name: string;
  customer_id: string;
  amount: number;
  risk_type: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [riskOptions, setRiskOptions] = useState<RiskOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<null | { message: string; reason: string; expected_outcome: string }>(null);
  const [selectedRisk, setSelectedRisk] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [campRes, riskRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/risks'),
      ]);
      const campData = await campRes.json();
      const riskData = await riskRes.json();
      if (campData.campaigns) setCampaigns(campData.campaigns);
      if (riskData.risks) {
        const open = riskData.risks.filter((r: { status: string }) => r.status === 'open');
        setRiskOptions(open.map((r: { id: string; customer_name: string; customer_id: string; amount: number; risk_type: string }) => ({
          id: r.id,
          customer_name: r.customer_name,
          customer_id: r.customer_id,
          amount: r.amount,
          risk_type: r.risk_type,
        })));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    if (!selectedRisk) return;
    const risk = riskOptions.find((r) => r.id === selectedRisk);
    if (!risk) return;
    setGenerating(risk.customer_id);
    setError(null);
    setGenerated(null);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          customerId: risk.customer_id,
          businessId: risk.customer_id,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setGenerated(data);
      }
    } catch {
      setError('Failed to generate campaign');
    }
    setGenerating(null);
  };

  const handleSaveAndApprove = async (status: 'pending_approval' | 'rejected') => {
    const risk = riskOptions.find((r) => r.id === selectedRisk);
    if (!risk || !generated) return;
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          customerId: risk.customer_id,
          businessId: risk.customer_id,
          revenueRiskId: risk.id,
          campaign: generated,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (status === 'pending_approval') {
        setSuccess('Campaign saved and pending approval.');
        setGenerated(null);
        fetchData();
      }
    } catch {
      setError('Failed to save campaign');
    }
  };

  const handleSend = async (campaignId: string) => {
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', campaignId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('Campaign sent (simulated).');
        fetchData();
      }
    } catch {
      setError('Failed to send campaign');
    }
  };

  const handleApprove = async (campaignId: string) => {
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', campaignId }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setSuccess('Campaign approved.'); fetchData(); }
    } catch {
      setError('Failed to approve campaign');
    }
  };

  const handleReject = async (campaignId: string) => {
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', campaignId }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setSuccess('Campaign rejected.'); fetchData(); }
    } catch {
      setError('Failed to reject campaign');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Campaign Generator</h1>
          <p className="text-sm text-muted-foreground">AI-generated personalized recovery messages for at-risk customers</p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-4"><p className="text-sm text-destructive">{error}</p></CardContent>
        </Card>
      )}
      {success && (
        <Card className="border-success/20 bg-success/5">
          <CardContent className="pt-4"><p className="text-sm text-success">{success}</p></CardContent>
        </Card>
      )}

      {/* Generator */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Generate Recovery Campaign</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block">Select at-risk customer</label>
              <select
                value={selectedRisk}
                onChange={(e) => setSelectedRisk(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground"
              >
                <option value="">Choose a customer...</option>
                {riskOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.customer_name} — {formatCurrency(r.amount)} at risk ({r.risk_type.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleGenerate} disabled={!selectedRisk || generating !== null} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Generate Message
            </Button>
          </div>

          {generated && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Generated Message</span>
                </div>
                <p className="text-sm">{generated.message}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason for Recommendation</span>
                  </div>
                  <p className="text-xs">{generated.reason}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expected Outcome</span>
                  </div>
                  <p className="text-xs">{generated.expected_outcome}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => handleSaveAndApprove('pending_approval')} className="gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Save for Approval
                </Button>
                <Button size="sm" variant="outline" onClick={() => setGenerated(null)} className="gap-2">
                  <XCircle className="h-3.5 w-3.5" /> Discard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Campaigns */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Campaign History</h2>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No campaigns yet. Generate one above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map((camp) => (
              <Card key={camp.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">{camp.customer_name}</span>
                        <StatusBadge status={camp.status} />
                        <Badge variant="outline" className="text-xs">{camp.channel}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{camp.message}</p>
                      {camp.reason && <p className="text-xs text-muted-foreground italic">{camp.reason}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(camp.created_at)}</p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {camp.status === 'pending_approval' && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(camp.id)} className="gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(camp.id)} className="gap-2">
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {camp.status === 'approved' && (
                        <Button size="sm" onClick={() => handleSend(camp.id)} className="gap-2">
                          <Send className="h-3.5 w-3.5" /> Send Now
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

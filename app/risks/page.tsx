'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RiskBadge, StatusBadge } from '@/components/dashboard/badges';
import { formatCurrency, formatTimeAgo } from '@/lib/format';
import { AlertTriangle, Search, ArrowRight, ChevronRight } from 'lucide-react';

interface RiskRow {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  risk_type: string;
  risk_level: string;
  risk_score: number;
  reason: string;
  recommended_action: string;
  status: string;
  detected_at: string;
  last_payment_at: string | null;
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

export default function RisksPage() {
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const fetchRisks = useCallback(async () => {
    try {
      const res = await fetch('/api/risks');
      const data = await res.json();
      if (data.risks) setRisks(data.risks);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  const filtered = risks.filter((r) => {
    if (search && !r.customer_name.toLowerCase().includes(search.toLowerCase()) && !r.customer_email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterLevel !== 'all' && r.risk_level !== filterLevel) return false;
    if (filterType !== 'all' && r.risk_type !== filterType) return false;
    return true;
  });

  const totalAtRisk = filtered.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Risk</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} risks · {formatCurrency(totalAtRisk)} total at risk
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1.5 p-1 bg-muted rounded-lg">
          {['all', 'high', 'medium', 'low'].map((level) => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filterLevel === level ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {level === 'all' ? 'All Risk' : `${level.charAt(0).toUpperCase()}${level.slice(1)} Risk`}
            </button>
          ))}
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-xs font-medium rounded-lg border border-border bg-card text-foreground"
        >
          <option value="all">All Types</option>
          <option value="failed_payment">Failed Payment</option>
          <option value="abandoned_checkout">Abandoned Checkout</option>
          <option value="inactive_customer">Inactive Customer</option>
          <option value="subscription_failure">Subscription Failure</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No revenue risks found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Customer</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Revenue at Risk</th>
                    <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Risk Score</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Reason</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Last Payment</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Recommended</th>
                    <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((risk) => (
                    <tr key={risk.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3">
                        <Link href={`/customers/${risk.customer_id}`} className="block">
                          <div className="text-sm font-medium">{risk.customer_name}</div>
                          <div className="text-xs text-muted-foreground">{risk.customer_email}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-destructive">{formatCurrency(risk.amount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                risk.risk_score >= 70 ? 'bg-destructive' : risk.risk_score >= 40 ? 'bg-warning' : 'bg-success'
                              }`}
                              style={{ width: `${risk.risk_score}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{risk.risk_score}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="text-xs text-muted-foreground truncate block">{risk.reason}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {risk.last_payment_at ? formatTimeAgo(risk.last_payment_at) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium">{actionLabels[risk.recommended_action] || risk.recommended_action}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={risk.status} />
                      </td>
                      <td className="px-2">
                        <Link href={`/customers/${risk.customer_id}`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

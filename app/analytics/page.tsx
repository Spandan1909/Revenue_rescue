'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import {
  BarChart3, TrendingUp, TrendingDown, Percent, Bot, CheckCircle2,
  XCircle, AlertTriangle, Target, Award, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Analytics {
  recovered: number;
  lost: number;
  atRisk: number;
  recoveryRate: number;
  failedPayments: number;
  totalPayments: number;
  interventionPerformance: Array<{
    type: string;
    label: string;
    total: number;
    successful: number;
    recoveryRate: number;
    revenue: number;
  }>;
  acceptanceRate: number;
  aiSuccessRate: number;
  failedInterventions: number;
  totalActions: number;
  successfulActions: number;
  revenueTrend: Array<{ day: string; recovered: number }>;
  customerSegments: Record<string, { total: number; recovered: number }>;
  totalRisks: number;
  recoveredRisks: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics');
      const d = await res.json();
      if (d.analytics) setData(d.analytics);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />)}
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-16 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No analytics data yet. Load demo data and run the agent.</p>
        </CardContent></Card>
      </div>
    );
  }

  const segmentData = Object.entries(data.customerSegments).map(([level, val]) => ({
    name: level.charAt(0).toUpperCase() + level.slice(1) + ' Risk',
    total: val.total,
    recovered: val.recovered,
    unrecovered: val.total - val.recovered,
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Recovery performance, AI effectiveness, and revenue insights</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="h-3.5 w-3.5 text-success" /> Revenue Recovered</div>
            <div className="text-2xl font-bold text-success">{formatCurrency(data.recovered)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingDown className="h-3.5 w-3.5 text-destructive" /> Revenue Lost</div>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(data.lost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Percent className="h-3.5 w-3.5" /> Recovery Rate</div>
            <div className="text-2xl font-bold">{data.recoveryRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Bot className="h-3.5 w-3.5 text-primary" /> AI Success Rate</div>
            <div className="text-2xl font-bold">{data.aiSuccessRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* AI Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> AI Recommendation Acceptance</div>
            <div className="text-xl font-bold">{data.acceptanceRate}%</div>
            <div className="text-xs text-muted-foreground mt-1">{data.totalActions} total actions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Award className="h-3.5 w-3.5" /> Successful Actions</div>
            <div className="text-xl font-bold">{data.successfulActions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><XCircle className="h-3.5 w-3.5 text-destructive" /> Failed Interventions</div>
            <div className="text-xl font-bold">{data.failedInterventions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><AlertTriangle className="h-3.5 w-3.5" /> Risks Recovered</div>
            <div className="text-xl font-bold">{data.recoveredRisks}/{data.totalRisks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Intervention Performance Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Intervention Performance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.interventionPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                formatter={(value: number, name: string) => name === 'recoveryRate' ? `${value}% recovery` : formatCurrency(value)}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="recoveryRate" name="Recovery Rate %" radius={[4, 4, 0, 0]}>
                {data.interventionPerformance.map((entry, i) => (
                  <Cell key={i} fill={entry.recoveryRate > 50 ? 'hsl(142, 71%, 45%)' : entry.recoveryRate > 35 ? 'hsl(199, 89%, 48%)' : 'hsl(38, 92%, 50%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue Trend + Customer Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Revenue Recovered (7 days)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => formatCurrencyCompact(v)} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Line type="monotone" dataKey="recovered" name="Recovered" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ fill: 'hsl(142, 71%, 45%)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Recovery by Customer Segment</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {segmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={segmentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => formatCurrencyCompact(v)} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="recovered" name="Recovered" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="unrecovered" name="Unrecovered" stackId="a" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No segment data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Intervention Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intervention Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Intervention</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Total Attempts</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Successful</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Recovery Rate</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Revenue Recovered</th>
                </tr>
              </thead>
              <tbody>
                {data.interventionPerformance.map((int) => (
                  <tr key={int.type} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{int.label}</td>
                    <td className="px-4 py-3 text-center text-sm">{int.total}</td>
                    <td className="px-4 py-3 text-center text-sm text-success">{int.successful}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-semibold ${int.recoveryRate > 50 ? 'text-success' : int.recoveryRate > 35 ? 'text-primary' : 'text-warning'}`}>
                        {int.recoveryRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">{formatCurrency(int.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

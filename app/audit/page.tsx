'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  ScrollText, Search, Filter, AlertTriangle, CheckCircle2,
  Bot, ShieldCheck, Zap, Activity, AlertCircle, TrendingUp,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AuditLog {
  id: string;
  timestamp: string;
  category: string;
  event: string;
  details: Record<string, unknown> | null;
  revenue_impact: number | null;
  customer_name: string | null;
  risk_amount: number | null;
  risk_type: string | null;
  action_tool: string | null;
  action_decision: string | null;
}

const categoryConfig: Record<string, { icon: typeof Bot; color: string; bg: string }> = {
  detection: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  diagnosis: { icon: Bot, color: 'text-primary', bg: 'bg-primary/10' },
  decision: { icon: Bot, color: 'text-primary', bg: 'bg-primary/10' },
  action: { icon: Zap, color: 'text-primary', bg: 'bg-primary/10' },
  approval: { icon: ShieldCheck, color: 'text-warning', bg: 'bg-warning/10' },
  webhook: { icon: Activity, color: 'text-muted-foreground', bg: 'bg-muted' },
  result: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  error: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const filtered = logs.filter((l) => {
    if (search && !l.event.toLowerCase().includes(search.toLowerCase()) && !(l.customer_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory !== 'all' && l.category !== filterCategory) return false;
    return true;
  });

  const categories = ['all', 'detection', 'diagnosis', 'decision', 'action', 'approval', 'result', 'error', 'webhook'];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <ScrollText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">Complete record of agent activity — demonstrates safe agentic behavior</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5 p-1 bg-muted rounded-lg overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                filterCategory === cat ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ScrollText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No audit entries yet. Run the AI agent to generate activity.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
              <div className="divide-y divide-border">
                {filtered.map((log) => {
                  const config = categoryConfig[log.category] || categoryConfig.action;
                  const Icon = config.icon;
                  return (
                    <div key={log.id} className="relative flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${config.bg} shrink-0 z-10 border-2 border-background`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">{log.event}</span>
                          <Badge variant="outline" className="text-[10px] font-medium">{log.category}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDateTime(log.timestamp)}</span>
                          {log.customer_name && <span>· {log.customer_name}</span>}
                          {log.action_tool && <span>· Tool: {log.action_tool}</span>}
                          {log.risk_type && <span>· {log.risk_type.replace(/_/g, ' ')}</span>}
                          {log.revenue_impact && (
                            <span className="text-success font-semibold">· +{formatCurrency(log.revenue_impact)}</span>
                          )}
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-1.5 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                            {Object.entries(log.details).slice(0, 4).map(([key, val]) => (
                              <span key={key} className="mr-3">
                                <span className="font-medium">{key}:</span> {typeof val === 'object' ? JSON.stringify(val).slice(0, 60) : String(val).slice(0, 80)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

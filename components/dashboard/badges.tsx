'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface RiskBadgeProps {
  level: string;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const styles: Record<string, string> = {
    high: 'bg-destructive/10 text-destructive border-destructive/20',
    medium: 'bg-warning/10 text-warning border-warning/20',
    low: 'bg-success/10 text-success border-success/20',
  };

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', styles[level] || styles.low, className)}>
      {level.charAt(0).toUpperCase() + level.slice(1)} Risk
    </Badge>
  );
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    open: 'bg-warning/10 text-warning border-warning/20',
    investigating: 'bg-primary/10 text-primary border-primary/20',
    action_pending: 'bg-warning/10 text-warning border-warning/20',
    action_approved: 'bg-primary/10 text-primary border-primary/20',
    action_rejected: 'bg-destructive/10 text-destructive border-destructive/20',
    recovered: 'bg-success/10 text-success border-success/20',
    lost: 'bg-destructive/10 text-destructive border-destructive/20',
    escalated: 'bg-muted text-muted-foreground border-border',
    pending: 'bg-warning/10 text-warning border-warning/20',
    approved: 'bg-success/10 text-success border-success/20',
    rejected: 'bg-destructive/10 text-destructive border-destructive/20',
    auto: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    failed: 'bg-destructive/10 text-destructive border-destructive/20',
    executing: 'bg-primary/10 text-primary border-primary/20',
    skipped: 'bg-muted text-muted-foreground border-border',
    draft: 'bg-muted text-muted-foreground border-border',
    pending_approval: 'bg-warning/10 text-warning border-warning/20',
    sent: 'bg-success/10 text-success border-success/20',
  };

  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', styles[status] || styles.open, className)}>
      {label}
    </Badge>
  );
}

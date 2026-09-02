'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'destructive' | 'success' | 'warning';
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  trendType = 'neutral',
  variant = 'default',
}: MetricCardProps) {
  const variantStyles = {
    default: 'text-primary bg-primary/10',
    destructive: 'text-destructive bg-destructive/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
  };

  const trendStyles = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', variantStyles[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {trend && (
          <p className={cn('text-xs font-medium mt-1', trendStyles[trendType])}>
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

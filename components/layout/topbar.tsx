'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Loader2, CheckCircle2 } from 'lucide-react';

export function Topbar() {
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/seed-check')
      .then((r) => r.json())
      .then((d) => {
        if (d.seeded) setSeeded(true);
      })
      .catch(() => {});
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSeeded(true);
        window.location.reload();
      }
    } catch {
      setError('Failed to initialize demo data');
    }
    setSeeding(false);
  };

  return (
    <header className="h-16 shrink-0 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          ShopNest India — Revenue Operations
        </h2>
        <Badge variant="outline" className="text-[10px] font-medium">
          Test Mode
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
        {seeded ? (
          <Badge variant="secondary" className="gap-1.5 text-xs">
            <CheckCircle2 className="h-3 w-3 text-success" />
            Demo data ready
          </Badge>
        ) : (
          <Button size="sm" onClick={handleSeed} disabled={seeding} className="gap-2">
            {seeding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {seeding ? 'Loading demo data...' : 'Load Demo Data'}
          </Button>
        )}
      </div>
    </header>
  );
}

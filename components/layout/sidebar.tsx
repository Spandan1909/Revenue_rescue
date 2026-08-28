'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  AlertTriangle,
  Bot,
  ShieldCheck,
  Settings,
  Mail,
  BarChart3,
  ScrollText,
  Zap,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/risks', label: 'Revenue Risk', icon: AlertTriangle },
  { href: '/agent', label: 'AI Agent', icon: Bot },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { href: '/campaigns', label: 'Campaigns', icon: Mail },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/audit', label: 'Audit Trail', icon: ScrollText },
  { href: '/control-center', label: 'Control Center', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight">Revenue Rescue</span>
          <span className="text-[10px] text-muted-foreground font-medium">AI Revenue Recovery</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground font-medium">Agent: Idle</span>
        </div>
      </div>
    </aside>
  );
}

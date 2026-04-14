'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Camera,
  PiggyBank,
  BarChart3,
  Settings,
  LayoutGrid,
  Tag,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Menu,
  X,
  Store,
  Target,
  CalendarDays,
  Calculator,
  KanbanSquare,
  Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const mainNav: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/expenses', label: 'Wydatki', icon: Receipt },
  { href: '/bills', label: 'Cykliczne wydatki', icon: FileText },
  { href: '/receipts', label: 'Paragony', icon: Camera },
  { href: '/stores', label: 'Sklepy', icon: Store },
  { href: '/budgets', label: 'Budżety', icon: Target },
  { href: '/savings', label: 'Oszczędności', icon: PiggyBank },
  { href: '/events', label: 'Wydarzenia', icon: CalendarDays },
  { href: '/kanban', label: 'Kanban', icon: KanbanSquare },
  { href: '/statistics', label: 'Statystyki', icon: BarChart3 },
  { href: '/taxes', label: 'Podatki', icon: Calculator },
  { href: '/invoices', label: 'Przychody', icon: Banknote },
];

const bottomNav: NavItem[] = [
  { href: '/templates', label: 'Szablony', icon: LayoutGrid },
  { href: '/templates/tags', label: 'Tagi', icon: Tag },
  { href: '/settings', label: 'Ustawienia', icon: Settings },
];

/* ─── Mobile top bar + sheet drawer ──────────────────────────── */
export function MobileHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return pathname === '/';
      if (href === '/templates') return pathname === '/templates' || (pathname.startsWith('/templates/') && !pathname.startsWith('/templates/tags'));
      return pathname.startsWith(href);
    },
    [pathname],
  );

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 lg:hidden">
      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 bg-sidebar [&>button]:hidden">
            <SheetTitle className="sr-only">Nawigacja</SheetTitle>
            <div className="flex h-full flex-col">
              {/* Logo */}
              <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                    F
                  </div>
                  <span className="text-lg font-semibold text-sidebar-foreground">
                    Financio
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
                {mainNav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Bottom */}
              <div className="px-3 pb-4">
                <Separator className="mb-3" />

                {bottomNav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                {user?.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  >
                    <Shield className="h-5 w-5 shrink-0" />
                    <span>Admin</span>
                  </Link>
                )}

                <Separator className="my-3" />

                {/* Theme toggle */}
                <div className="flex justify-center mb-3">
                  <ThemeToggle />
                </div>

                {/* User info */}
                <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                    {user?.firstName?.[0] ?? user?.username?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-sidebar-foreground">
                      {user?.firstName ?? user?.username}
                    </p>
                    <p className="truncate text-xs text-sidebar-foreground/50">
                      {user?.email}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-sidebar-foreground/50 hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
            F
          </div>
          <span className="font-semibold text-foreground">Financio</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle collapsed />
      </div>
    </header>
  );
}

/* ─── Desktop sidebar ────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return pathname === '/';
      if (href === '/templates') return pathname === '/templates' || (pathname.startsWith('/templates/') && !pathname.startsWith('/templates/tags'));
      return pathname.startsWith(href);
    },
    [pathname],
  );

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex',
        collapsed ? 'w-[68px]' : 'w-[260px]',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
          F
        </div>
        {!collapsed && (
          <span className="text-lg font-semibold text-sidebar-foreground">
            Financio
          </span>
        )}
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {mainNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                collapsed && 'justify-center px-2',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-2 pb-3">
        <Separator className="mb-2" />

        {bottomNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                collapsed && 'justify-center px-2',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}

        {user?.role === 'ADMIN' && (
          <>
            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin"
                    className="flex items-center justify-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  >
                    <Shield className="h-5 w-5 shrink-0" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Admin</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <Shield className="h-5 w-5 shrink-0" />
                <span>Admin</span>
              </Link>
            )}
          </>
        )}

        <Separator className="my-2" />

        {/* Theme toggle */}
        <div className={cn('flex mb-2', collapsed ? 'justify-center' : 'justify-center')}>
          {collapsed ? <ThemeToggle collapsed /> : <ThemeToggle />}
        </div>

        {/* User info + logout */}
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2',
            collapsed && 'justify-center px-2',
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
            {user?.firstName?.[0] ?? user?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.firstName ?? user?.username}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/50">
                {user?.email}
              </p>
            </div>
          )}
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-foreground/50 hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Wyloguj</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-sidebar-foreground/50 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'mt-1 h-8 w-full text-sidebar-foreground/50 hover:text-sidebar-foreground',
            collapsed && 'w-8 mx-auto',
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}

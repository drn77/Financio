'use client';

import { Sidebar, MobileHeader } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, sessionError, retrySession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !sessionError) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, sessionError, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <p className="text-sm text-muted-foreground">
            Nie udało się połączyć z serwerem.
          </p>
          <div className="flex gap-2">
            <button
              onClick={retrySession}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Spróbuj ponownie
            </button>
            <button
              onClick={() => {
                // Clear all caches and reload
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then((regs) =>
                    regs.forEach((r) => r.unregister())
                  );
                }
                caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
                document.cookie = 'financio.sid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                window.location.reload();
              }}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Wyczyść cache
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header with hamburger */}
      <MobileHeader />
      {/* Desktop sidebar */}
      <Sidebar />
      <div className="min-h-screen lg:ml-65 transition-all duration-300">
        <TopBar />
        <main className="p-4 pt-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

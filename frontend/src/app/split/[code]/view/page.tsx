'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SplitWidget } from '@/components/Split';
import { Loader2 } from 'lucide-react';

function ViewContent() {
  const searchParams = useSearchParams();
  const splitId = searchParams.get('splitId');

  if (!splitId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground">
        Brak identyfikatora splita
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SplitWidget splitId={splitId} fullScreen />
    </div>
  );
}

export default function SplitViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ViewContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Loader2, Users, LogIn } from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
import type { ISplitPreview } from '@shared/models';

interface Props {
  params: Promise<{ code: string }>;
}

export default function SplitJoinPage({ params }: Props) {
  const { code } = use(params);
  const router = useRouter();

  const [preview, setPreview] = useState<ISplitPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPreview();
  }, [code]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const data = await api.getSplitPreview(code);
      setPreview(data);
    } catch {
      setError('Nie znaleziono Splita — link może być nieprawidłowy');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      toastError('Podaj swój nick');
      return;
    }
    setJoining(true);
    try {
      const result = await api.joinSplit(code, {
        nickname: nickname.trim(),
        email: email.trim() || undefined,
      });

      // Store guest token for future access
      if (result.guestToken) {
        localStorage.setItem(`split_guest_${result.split.id}`, result.guestToken);
      }
      // Store participant ID for identifying ourselves
      localStorage.setItem(`split_pid_${result.split.id}`, result.participant.id);

      toastSuccess('Dołączyłeś do Splita!');

      // Redirect to the app — if user is logged in, they'll see the event
      // If guest, they'll be redirected to login but the token is stored
      // For now, redirect to a simple split view
      router.push(`/split/${code}/view?splitId=${result.split.id}`);
    } catch {
      toastError('Nie udało się dołączyć');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Błąd</CardTitle>
            <CardDescription>{error || 'Nie znaleziono Splita'}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => router.push('/login')}>
              Zaloguj się
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (preview.status !== 'ACTIVE') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>{preview.name}</CardTitle>
            <CardDescription>
              Ten split został już {preview.status === 'SETTLED' ? 'rozliczony' : 'zarchiwizowany'}.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{preview.name}</CardTitle>
          <CardDescription>
            {preview.participantCount} {preview.participantCount === 1 ? 'uczestnik' : 'uczestników'} · Dołącz do dzielenia wydatków
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="nickname">Twój nick *</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="np. Kasia"
              maxLength={50}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="email">Email (opcjonalnie)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kasia@example.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Podaj email, aby łatwiej Cię zidentyfikować
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full gap-2" onClick={handleJoin} disabled={joining || !nickname.trim()}>
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Dołącz do Splita
          </Button>
          <Button variant="link" size="sm" className="text-xs" onClick={() => router.push('/register')}>
            Nie masz konta? Załóż konto
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

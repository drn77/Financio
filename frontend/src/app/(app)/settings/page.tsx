'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Trash2, Users, Settings2, User } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ROLE_MAP: Record<string, string> = {
  OWNER: 'Właściciel',
  ADMIN: 'Admin',
  MEMBER: 'Członek',
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [family, setFamily] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '' });

  const loadFamily = useCallback(async () => {
    try {
      const [fam, mems] = await Promise.all([
        api.getFamily(),
        api.getFamilyMembers(),
      ]);
      setFamily(fam);
      setMembers(Array.isArray(mems) ? mems : []);
    } catch {
      /* no family */
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFamily(); }, [loadFamily]);

  const handleInvite = async () => {
    if (!inviteForm.email) return;
    try {
      await api.addFamilyMember(inviteForm.email);
      setInviteForm({ email: '' });
      setShowInvite(false);
      loadFamily();
    } catch (e) { console.error(e); }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await api.removeFamilyMember(memberId);
      loadFamily();
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings2 className="h-6 w-6" /> Ustawienia</h1>
        <p className="text-sm text-muted-foreground">Zarządzaj kontem i rodziną</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {(user?.firstName?.[0] ?? user?.username?.[0] ?? 'U').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{user?.role}</Badge>
            {user?.familyRole && <Badge variant="secondary">{ROLE_MAP[user.familyRole] ?? user.familyRole}</Badge>}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Family */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Rodzina</CardTitle>
            <CardDescription>{family?.name ?? 'Brak rodziny'}</CardDescription>
          </div>
          {family && (
            <Dialog open={showInvite} onOpenChange={setShowInvite}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Dodaj członka</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Zaproś członka rodziny</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Email użytkownika</Label><Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ email: e.target.value })} placeholder="email@przyklad.pl" /></div>
                  <Button className="w-full" onClick={handleInvite}>Zaproś</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak członków rodziny</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-md border">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {(m.user?.firstName?.[0] ?? m.user?.username?.[0] ?? '?').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{m.user?.firstName ?? m.user?.username ?? 'Użytkownik'} {m.user?.lastName ?? ''}</p>
                      <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{ROLE_MAP[m.role] ?? m.role}</Badge>
                    {m.role !== 'OWNER' && m.user?.id !== user?.id && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveMember(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Financio v1.0.0 MVP</p>
        </CardContent>
      </Card>
    </div>
  );
}

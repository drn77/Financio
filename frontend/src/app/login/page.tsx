'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { TextInput } from '@/components/TextInput';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Resources } from './resources';
import { validateLoginForm } from './utils';
import type { ILoginFormState, ILoginFormErrors } from './model';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const [formState, setFormState] = useState<ILoginFormState>({
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState<ILoginFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUsernameChange = (value: string) => {
    setFormState((prev) => ({ ...prev, username: value }));

    if (errors.username) {
      setErrors((prev) => ({ ...prev, username: undefined }));
    }
  };

  const handlePasswordChange = (value: string) => {
    setFormState((prev) => ({ ...prev, password: value }));

    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = validateLoginForm(formState);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      return;
    }

    setIsSubmitting(true);

    try {
      await login({ username: formState.username, password: formState.password });
      router.push('/');
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left decorative panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.72_0.19_155/0.15),transparent_60%)]" />
        <div className="relative z-10 px-12 max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
              F
            </div>
            <span className="text-3xl font-bold text-foreground">Financio</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Zarządzaj swoimi finansami z łatwością
          </h2>
          <p className="text-muted-foreground">
            Śledzenie wydatków, rachunki, oszczędności — wszystko w jednym miejscu dla Ciebie i Twojej rodziny.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
              F
            </div>
            <span className="text-2xl font-bold text-foreground">Financio</span>
          </div>

          <Card className="border-0 shadow-none sm:border sm:shadow-sm">
            <CardHeader className="px-0 sm:px-6">
              <CardTitle className="text-2xl">{Resources.title}</CardTitle>
              <CardDescription>{Resources.subtitle}</CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="flex flex-col gap-4 px-0 sm:px-6">
                {errors.general && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {errors.general}
                  </div>
                )}

                <TextInput
                  label={Resources.usernameLabel}
                  placeholder={Resources.usernamePlaceholder}
                  value={formState.username}
                  onChange={handleUsernameChange}
                  error={errors.username}
                  required
                  autoComplete="username"
                />

                <PasswordInput
                  label={Resources.passwordLabel}
                  placeholder={Resources.passwordPlaceholder}
                  value={formState.password}
                  onChange={handlePasswordChange}
                  error={errors.password}
                  required
                  autoComplete="current-password"
                />
              </CardContent>

              <CardFooter className="flex flex-col gap-4 pt-4 px-0 sm:px-6">
                <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={isSubmitting}>
                  {isSubmitting ? Resources.loadingButton : Resources.submitButton}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  {Resources.noAccount}{' '}
                  <Link href="/register" className="text-primary font-medium underline-offset-4 hover:underline">
                    {Resources.registerLink}
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

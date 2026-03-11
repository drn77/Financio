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
import { validateRegisterForm } from './utils';
import type { IRegisterFormState, IRegisterFormErrors } from './model';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const [formState, setFormState] = useState<IRegisterFormState>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [errors, setErrors] = useState<IRegisterFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof IRegisterFormState) => (value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = validateRegisterForm(formState);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        username: formState.username,
        email: formState.email,
        password: formState.password,
        firstName: formState.firstName || undefined,
        lastName: formState.lastName || undefined,
      });

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
            Dołącz do Financio
          </h2>
          <p className="text-muted-foreground">
            Utwórz konto i zacznij kontrolować swoje finanse — budżety, rachunki, oszczędności w jednym miejscu.
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    label={Resources.firstNameLabel}
                    placeholder={Resources.firstNamePlaceholder}
                    value={formState.firstName}
                    onChange={handleChange('firstName')}
                    error={errors.firstName}
                    autoComplete="given-name"
                  />

                  <TextInput
                    label={Resources.lastNameLabel}
                    placeholder={Resources.lastNamePlaceholder}
                    value={formState.lastName}
                    onChange={handleChange('lastName')}
                    error={errors.lastName}
                    autoComplete="family-name"
                  />
                </div>

                <TextInput
                  label={Resources.usernameLabel}
                  placeholder={Resources.usernamePlaceholder}
                  value={formState.username}
                  onChange={handleChange('username')}
                  error={errors.username}
                  required
                  autoComplete="username"
                />

                <TextInput
                  label={Resources.emailLabel}
                  type="email"
                  placeholder={Resources.emailPlaceholder}
                  value={formState.email}
                  onChange={handleChange('email')}
                  error={errors.email}
                  required
                  autoComplete="email"
                />

                <PasswordInput
                  label={Resources.passwordLabel}
                  placeholder={Resources.passwordPlaceholder}
                  value={formState.password}
                  onChange={handleChange('password')}
                  error={errors.password}
                  required
                  autoComplete="new-password"
                />

                <PasswordInput
                  label={Resources.confirmPasswordLabel}
                  placeholder={Resources.confirmPasswordPlaceholder}
                  value={formState.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  error={errors.confirmPassword}
                  required
                  autoComplete="new-password"
                />
              </CardContent>

              <CardFooter className="flex flex-col gap-4 pt-4 px-0 sm:px-6">
                <Button type="submit" className="w-full h-10 text-sm font-semibold" disabled={isSubmitting}>
                  {isSubmitting ? Resources.loadingButton : Resources.submitButton}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  {Resources.hasAccount}{' '}
                  <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
                    {Resources.loginLink}
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

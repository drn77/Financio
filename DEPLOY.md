# Financio – Deployment Guide

## Architektura

| Warstwa       | Hosting           | Darmowy plan                     |
| ------------- | ----------------- | -------------------------------- |
| Frontend      | **Vercel**        | Unlimited (hobby)                |
| Backend API   | **Fly.io**        | 3 shared VMs, 256 MB RAM        |
| Baza danych   | **Neon Postgres** | 0.5 GB storage, autosuspend     |

---

## 1. Baza danych – Neon PostgreSQL (darmowe)

1. Załóż konto na [neon.tech](https://neon.tech) (bez karty kredytowej).
2. Utwórz nowy projekt (region: **EU – Frankfurt** lub **EU – Amsterdam**).
3. Skopiuj **connection string** — format:
   ```
   postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Ten connection string będzie użyty jako `DATABASE_URL` w backendzie.

---

## 2. Backend – Fly.io

### Instalacja CLI

```bash
# Windows (PowerShell)
irm https://fly.io/install.ps1 | iex

# macOS / Linux
curl -L https://fly.io/install.sh | sh
```

### Logowanie i deploy

```bash
fly auth login

# Z katalogu głównego projektu (gdzie jest fly.toml)
cd E:\Aplikacje\Financio

# Utwórz aplikację (pierwszy raz)
fly launch --no-deploy

# Ustaw sekrety (zmienne środowiskowe)
fly secrets set DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
fly secrets set SESSION_SECRET="wygeneruj-losowy-string-min-32-znaki"
fly secrets set FRONTEND_URL="https://financio.vercel.app"
fly secrets set BACKEND_PORT="8080"

# Deploy
fly deploy
```

Po deployu backend będzie dostępny pod adresem: `https://financio-api.fly.dev`

### Uruchom migrację bazy (automatyczne)

Migracja uruchamia się automatycznie przy starcie kontenera (`prisma migrate deploy`).

Aby zasilić bazę seed'em:
```bash
fly ssh console
npx prisma db seed
```

---

## 3. Frontend – Vercel

### Opcja A: Przez dashboard (najprościej)

1. Wejdź na [vercel.com](https://vercel.com) i zaloguj się kontem GitHub.
2. **Import** repozytorium.
3. Ustaw konfigurację:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
4. Dodaj zmienne środowiskowe (**Settings → Environment Variables**):
   ```
   NEXT_PUBLIC_API_URL = https://financio-api.fly.dev
   ```
5. Deploy.

### Opcja B: Przez CLI

```bash
npm i -g vercel
cd frontend
vercel

# Ustaw zmienną
vercel env add NEXT_PUBLIC_API_URL
# Wpisz: https://financio-api.fly.dev
```

---

## 4. Aktualizacja CORS w backendzie

Po deployu upewnij się, że `FRONTEND_URL` zawiera adres Vercel:

```bash
fly secrets set FRONTEND_URL="https://financio.vercel.app"
```

---

## 5. PWA – Instalacja na Androidzie

Aplikacja jest skonfigurowana jako **Progressive Web App**. Po wejściu na stronę w Chrome na Androidzie:

1. Chrome automatycznie pokaże baner "Dodaj do ekranu głównego"  
   *(lub kliknij przycisk "Zainstaluj" który pojawia się w aplikacji)*
2. Aplikacja pojawi się na ekranie jak normalna apka
3. Otwiera się w trybie standalone (bez paska przeglądarki)

---

## Zmienne środowiskowe — podsumowanie

### Backend (Fly.io secrets)

| Zmienna          | Wartość                                        |
| ---------------- | ---------------------------------------------- |
| `DATABASE_URL`   | Connection string z Neon                       |
| `SESSION_SECRET` | Losowy string (min. 32 znaki)                  |
| `FRONTEND_URL`   | `https://twoja-apka.vercel.app`                |
| `BACKEND_PORT`   | `8080`                                         |
| `NODE_ENV`       | `production` (ustawione w fly.toml)            |

### Frontend (Vercel env vars)

| Zmienna               | Wartość                            |
| --------------------- | ---------------------------------- |
| `NEXT_PUBLIC_API_URL` | `https://financio-api.fly.dev`     |

---

## Lokalne developerskie uruchomienie (bez zmian)

```bash
# Baza lokalna
docker compose up -d

# Backend
cd backend && npm run start:dev

# Frontend
cd frontend && pnpm dev
```

Domyślnie frontend używa pustego `NEXT_PUBLIC_API_URL` (= relative `/api/*` na localhost),
a `next.config.ts` automatycznie proxuje requesty do `http://localhost:6001`.

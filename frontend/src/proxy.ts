import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/split'];

export function proxy(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;

  if (pathname.includes('.')) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('financio.sid');

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image).*)',
  ],
};
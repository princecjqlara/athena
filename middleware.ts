import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
    '/login',
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/session',
    '/api/webhook/facebook', // Webhook must be public
    '/api/webhook/status',
];

// Routes that require specific roles
const ROLE_ROUTES: Record<string, string[]> = {
    '/admin': ['admin', 'organizer'],
    '/organizer': ['organizer'],
    '/client': ['client'],
};

// API routes that require specific roles
const API_ROLE_ROUTES: Record<string, string[]> = {
    '/api/admin': ['admin', 'organizer'],
    '/api/organizer': ['organizer'],
};

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public routes
    if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Allow static files and Next.js internals
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.') // Files with extensions
    ) {
        return NextResponse.next();
    }

    // Check for Supabase configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        // Supabase not configured - allow access (dev mode)
        console.log('[Middleware] Supabase not configured, allowing access');
        return NextResponse.next();
    }

    // Get session from cookie
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    // Try to get session from auth header or cookie
    const authHeader = request.headers.get('authorization');
    let session = null;

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
            session = { user };
        }
    }

    // If no session from header, try to get from Supabase session cookie
    const sbAccessToken = request.cookies.get('sb-access-token')?.value;
    const sbRefreshToken = request.cookies.get('sb-refresh-token')?.value;

    if (!session && sbAccessToken) {
        const { data: { user } } = await supabase.auth.getUser(sbAccessToken);
        if (user) {
            session = { user };
        }
    }

    // No session - redirect to login (for page routes only)
    if (!session) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Get user profile for role checking
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, status, org_id')
        .eq('id', session.user.id)
        .single();

    // Check if user is active
    if (profile && profile.status !== 'active') {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: `Account is ${profile.status}` },
                { status: 403 }
            );
        }

        // Redirect to login with message
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('status', profile.status);
        return NextResponse.redirect(loginUrl);
    }

    // Check role-based route access
    for (const [route, allowedRoles] of Object.entries(ROLE_ROUTES)) {
        if (pathname.startsWith(route)) {
            if (!profile || !allowedRoles.includes(profile.role)) {
                // Redirect to appropriate default page
                const redirectUrl = getDefaultRoute(profile?.role || 'marketer');
                return NextResponse.redirect(new URL(redirectUrl, request.url));
            }
        }
    }

    // Check role-based API access
    for (const [route, allowedRoles] of Object.entries(API_ROLE_ROUTES)) {
        if (pathname.startsWith(route)) {
            if (!profile || !allowedRoles.includes(profile.role)) {
                return NextResponse.json(
                    { error: 'Insufficient permissions' },
                    { status: 403 }
                );
            }
        }
    }

    // Add user info to headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', session.user.id);
    response.headers.set('x-user-role', profile?.role || 'marketer');
    response.headers.set('x-user-org', profile?.org_id || '');

    return response;
}

function getDefaultRoute(role: string): string {
    switch (role) {
        case 'client':
            return '/pipeline';
        case 'admin':
            return '/admin';
        case 'organizer':
            return '/organizer';
        default:
            return '/';
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};

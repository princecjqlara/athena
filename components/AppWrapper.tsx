'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from "@/components/Sidebar";
import ChatBot from "@/components/ChatBot";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BackgroundSyncProvider } from "@/components/BackgroundSyncProvider";
import { useEffect, useState, useRef } from 'react';

// Routes that should not show sidebar
const NO_SIDEBAR_ROUTES = ['/login'];

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login'];

// Page transition wrapper to prevent flash
function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [displayChildren, setDisplayChildren] = useState(children);
    const previousPathname = useRef(pathname);

    useEffect(() => {
        // If pathname changed, start transition
        if (previousPathname.current !== pathname) {
            setIsTransitioning(true);

            // Show loader then update content
            const timer = setTimeout(() => {
                setDisplayChildren(children);
                setIsTransitioning(false);
            }, 150);

            previousPathname.current = pathname;
            return () => clearTimeout(timer);
        } else {
            // Same path, just update children
            setDisplayChildren(children);
        }
    }, [pathname, children]);

    if (isTransitioning) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '50vh',
                gap: '1rem',
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid var(--border-primary)',
                    borderTop: '3px solid var(--primary, #c8f560)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style jsx>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div
            style={{
                animation: 'fadeIn 150ms ease-out',
                minHeight: '100%',
            }}
        >
            {displayChildren}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}

// Auth checking wrapper component
function AuthGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // Skip auth check for public routes
        if (PUBLIC_ROUTES.some(route => pathname?.startsWith(route))) {
            setIsChecking(false);
            setIsAuthenticated(true);
            return;
        }

        checkAuth();
    }, [pathname]);

    const checkAuth = async () => {
        setIsChecking(true);

        // Quick check: localStorage fallback
        const localUserId = localStorage.getItem('athena_user_id');
        const localRole = localStorage.getItem('athena_user_role');

        if (!localUserId) {
            // No local session, redirect to login
            router.push('/login');
            return;
        }

        // Validate session with server
        try {
            const res = await fetch('/api/auth/session');
            const data = await res.json();

            if (data.user && data.user.profile?.status === 'active') {
                setIsAuthenticated(true);
            } else if (localUserId && localRole) {
                // Server couldn't validate but we have local session
                // Allow access but may need re-auth later
                setIsAuthenticated(true);
            } else {
                // No valid session
                router.push('/login');
                return;
            }
        } catch (error) {
            // API error - fall back to localStorage check
            if (localUserId) {
                setIsAuthenticated(true);
            } else {
                router.push('/login');
                return;
            }
        }

        setIsChecking(false);
    };

    if (isChecking) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: 'var(--bg-primary)',
                gap: '1.5rem',
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    border: '3px solid var(--border-primary)',
                    borderTop: '3px solid var(--primary, #c8f560)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    Checking authentication...
                </p>
                <style jsx>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null; // Will redirect
    }

    return <>{children}</>;
}

export function AppWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const showSidebar = !NO_SIDEBAR_ROUTES.some(route => pathname?.startsWith(route));
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

    if (!showSidebar) {
        // Full-screen layout without sidebar (login page)
        return (
            <ThemeProvider>
                <ToastProvider>
                    <ErrorBoundary>
                        <PageTransition>{children}</PageTransition>
                    </ErrorBoundary>
                </ToastProvider>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            <ToastProvider>
                <ErrorBoundary>
                    <AuthGuard>
                        <BackgroundSyncProvider>
                            <div className="app-wrapper">
                                <Sidebar />
                                <main className="main-content">
                                    <PageTransition>{children}</PageTransition>
                                </main>
                                <ChatBot />
                            </div>
                        </BackgroundSyncProvider>
                    </AuthGuard>
                </ErrorBoundary>
            </ToastProvider>
        </ThemeProvider>
    );
}


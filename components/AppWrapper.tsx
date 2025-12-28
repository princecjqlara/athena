'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from "@/components/Sidebar";
import ChatBot from "@/components/ChatBot";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, useState, useRef } from 'react';

// Routes that should not show sidebar
const NO_SIDEBAR_ROUTES = ['/login'];

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

            // Quick fade out then update content
            const timer = setTimeout(() => {
                setDisplayChildren(children);
                setIsTransitioning(false);
            }, 100);

            previousPathname.current = pathname;
            return () => clearTimeout(timer);
        } else {
            // Same path, just update children
            setDisplayChildren(children);
        }
    }, [pathname, children]);

    return (
        <div
            className={`page-transition ${isTransitioning ? 'transitioning' : ''}`}
            style={{
                opacity: isTransitioning ? 0 : 1,
                transition: 'opacity 100ms ease-in-out',
                minHeight: '100%',
            }}
        >
            {displayChildren}
        </div>
    );
}

export function AppWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const showSidebar = !NO_SIDEBAR_ROUTES.some(route => pathname?.startsWith(route));

    if (!showSidebar) {
        // Full-screen layout without sidebar
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
                    <div className="app-wrapper">
                        <Sidebar />
                        <main className="main-content">
                            <PageTransition>{children}</PageTransition>
                        </main>
                        <ChatBot />
                    </div>
                </ErrorBoundary>
            </ToastProvider>
        </ThemeProvider>
    );
}


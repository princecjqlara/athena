'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from "@/components/Sidebar";
import ChatBot from "@/components/ChatBot";
import ErrorBoundary from "@/components/ErrorBoundary";

// Routes that should not show sidebar
const NO_SIDEBAR_ROUTES = ['/login'];

export function AppWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const showSidebar = !NO_SIDEBAR_ROUTES.some(route => pathname?.startsWith(route));

    if (!showSidebar) {
        // Full-screen layout without sidebar
        return <ErrorBoundary>{children}</ErrorBoundary>;
    }

    return (
        <ErrorBoundary>
            <div className="app-wrapper">
                <Sidebar />
                <main className="main-content">
                    {children}
                </main>
                <ChatBot />
            </div>
        </ErrorBoundary>
    );
}

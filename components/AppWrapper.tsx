'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from "@/components/Sidebar";
import ChatBot from "@/components/ChatBot";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";

// Routes that should not show sidebar
const NO_SIDEBAR_ROUTES = ['/login'];

export function AppWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const showSidebar = !NO_SIDEBAR_ROUTES.some(route => pathname?.startsWith(route));

    if (!showSidebar) {
        // Full-screen layout without sidebar
        return (
            <ToastProvider>
                <ErrorBoundary>{children}</ErrorBoundary>
            </ToastProvider>
        );
    }

    return (
        <ToastProvider>
            <ErrorBoundary>
                <div className="app-wrapper">
                    <Sidebar />
                    <main className="main-content">
                        {children}
                    </main>
                    <ChatBot />
                </div>
            </ErrorBoundary>
        </ToastProvider>
    );
}

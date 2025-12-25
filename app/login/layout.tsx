import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Login - Athena",
    description: "Sign in to your Athena advertising intelligence platform",
};

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="login-layout">
            {children}
        </div>
    );
}

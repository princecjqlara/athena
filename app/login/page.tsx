'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './login.css';

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // Check if already logged in
    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const res = await fetch('/api/auth/session');
            const data = await res.json();

            if (data.user) {
                // Redirect based on role
                const role = data.user.profile?.role || 'marketer';
                redirectToRoleHome(role);
            }
        } catch (err) {
            // Not logged in, stay on login page
        }
    };

    const redirectToRoleHome = (role: string) => {
        switch (role) {
            case 'client':
                router.push('/pipeline');
                break;
            case 'admin':
                router.push('/admin');
                break;
            case 'organizer':
                router.push('/organizer');
                break;
            default:
                router.push('/');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
            const body = mode === 'login'
                ? { email, password }
                : { email, password, fullName };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            if (mode === 'signup') {
                setMessage('Account created! Please check your email to verify.');
                setMode('login');
            } else {
                // Login successful - check status and redirect
                if (data.user?.profile?.status === 'pending') {
                    setMessage('Your account is pending approval. Please wait for an admin to activate it.');
                } else if (data.user?.profile?.status === 'suspended') {
                    setError('Your account has been suspended. Contact support.');
                } else {
                    redirectToRoleHome(data.user?.profile?.role || 'marketer');
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <div className="login-logo">
                        <span className="logo-icon">🏛️</span>
                        <span className="logo-text">Athena</span>
                    </div>
                    <h1>{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
                    <p className="login-subtitle">
                        {mode === 'login'
                            ? 'Sign in to your advertising intelligence platform'
                            : 'Start optimizing your ad performance with AI'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && <div className="login-error">{error}</div>}
                    {message && <div className="login-message">{message}</div>}

                    {mode === 'signup' && (
                        <div className="form-group">
                            <label htmlFor="fullName">Full Name</label>
                            <input
                                id="fullName"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="John Smith"
                                required={mode === 'signup'}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                </form>

                <div className="login-footer">
                    {mode === 'login' ? (
                        <p>
                            Don't have an account?{' '}
                            <button onClick={() => setMode('signup')} className="link-button">
                                Sign up
                            </button>
                        </p>
                    ) : (
                        <p>
                            Already have an account?{' '}
                            <button onClick={() => setMode('login')} className="link-button">
                                Sign in
                            </button>
                        </p>
                    )}
                </div>

                <div className="login-divider">
                    <span>Powered by AI</span>
                </div>

                <ul className="login-features">
                    <li>🎯 Pre-spend creative prediction</li>
                    <li>🧠 80+ feature extraction</li>
                    <li>📊 Real-time analytics</li>
                    <li>🔒 Privacy-first design</li>
                </ul>
            </div>
        </div>
    );
}

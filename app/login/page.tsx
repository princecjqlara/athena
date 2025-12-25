'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './login.css';

type SignupRole = 'client' | 'marketer' | 'admin';

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [signupRole, setSignupRole] = useState<SignupRole | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
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

            if (data.user && data.user.profile?.status === 'active') {
                redirectToRoleHome(data.user.profile.role);
            }
        } catch (err) {
            // Not logged in
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
            if (mode === 'signup') {
                // Validate invite code first
                const validateRes = await fetch('/api/auth/validate-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: inviteCode, role: signupRole }),
                });

                const validateData = await validateRes.json();
                if (!validateRes.ok) {
                    throw new Error(validateData.error || 'Invalid invite code');
                }

                // If valid, proceed with signup
                const signupRes = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        password,
                        fullName,
                        role: signupRole,
                        inviteCode,
                    }),
                });

                const signupData = await signupRes.json();
                if (!signupRes.ok) {
                    throw new Error(signupData.error || 'Signup failed');
                }

                setMessage('Account created! Please check your email to verify.');
                setMode('login');
                setSignupRole(null);
            } else {
                // Login
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Login failed');
                }

                if (data.user?.profile?.status === 'pending') {
                    setMessage('Your account is pending approval.');
                } else if (data.user?.profile?.status === 'suspended') {
                    setError('Your account has been suspended.');
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

    const getRoleDescription = (role: SignupRole) => {
        switch (role) {
            case 'client':
                return 'View assigned pipelines and analytics. Get code from your Marketer.';
            case 'marketer':
                return 'Full access to ads, predictions, and pipelines. Get code from Admin.';
            case 'admin':
                return 'Manage your organization and team members. Get code from Organizer.';
        }
    };

    const getRoleIcon = (role: SignupRole) => {
        switch (role) {
            case 'client': return '👤';
            case 'marketer': return '📊';
            case 'admin': return '🛡️';
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
                    <h1>{mode === 'login' ? 'Welcome back' : signupRole ? `Sign up as ${signupRole}` : 'Create account'}</h1>
                    <p className="login-subtitle">
                        {mode === 'login'
                            ? 'Sign in to your advertising intelligence platform'
                            : signupRole
                                ? getRoleDescription(signupRole)
                                : 'Choose your account type'}
                    </p>
                </div>

                {mode === 'signup' && !signupRole ? (
                    // Role Selection
                    <div className="role-selection">
                        {(['client', 'marketer', 'admin'] as SignupRole[]).map(role => (
                            <button
                                key={role}
                                className="role-option"
                                onClick={() => setSignupRole(role)}
                            >
                                <span className="role-icon">{getRoleIcon(role)}</span>
                                <span className="role-name">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                                <span className="role-desc">{getRoleDescription(role)}</span>
                            </button>
                        ))}
                        <button onClick={() => setMode('login')} className="link-button back-link">
                            ← Back to login
                        </button>
                    </div>
                ) : (
                    // Login/Signup Form
                    <form onSubmit={handleSubmit} className="login-form">
                        {error && <div className="login-error">{error}</div>}
                        {message && <div className="login-message">{message}</div>}

                        {mode === 'signup' && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="fullName">Full Name</label>
                                    <input
                                        id="fullName"
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="John Smith"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="inviteCode">
                                        Invite Code <span className="code-hint">(from {signupRole === 'client' ? 'Marketer' : signupRole === 'marketer' ? 'Admin' : 'Organizer'})</span>
                                    </label>
                                    <input
                                        id="inviteCode"
                                        type="text"
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                        placeholder="XXXXXXXX"
                                        required
                                        maxLength={8}
                                        className="code-input"
                                    />
                                </div>
                            </>
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

                        {mode === 'signup' && signupRole && (
                            <button
                                type="button"
                                onClick={() => setSignupRole(null)}
                                className="link-button"
                            >
                                ← Choose different role
                            </button>
                        )}
                    </form>
                )}

                {(mode === 'login' || signupRole) && (
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
                                <button onClick={() => { setMode('login'); setSignupRole(null); }} className="link-button">
                                    Sign in
                                </button>
                            </p>
                        )}
                    </div>
                )}

                <div className="login-divider">
                    <span>Powered by AI</span>
                </div>

                <ul className="login-features">
                    <li>🎯 Pre-spend prediction</li>
                    <li>🧠 80+ feature extraction</li>
                    <li>📊 Real-time analytics</li>
                    <li>🔒 Privacy-first</li>
                </ul>
            </div>
        </div>
    );
}

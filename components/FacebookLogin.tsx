'use client';

import { useState, useEffect } from 'react';

declare global {
    interface Window {
        FB: any;
        fbAsyncInit: () => void;
    }
}

interface FacebookLoginProps {
    appId: string;
    onSuccess: (response: FacebookAuthResponse) => void;
    onError?: (error: string) => void;
}

interface FacebookAuthResponse {
    accessToken: string;
    userID: string;
    expiresIn: number;
    name?: string;
    email?: string;
    adAccounts?: AdAccount[];
}

interface AdAccount {
    id: string;
    name: string;
    account_id: string;
}

export default function FacebookLogin({ appId, onSuccess, onError }: FacebookLoginProps) {
    const [isSDKLoaded, setIsSDKLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        // Check if already connected
        const savedToken = localStorage.getItem('fb_access_token');
        const savedName = localStorage.getItem('fb_user_name');
        if (savedToken && savedName) {
            setIsConnected(true);
            setUserName(savedName);
        }

        // Load Facebook SDK
        if (window.FB) {
            setIsSDKLoaded(true);
            return;
        }

        window.fbAsyncInit = function () {
            window.FB.init({
                appId: appId,
                cookie: true,
                xfbml: true,
                version: 'v24.0'
            });
            setIsSDKLoaded(true);
        };

        // Load the SDK asynchronously
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);

        return () => {
            const existingScript = document.getElementById('facebook-jssdk');
            if (existingScript) {
                existingScript.remove();
            }
        };
    }, [appId]);

    // Process login response - separated to avoid async callback issue with FB SDK
    const processLoginResponse = (shortLivedToken: string, userID: string, expiresIn: number) => {
        // Exchange short-lived token for long-lived token
        fetch('/api/facebook/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shortLivedToken })
        })
            .then(res => res.json())
            .then(exchangeData => {
                // Use long-lived token if exchange succeeded, otherwise fall back to short-lived
                const accessToken = exchangeData.success
                    ? exchangeData.accessToken
                    : shortLivedToken;

                const tokenExpiresAt = exchangeData.success
                    ? exchangeData.expiresAt
                    : new Date(Date.now() + expiresIn * 1000).toISOString();

                console.log(exchangeData.success
                    ? '✅ Using long-lived token (expires in ~60 days)'
                    : '⚠️ Using short-lived token (exchange failed: ' + (exchangeData.error || 'unknown') + ')');

                // Get user info and ad accounts
                window.FB.api('/me', { fields: 'name,email' }, (userInfo: any) => {
                    window.FB.api('/me/adaccounts', { fields: 'name,account_id' }, (adAccountsResponse: any) => {
                        const authData: FacebookAuthResponse = {
                            accessToken,
                            userID,
                            expiresIn: exchangeData.success ? exchangeData.expiresIn : expiresIn,
                            name: userInfo.name,
                            email: userInfo.email,
                            adAccounts: adAccountsResponse.data || []
                        };

                        // Save to localStorage with token type and expiry info
                        localStorage.setItem('fb_access_token', accessToken);
                        localStorage.setItem('fb_token_type', exchangeData.success ? 'long_lived' : 'short_lived');
                        localStorage.setItem('fb_token_expires_at', tokenExpiresAt);
                        localStorage.setItem('fb_user_id', userID);
                        localStorage.setItem('fb_user_name', userInfo.name || '');
                        localStorage.setItem('fb_ad_accounts', JSON.stringify(adAccountsResponse.data || []));

                        setIsConnected(true);
                        setUserName(userInfo.name);
                        setIsLoading(false);
                        onSuccess(authData);
                    });
                });
            })
            .catch(err => {
                console.error('Token exchange error:', err);
                // Fall back to short-lived token
                window.FB.api('/me', { fields: 'name,email' }, (userInfo: any) => {
                    window.FB.api('/me/adaccounts', { fields: 'name,account_id' }, (adAccountsResponse: any) => {
                        const authData: FacebookAuthResponse = {
                            accessToken: shortLivedToken,
                            userID,
                            expiresIn,
                            name: userInfo.name,
                            email: userInfo.email,
                            adAccounts: adAccountsResponse.data || []
                        };

                        localStorage.setItem('fb_access_token', shortLivedToken);
                        localStorage.setItem('fb_token_type', 'short_lived');
                        localStorage.setItem('fb_user_id', userID);
                        localStorage.setItem('fb_user_name', userInfo.name || '');
                        localStorage.setItem('fb_ad_accounts', JSON.stringify(adAccountsResponse.data || []));

                        setIsConnected(true);
                        setUserName(userInfo.name);
                        setIsLoading(false);
                        onSuccess(authData);
                    });
                });
            });
    };

    const handleLogin = () => {
        if (!isSDKLoaded) {
            onError?.('Facebook SDK not loaded yet');
            return;
        }

        setIsLoading(true);

        window.FB.login((response: any) => {
            if (response.authResponse) {
                const { accessToken, userID, expiresIn } = response.authResponse;
                processLoginResponse(accessToken, userID, expiresIn);
            } else {
                setIsLoading(false);
                onError?.('User cancelled login or did not fully authorize.');
            }
        }, {
            scope: 'ads_read,ads_management,read_insights,pages_read_engagement',
            return_scopes: true
        });
    };

    const handleLogout = () => {
        if (window.FB) {
            window.FB.logout();
        }
        localStorage.removeItem('fb_access_token');
        localStorage.removeItem('fb_user_id');
        localStorage.removeItem('fb_user_name');
        localStorage.removeItem('fb_ad_accounts');
        localStorage.removeItem('meta_ad_account_id');
        localStorage.removeItem('meta_marketing_token');
        setIsConnected(false);
        setUserName(null);
    };

    if (isConnected) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
                <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1877F2, #42B72A)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1.25rem'
                }}>
                    {userName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {userName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                        ✓ Connected to Facebook
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    style={{
                        padding: '8px 16px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                    }}
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleLogin}
            disabled={!isSDKLoaded || isLoading}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                width: '100%',
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #1877F2, #166FE5)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: isSDKLoaded && !isLoading ? 'pointer' : 'not-allowed',
                opacity: isSDKLoaded && !isLoading ? 1 : 0.7,
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 14px rgba(24, 119, 242, 0.4)'
            }}
            onMouseOver={(e) => {
                if (isSDKLoaded && !isLoading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(24, 119, 242, 0.5)';
                }
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(24, 119, 242, 0.4)';
            }}
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Connecting...
                </>
            ) : (
                <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                    {isSDKLoaded ? 'Continue with Facebook' : 'Loading...'}
                </>
            )}
        </button>
    );
}

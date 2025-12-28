'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays a fallback UI
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });

        // You could also log to an error reporting service here
        // logErrorToService(error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)'
                }}>
                    <div style={{
                        maxWidth: '500px',
                        padding: '40px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>
                        <h2 style={{
                            color: '#ef4444',
                            marginBottom: '16px',
                            fontSize: '1.5rem'
                        }}>
                            Something went wrong
                        </h2>
                        <p style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            marginBottom: '24px',
                            lineHeight: 1.6
                        }}>
                            An unexpected error occurred. Your data is safe - try refreshing the page.
                        </p>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    padding: '12px 24px',
                                    background: 'rgba(99, 102, 241, 0.2)',
                                    border: '1px solid rgba(99, 102, 241, 0.4)',
                                    borderRadius: '8px',
                                    color: '#6366F1',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: 500
                                }}
                            >
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    padding: '12px 24px',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    borderRadius: '8px',
                                    color: '#10B981',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: 500
                                }}
                            >
                                Reload Page
                            </button>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details style={{
                                marginTop: '24px',
                                textAlign: 'left',
                                background: 'rgba(0,0,0,0.3)',
                                padding: '16px',
                                borderRadius: '8px'
                            }}>
                                <summary style={{
                                    cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.5)',
                                    marginBottom: '8px'
                                }}>
                                    Error Details (Dev Only)
                                </summary>
                                <pre style={{
                                    fontSize: '0.75rem',
                                    color: '#ef4444',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}>
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

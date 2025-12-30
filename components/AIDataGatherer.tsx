'use client';

import { useState, useRef, useEffect } from 'react';

interface CompiledData {
    targetAudience: {
        demographics: string[];
        interests: string[];
        behaviors: string[];
        painPoints: string[];
    };
    adPreferences: {
        platforms: string[];
        contentTypes: string[];
        tones: string[];
        hooks: string[];
    };
    businessContext: {
        industry: string;
        products: string[];
        uniqueValue: string;
        competitors: string[];
    };
    goals: {
        objectives: string[];
        metrics: string[];
        timeline: string;
    };
}

interface GatheringState {
    phase: 'initial' | 'questioning' | 'complete';
    initialQuery: string;
    currentQuestionIndex: number;
    questions: string[];
    answers: Record<string, string>;
    compiledData: CompiledData | null;
}

interface Message {
    id: string;
    type: 'ai' | 'user' | 'system';
    content: string;
    timestamp: Date;
}

interface AIDataGathererProps {
    onComplete: (data: CompiledData) => void;
    onCancel?: () => void;
    className?: string;
}

export default function AIDataGatherer({
    onComplete,
    onCancel,
    className = ''
}: AIDataGathererProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [gatheringState, setGatheringState] = useState<GatheringState | null>(null);
    const [progress, setProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [compiledData, setCompiledData] = useState<CompiledData | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Add welcome message on mount
    useEffect(() => {
        addMessage('ai', "👋 Hi! I'm here to help you find the perfect ad data for your business. Tell me what you're looking for, like:\n\n• \"Get me data for business owners\"\n• \"Find patterns for Gen Z shoppers\"\n• \"Show me high-performing e-commerce ads\"");
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const addMessage = (type: 'ai' | 'user' | 'system', content: string) => {
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type,
            content,
            timestamp: new Date()
        }]);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userInput = inputValue.trim();
        setInputValue('');
        addMessage('user', userInput);
        setIsLoading(true);

        try {
            if (!gatheringState) {
                // Start new gathering session
                const response = await fetch('/api/ai/gather-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'start',
                        initialQuery: userInput
                    })
                });

                const data = await response.json();

                if (data.success) {
                    setGatheringState(data.state);
                    setProgress(data.progress);
                    addMessage('ai', `Great! I'll ask you a few questions to understand your needs better.\n\n**Question 1/${data.totalQuestions}:**\n${data.currentQuestion}`);
                } else {
                    addMessage('ai', `Sorry, I couldn't process that. ${data.error || 'Please try again.'}`);
                }
            } else {
                // Answer current question
                const response = await fetch('/api/ai/gather-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'answer',
                        currentState: gatheringState,
                        userAnswer: userInput
                    })
                });

                const data = await response.json();

                if (data.success) {
                    setGatheringState(data.state);
                    setProgress(data.progress);

                    if (data.isComplete) {
                        setIsComplete(true);
                        setCompiledData(data.compiledData);
                        addMessage('ai', `✅ **All questions answered!**\n\n${data.summary}\n\nClick "Upload to ML" to integrate this data with your machine learning model for personalized insights.`);
                    } else {
                        addMessage('ai', `**Question ${data.state.currentQuestionIndex + 1}/${data.totalQuestions}:**\n${data.currentQuestion}`);
                    }
                } else {
                    addMessage('ai', `Sorry, something went wrong. ${data.error || 'Please try again.'}`);
                }
            }
        } catch (error) {
            console.error('Gathering error:', error);
            addMessage('ai', 'Sorry, there was an error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = async () => {
        if (!gatheringState || isLoading) return;

        setIsLoading(true);
        addMessage('user', '(Skipped)');

        try {
            const response = await fetch('/api/ai/gather-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'skip',
                    currentState: gatheringState
                })
            });

            const data = await response.json();

            if (data.success) {
                setGatheringState(data.state);
                setProgress(data.progress);

                if (data.isComplete) {
                    setIsComplete(true);
                    setCompiledData(data.compiledData);
                    addMessage('ai', `✅ **Data gathering complete!**\n\n${data.summary}\n\nClick "Upload to ML" to integrate this data.`);
                } else {
                    addMessage('ai', `**Question ${data.state.currentQuestionIndex + 1}/${data.totalQuestions}:**\n${data.currentQuestion}`);
                }
            }
        } catch (error) {
            console.error('Skip error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUploadToML = async () => {
        if (!compiledData) return;

        setIsUploading(true);
        addMessage('system', '🔄 Uploading data to your ML model...');

        try {
            const response = await fetch('/api/ml/integrate-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ compiledData })
            });

            const data = await response.json();

            if (data.success) {
                addMessage('ai', `🎉 **Success!** Your ML model has been updated.\n\n• Weights adjusted: ${data.weightsUpdated || 0}\n• New patterns learned: ${data.patternsLearned || 0}\n• Accuracy boost: +${data.accuracyBoost || 0}%\n\nYour marketplace insights are now personalized!`);
                onComplete(compiledData);
            } else {
                addMessage('ai', `❌ Upload failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            addMessage('ai', '❌ Failed to upload to ML. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleReset = () => {
        setMessages([]);
        setGatheringState(null);
        setProgress(0);
        setIsComplete(false);
        setCompiledData(null);
        addMessage('ai', "👋 Let's start fresh! Tell me what kind of ad data you're looking for.");
    };

    return (
        <div className={`ai-data-gatherer ${className}`} style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: '600px',
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))'
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🤖 AI Data Gatherer
                        {gatheringState && !isComplete && (
                            <span style={{
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                background: 'rgba(99,102,241,0.2)',
                                borderRadius: '12px',
                                color: 'var(--primary)'
                            }}>
                                {progress}% complete
                            </span>
                        )}
                    </h3>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {gatheringState && (
                        <button
                            onClick={handleReset}
                            style={{
                                padding: '6px 12px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                color: 'var(--text-primary)'
                            }}
                        >
                            🔄 Reset
                        </button>
                    )}
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            style={{
                                padding: '6px 12px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                color: 'var(--text-primary)'
                            }}
                        >
                            ✕ Close
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            {gatheringState && !isComplete && (
                <div style={{
                    height: '4px',
                    background: 'var(--bg-tertiary)'
                }}>
                    <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, #6366F1, #A855F7)',
                        transition: 'width 0.3s ease'
                    }}></div>
                </div>
            )}

            {/* Messages */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                {messages.map(message => (
                    <div
                        key={message.id}
                        style={{
                            display: 'flex',
                            justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
                        }}
                    >
                        <div style={{
                            maxWidth: '80%',
                            padding: '12px 16px',
                            borderRadius: message.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: message.type === 'user'
                                ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                                : message.type === 'system'
                                    ? 'rgba(245,158,11,0.2)'
                                    : 'var(--bg-tertiary)',
                            color: message.type === 'user' ? 'white' : 'var(--text-primary)',
                            whiteSpace: 'pre-wrap',
                            fontSize: '0.9rem',
                            lineHeight: 1.5
                        }}>
                            {message.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '16px 16px 16px 4px',
                            background: 'var(--bg-tertiary)',
                            display: 'flex',
                            gap: '4px'
                        }}>
                            <span className="dot-animation">●</span>
                            <span className="dot-animation" style={{ animationDelay: '0.2s' }}>●</span>
                            <span className="dot-animation" style={{ animationDelay: '0.4s' }}>●</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{
                padding: '16px',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-primary)'
            }}>
                {isComplete && compiledData ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleUploadToML}
                            disabled={isUploading}
                            style={{
                                flex: 1,
                                padding: '12px',
                                background: isUploading
                                    ? 'var(--bg-tertiary)'
                                    : 'linear-gradient(135deg, #22C55E, #10B981)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                cursor: isUploading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            {isUploading ? (
                                <>
                                    <span className="spinner-small"></span>
                                    Uploading...
                                </>
                            ) : (
                                <>🚀 Upload to ML</>
                            )}
                        </button>
                        <button
                            onClick={() => onComplete(compiledData)}
                            style={{
                                padding: '12px 20px',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                fontSize: '0.95rem',
                                cursor: 'pointer'
                            }}
                        >
                            Skip
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            placeholder={gatheringState ? "Type your answer..." : "Describe the data you need..."}
                            disabled={isLoading}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                        />
                        {gatheringState && !isComplete && (
                            <button
                                type="button"
                                onClick={handleSkip}
                                disabled={isLoading}
                                style={{
                                    padding: '12px 16px',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                Skip
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isLoading || !inputValue.trim()}
                            style={{
                                padding: '12px 20px',
                                background: inputValue.trim() && !isLoading
                                    ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                                    : 'var(--bg-tertiary)',
                                color: inputValue.trim() && !isLoading ? 'white' : 'var(--text-muted)',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                fontWeight: 600
                            }}
                        >
                            Send
                        </button>
                    </form>
                )}
            </div>

            <style jsx>{`
                .dot-animation {
                    animation: dotPulse 1s infinite;
                    color: var(--text-muted);
                }
                @keyframes dotPulse {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 1; }
                }
                .spinner-small {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

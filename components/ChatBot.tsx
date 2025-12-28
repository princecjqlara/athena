'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './ChatBot.module.css';
import { parseAIResponse, executeAction, ActionResult, ActionName } from '@/lib/athena-agent';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    actionResult?: ActionResult;
}

interface ChatBotProps {
    onClose?: () => void;
}

export default function ChatBot({ onClose }: ChatBotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([{
        id: 'welcome',
        role: 'assistant',
        content: "Hi! I'm Athena AI 🧠 I can analyze your ads, show patterns, and even **execute tasks** for you! Try saying 'Import my ads' or 'Show me patterns'.",
        timestamp: new Date()
    }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ action: ActionName; params: Record<string, unknown> } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Get all data context for AI
    const getDataContext = () => {
        const ads = JSON.parse(localStorage.getItem('ads') || '[]');

        // Summarize data for context
        const summary = {
            totalAds: ads.length,
            platforms: {} as Record<string, number>,
            hookTypes: {} as Record<string, number>,
            avgPredictedScore: 0,
            avgActualScore: 0,
            adsWithResults: 0,
            topTraits: [] as string[],
            recentAds: ads.slice(-5).map((a: any) => ({
                title: a.extractedContent?.title,
                platform: a.extractedContent?.platform,
                hookType: a.extractedContent?.hookType,
                predicted: a.predictedScore,
                actual: a.successScore
            }))
        };

        let totalPredicted = 0, totalActual = 0;
        ads.forEach((ad: any) => {
            const content = ad.extractedContent || {};

            // Platform stats
            if (content.platform) {
                summary.platforms[content.platform] = (summary.platforms[content.platform] || 0) + 1;
            }

            // Hook type stats
            if (content.hookType) {
                summary.hookTypes[content.hookType] = (summary.hookTypes[content.hookType] || 0) + 1;
            }

            // Score averages
            if (ad.predictedScore) totalPredicted += ad.predictedScore;
            if (ad.successScore) {
                totalActual += ad.successScore;
                summary.adsWithResults++;
            }
        });

        if (ads.length > 0) {
            summary.avgPredictedScore = Math.round(totalPredicted / ads.length);
        }
        if (summary.adsWithResults > 0) {
            summary.avgActualScore = Math.round(totalActual / summary.adsWithResults);
        }

        return summary;
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const dataContext = getDataContext();

            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat',
                    data: {
                        message: userMessage.content,
                        context: dataContext,
                        history: messages.slice(-10).map(m => ({
                            role: m.role,
                            content: m.content
                        }))
                    }
                })
            });

            const result = await response.json();

            if (result.success && result.data?.response) {
                // Parse AI response for action commands
                const parsed = parseAIResponse(result.data.response);

                if (parsed.action) {
                    // AI wants to execute an action!
                    const assistantMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: parsed.message || `Executing ${parsed.action}...`,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, assistantMessage]);

                    // Execute the action
                    const actionResult = await executeAction(parsed.action, parsed.params);

                    // Add action result message
                    const resultMessage: Message = {
                        id: (Date.now() + 2).toString(),
                        role: 'system',
                        content: actionResult.message,
                        timestamp: new Date(),
                        actionResult
                    };
                    setMessages(prev => [...prev, resultMessage]);
                } else {
                    // Regular response
                    const assistantMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: parsed.message,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                }
            } else {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "I'm having trouble analyzing right now. Please try again!",
                    timestamp: new Date()
                }]);
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date()
            }]);
        }

        setIsLoading(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Quick prompts for users
    const quickPrompts = [
        "What hook types work best?",
        "Analyze my top performing ads",
        "What should I create next?",
        "Why are my ads underperforming?"
    ];

    if (!isOpen) {
        return (
            <button
                className={styles.floatingButton}
                onClick={() => setIsOpen(true)}
                title="Chat with Athena AI"
            >
                <span className={styles.buttonIcon}>🧠</span>
                <span className={styles.buttonPulse}></span>
            </button>
        );
    }

    return (
        <div className={styles.chatContainer}>
            {/* Header */}
            <div className={styles.chatHeader}>
                <div className={styles.headerInfo}>
                    <span className={styles.headerIcon}>🧠</span>
                    <div>
                        <h3>Athena AI</h3>
                        <span className={styles.headerStatus}>● Online</span>
                    </div>
                </div>
                <button className={styles.closeButton} onClick={() => setIsOpen(false)}>×</button>
            </div>

            {/* Messages */}
            <div className={styles.messagesContainer}>
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`${styles.message} ${message.role === 'user'
                                ? styles.userMessage
                                : message.role === 'system'
                                    ? styles.systemMessage
                                    : styles.assistantMessage
                            }`}
                    >
                        {message.role === 'assistant' && (
                            <span className={styles.messageIcon}>🧠</span>
                        )}
                        {message.role === 'system' && (
                            <span className={styles.messageIcon}>{message.actionResult?.success ? '✅' : '⚠️'}</span>
                        )}
                        <div className={styles.messageContent}>
                            {message.content.split('\n').map((line, i) => (
                                <span key={i}>{line}<br /></span>
                            ))}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className={`${styles.message} ${styles.assistantMessage}`}>
                        <span className={styles.messageIcon}>🧠</span>
                        <div className={styles.messageContent}>
                            <span className={styles.typingIndicator}>
                                <span></span><span></span><span></span>
                            </span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts (show if few messages) */}
            {messages.length <= 2 && (
                <div className={styles.quickPrompts}>
                    {quickPrompts.map((prompt, i) => (
                        <button
                            key={i}
                            className={styles.quickPrompt}
                            onClick={() => setInput(prompt)}
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className={styles.inputContainer}>
                <textarea
                    className={styles.input}
                    placeholder="Ask about your ads..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    rows={1}
                    disabled={isLoading}
                />
                <button
                    className={styles.sendButton}
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

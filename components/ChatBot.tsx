'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './ChatBot.module.css';
import { parseAIResponse, executeAction, ActionResult, ActionName } from '@/lib/athena-agent';
import { useChatHistory, Message, ChatSession, SearchResult } from '@/hooks/useChatHistory';

interface ChatBotProps {
    onClose?: () => void;
}

export default function ChatBot({ onClose }: ChatBotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState('');
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Use chat history hook for persistence
    const {
        sessions,
        archivedSessions,
        currentSessionId,
        isLoadingSessions,
        createNewSession,
        loadSession,
        deleteSession,
        renameSession,
        pinSession,
        unpinSession,
        archiveSession,
        unarchiveSession,
        messages,
        isLoadingMessages,
        addMessage,
        clearCurrentSession,
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        searchMessages,
        clearSearch,
        resetContext,
        refreshSessions,
        showArchived,
        setShowArchived
    } = useChatHistory();

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus search input when search panel opens
    useEffect(() => {
        if (showSearch && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [showSearch]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearchQuery.trim()) {
                searchMessages(localSearchQuery);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearchQuery, searchMessages]);

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

        // Add user message via hook (persists to database)
        await addMessage(userMessage);
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
                    await addMessage(assistantMessage);

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
                    await addMessage(resultMessage);
                } else {
                    // Regular response
                    const assistantMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: parsed.message,
                        timestamp: new Date()
                    };
                    await addMessage(assistantMessage);
                }
            } else {
                const errorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "I'm having trouble analyzing right now. Please try again!",
                    timestamp: new Date()
                };
                await addMessage(errorMessage);
            }
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date()
            };
            await addMessage(errorMessage);
        }

        setIsLoading(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleNewChat = async () => {
        await createNewSession();
        setShowHistory(false);
        setShowSearch(false);
    };

    const handleClearChat = async () => {
        if (confirm('Clear all messages in this conversation?')) {
            await clearCurrentSession();
        }
    };

    const handleResetContext = async () => {
        if (confirm('Start a new conversation? This will reset the context and begin a fresh session.')) {
            await resetContext();
            setShowSettings(false);
        }
    };

    const handleLoadSession = async (sessionId: string) => {
        await loadSession(sessionId);
        setShowHistory(false);
        setShowSearch(false);
        clearSearch();
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (confirm('Delete this conversation permanently?')) {
            await deleteSession(sessionId);
        }
    };

    const handlePinSession = async (e: React.MouseEvent, session: ChatSession) => {
        e.stopPropagation();
        if (session.is_pinned) {
            await unpinSession(session.id);
        } else {
            await pinSession(session.id);
        }
    };

    const handleArchiveSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        await archiveSession(sessionId);
    };

    const handleUnarchiveSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        await unarchiveSession(sessionId);
    };

    const handleStartRename = (e: React.MouseEvent, session: ChatSession) => {
        e.stopPropagation();
        setEditingSessionId(session.id);
        setEditingTitle(session.title || '');
    };

    const handleSaveRename = async () => {
        if (editingSessionId && editingTitle.trim()) {
            await renameSession(editingSessionId, editingTitle.trim());
        }
        setEditingSessionId(null);
        setEditingTitle('');
    };

    const handleCancelRename = () => {
        setEditingSessionId(null);
        setEditingTitle('');
    };

    const handleSearchResultClick = async (result: SearchResult) => {
        await loadSession(result.session_id);
        setShowSearch(false);
        clearSearch();
        setLocalSearchQuery('');
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const highlightMatch = (text: string, query: string) => {
        if (!query.trim()) return text;
        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === query.toLowerCase()
                ? <mark key={i} className={styles.searchHighlight}>{part}</mark>
                : part
        );
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

    const displaySessions = showArchived ? archivedSessions : sessions;

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
                <div className={styles.headerActions}>
                    <button
                        className={`${styles.headerButton} ${showSearch ? styles.headerButtonActive : ''}`}
                        onClick={() => { setShowSearch(!showSearch); setShowHistory(false); setShowSettings(false); }}
                        title="Search"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </button>
                    <button
                        className={`${styles.headerButton} ${showHistory ? styles.headerButtonActive : ''}`}
                        onClick={() => { setShowHistory(!showHistory); setShowSearch(false); setShowSettings(false); }}
                        title="Chat History"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </button>
                    <button
                        className={`${styles.headerButton} ${showSettings ? styles.headerButtonActive : ''}`}
                        onClick={() => { setShowSettings(!showSettings); setShowHistory(false); setShowSearch(false); }}
                        title="Settings"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                        </svg>
                    </button>
                    <button className={styles.closeButton} onClick={() => setIsOpen(false)}>×</button>
                </div>
            </div>

            {/* Search Panel */}
            {showSearch && (
                <div className={styles.searchPanel}>
                    <div className={styles.searchHeader}>
                        <div className={styles.searchInputWrapper}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className={styles.searchInput}
                                placeholder="Search in all conversations..."
                                value={localSearchQuery}
                                onChange={(e) => setLocalSearchQuery(e.target.value)}
                            />
                            {localSearchQuery && (
                                <button
                                    className={styles.searchClear}
                                    onClick={() => { setLocalSearchQuery(''); clearSearch(); }}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </div>
                    <div className={styles.searchResults}>
                        {isSearching ? (
                            <div className={styles.searchLoading}>
                                <span className={styles.typingIndicator}>
                                    <span></span><span></span><span></span>
                                </span>
                                <p>Searching...</p>
                            </div>
                        ) : searchResults.length > 0 ? (
                            searchResults.map((result) => (
                                <div
                                    key={result.message_id}
                                    className={styles.searchResultItem}
                                    onClick={() => handleSearchResultClick(result)}
                                >
                                    <div className={styles.searchResultHeader}>
                                        <span className={styles.searchResultRole}>
                                            {result.role === 'user' ? '👤' : result.role === 'assistant' ? '🧠' : '⚙️'}
                                        </span>
                                        <span className={styles.searchResultSession}>{result.session_title}</span>
                                        <span className={styles.searchResultTime}>{formatDate(result.timestamp)}</span>
                                    </div>
                                    <div className={styles.searchResultContent}>
                                        {highlightMatch(result.content.slice(0, 150), localSearchQuery)}
                                        {result.content.length > 150 && '...'}
                                    </div>
                                </div>
                            ))
                        ) : localSearchQuery.trim() ? (
                            <div className={styles.searchEmpty}>No results found</div>
                        ) : (
                            <div className={styles.searchEmpty}>Type to search across all conversations</div>
                        )}
                    </div>
                </div>
            )}

            {/* Settings Panel */}
            {showSettings && (
                <div className={styles.settingsPanel}>
                    <div className={styles.settingsHeader}>
                        <h4>Chat Settings</h4>
                        <button onClick={() => setShowSettings(false)}>×</button>
                    </div>
                    <div className={styles.settingsContent}>
                        <button className={styles.settingsAction} onClick={handleNewChat}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Start New Conversation
                        </button>
                        <button className={styles.settingsAction} onClick={handleClearChat}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Clear Current Chat
                        </button>
                        <button className={`${styles.settingsAction} ${styles.dangerAction}`} onClick={handleResetContext}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M2.5 2v6h6M21.5 22v-6h-6" />
                                <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2" />
                            </svg>
                            Reset Conversation Context
                        </button>
                    </div>
                    <div className={styles.settingsInfo}>
                        <p>💡 <strong>Tip:</strong> Resetting context starts a fresh conversation where Athena forgets previous messages.</p>
                    </div>
                </div>
            )}

            {/* History Panel */}
            {showHistory && (
                <div className={styles.historyPanel}>
                    <div className={styles.historyHeader}>
                        <h4>Chat History</h4>
                        <div className={styles.historyTabs}>
                            <button
                                className={`${styles.historyTab} ${!showArchived ? styles.historyTabActive : ''}`}
                                onClick={() => setShowArchived(false)}
                            >
                                Active
                            </button>
                            <button
                                className={`${styles.historyTab} ${showArchived ? styles.historyTabActive : ''}`}
                                onClick={() => setShowArchived(true)}
                            >
                                Archived {archivedSessions.length > 0 && `(${archivedSessions.length})`}
                            </button>
                        </div>
                        <button onClick={() => setShowHistory(false)}>×</button>
                    </div>
                    {!showArchived && (
                        <button className={styles.newChatButton} onClick={handleNewChat}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            New Conversation
                        </button>
                    )}
                    <div className={styles.historyList}>
                        {isLoadingSessions ? (
                            <div className={styles.historyLoading}>Loading...</div>
                        ) : displaySessions.length === 0 ? (
                            <div className={styles.historyEmpty}>
                                {showArchived ? 'No archived conversations' : 'No conversations yet'}
                            </div>
                        ) : (
                            displaySessions.map((session) => (
                                <div
                                    key={session.id}
                                    className={`${styles.historyItem} ${session.id === currentSessionId ? styles.historyItemActive : ''} ${session.is_pinned ? styles.historyItemPinned : ''}`}
                                    onClick={() => handleLoadSession(session.id)}
                                >
                                    {editingSessionId === session.id ? (
                                        <div className={styles.historyItemEdit} onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveRename();
                                                    if (e.key === 'Escape') handleCancelRename();
                                                }}
                                                autoFocus
                                            />
                                            <button onClick={handleSaveRename} title="Save">✓</button>
                                            <button onClick={handleCancelRename} title="Cancel">×</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={styles.historyItemContent}>
                                                <div className={styles.historyItemTitleRow}>
                                                    {session.is_pinned && <span className={styles.pinIcon}>📌</span>}
                                                    <span className={styles.historyItemTitle}>
                                                        {session.title || 'New Conversation'}
                                                    </span>
                                                </div>
                                                <span className={styles.historyItemMeta}>
                                                    {formatDate(session.updated_at)}
                                                    {session.message_count > 0 && ` • ${session.message_count} msg`}
                                                </span>
                                            </div>
                                            <div className={styles.historyItemActions}>
                                                {!showArchived && (
                                                    <>
                                                        <button
                                                            className={`${styles.historyItemAction} ${session.is_pinned ? styles.historyItemActionActive : ''}`}
                                                            onClick={(e) => handlePinSession(e, session)}
                                                            title={session.is_pinned ? 'Unpin' : 'Pin'}
                                                        >
                                                            📌
                                                        </button>
                                                        <button
                                                            className={styles.historyItemAction}
                                                            onClick={(e) => handleStartRename(e, session)}
                                                            title="Rename"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            className={styles.historyItemAction}
                                                            onClick={(e) => handleArchiveSession(e, session.id)}
                                                            title="Archive"
                                                        >
                                                            📦
                                                        </button>
                                                    </>
                                                )}
                                                {showArchived && (
                                                    <button
                                                        className={styles.historyItemAction}
                                                        onClick={(e) => handleUnarchiveSession(e, session.id)}
                                                        title="Unarchive"
                                                    >
                                                        ↩️
                                                    </button>
                                                )}
                                                <button
                                                    className={`${styles.historyItemAction} ${styles.historyItemDelete}`}
                                                    onClick={(e) => handleDeleteSession(e, session.id)}
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className={styles.messagesContainer}>
                {isLoadingMessages ? (
                    <div className={styles.loadingMessages}>
                        <span className={styles.typingIndicator}>
                            <span></span><span></span><span></span>
                        </span>
                        <p>Loading conversation...</p>
                    </div>
                ) : (
                    <>
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
                    </>
                )}
            </div>

            {/* Quick Prompts (show if few messages) */}
            {messages.length <= 2 && !showHistory && !showSettings && !showSearch && (
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

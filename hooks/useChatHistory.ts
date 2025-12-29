'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    actionResult?: {
        success: boolean;
        message: string;
        data?: unknown;
        error?: string;
    };
}

interface ChatSession {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
    last_message_preview: string | null;
    is_active: boolean;
    is_pinned: boolean;
    pinned_at: string | null;
    is_archived: boolean;
    archived_at: string | null;
}

interface SearchResult {
    message_id: string;
    session_id: string;
    session_title: string;
    role: string;
    content: string;
    timestamp: string;
    rank: number;
}

interface UseChatHistoryReturn {
    // Session management
    sessions: ChatSession[];
    archivedSessions: ChatSession[];
    currentSessionId: string | null;
    isLoadingSessions: boolean;
    createNewSession: () => Promise<string | null>;
    loadSession: (sessionId: string) => Promise<void>;
    deleteSession: (sessionId: string) => Promise<void>;
    renameSession: (sessionId: string, newTitle: string) => Promise<void>;

    // Pin & Archive
    pinSession: (sessionId: string) => Promise<void>;
    unpinSession: (sessionId: string) => Promise<void>;
    archiveSession: (sessionId: string) => Promise<void>;
    unarchiveSession: (sessionId: string) => Promise<void>;

    // Message management
    messages: Message[];
    isLoadingMessages: boolean;
    addMessage: (message: Message) => Promise<void>;
    clearCurrentSession: () => Promise<void>;

    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchResults: SearchResult[];
    isSearching: boolean;
    searchMessages: (query: string) => Promise<void>;
    clearSearch: () => void;

    // Context reset
    resetContext: () => Promise<void>;

    // Refresh & View
    refreshSessions: () => Promise<void>;
    showArchived: boolean;
    setShowArchived: (show: boolean) => void;
}

const WELCOME_MESSAGE: Message = {
    id: 'welcome',
    role: 'assistant',
    content: "Hi! I'm Athena AI 🧠 I can analyze your ads, show patterns, and even **execute tasks** for you! Try saying 'Import my ads' or 'Show me patterns'.",
    timestamp: new Date()
};

function getUserId(): string {
    // Try to get stored user ID
    if (typeof window === 'undefined') return 'server';
    let userId = localStorage.getItem('athena_user_id');
    if (!userId) {
        // Generate a consistent user ID
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('athena_user_id', userId);
    }
    return userId;
}

export function useChatHistory(): UseChatHistoryReturn {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Load sessions on mount
    const refreshSessions = useCallback(async () => {
        setIsLoadingSessions(true);
        try {
            const userId = getUserId();

            // Load active (non-archived) sessions
            const { data: activeData, error: activeError } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .eq('is_archived', false)
                .order('is_pinned', { ascending: false })
                .order('pinned_at', { ascending: false, nullsFirst: false })
                .order('updated_at', { ascending: false })
                .limit(50);

            if (activeError) {
                console.error('Error loading sessions:', activeError);
                // Continue with empty sessions if table doesn't exist yet
            } else {
                setSessions(activeData || []);
            }

            // Load archived sessions
            const { data: archivedData, error: archivedError } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .eq('is_archived', true)
                .order('archived_at', { ascending: false })
                .limit(50);

            if (!archivedError) {
                setArchivedSessions(archivedData || []);
            }

            // If we have sessions and no current session, load the most recent
            if (activeData && activeData.length > 0 && !currentSessionId) {
                const mostRecent = activeData[0];
                await loadSessionMessages(mostRecent.id);
                setCurrentSessionId(mostRecent.id);
            }
        } catch (err) {
            console.error('Failed to load sessions:', err);
        } finally {
            setIsLoadingSessions(false);
        }
    }, [currentSessionId]);

    useEffect(() => {
        refreshSessions();
    }, []);

    // Load messages for a session
    const loadSessionMessages = async (sessionId: string) => {
        setIsLoadingMessages(true);
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('message_timestamp', { ascending: true });

            if (error) {
                console.error('Error loading messages:', error);
                return;
            }

            if (data && data.length > 0) {
                const loadedMessages: Message[] = data.map(msg => ({
                    id: msg.id,
                    role: msg.role as 'user' | 'assistant' | 'system',
                    content: msg.content,
                    timestamp: new Date(msg.message_timestamp),
                    actionResult: msg.action_result
                }));
                setMessages(loadedMessages);
            } else {
                // Empty session, start with welcome message
                setMessages([WELCOME_MESSAGE]);
            }
        } catch (err) {
            console.error('Failed to load messages:', err);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    // Create new session
    const createNewSession = useCallback(async (): Promise<string | null> => {
        // Always reset local state first for immediate UI feedback
        setMessages([WELCOME_MESSAGE]);

        try {
            const userId = getUserId();
            const { data, error } = await supabase
                .from('chat_sessions')
                .insert({
                    user_id: userId,
                    title: 'New Conversation',
                    is_active: true,
                    is_pinned: false,
                    is_archived: false
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating session:', error);
                // Reset to null session - will work in local mode
                setCurrentSessionId(null);
                return null;
            }

            // Set the new session ID
            setCurrentSessionId(data.id);

            // Refresh sessions list (don't await to avoid blocking)
            refreshSessions().catch(err => console.error('Failed to refresh sessions:', err));

            return data.id;
        } catch (err) {
            console.error('Failed to create session:', err);
            // Still reset to allow local usage
            setCurrentSessionId(null);
            return null;
        }
    }, [refreshSessions]);

    // Load existing session
    const loadSession = useCallback(async (sessionId: string) => {
        await loadSessionMessages(sessionId);
        setCurrentSessionId(sessionId);
    }, []);

    // Delete session (soft delete)
    const deleteSession = useCallback(async (sessionId: string) => {
        try {
            const { error } = await supabase
                .from('chat_sessions')
                .update({ is_active: false })
                .eq('id', sessionId);

            if (error) {
                console.error('Error deleting session:', error);
                return;
            }

            // If we deleted the current session, clear it
            if (sessionId === currentSessionId) {
                setCurrentSessionId(null);
                setMessages([WELCOME_MESSAGE]);
            }

            await refreshSessions();
        } catch (err) {
            console.error('Failed to delete session:', err);
        }
    }, [currentSessionId, refreshSessions]);

    // Rename session
    const renameSession = useCallback(async (sessionId: string, newTitle: string) => {
        try {
            const { error } = await supabase
                .from('chat_sessions')
                .update({ title: newTitle })
                .eq('id', sessionId);

            if (error) {
                console.error('Error renaming session:', error);
                return;
            }

            await refreshSessions();
        } catch (err) {
            console.error('Failed to rename session:', err);
        }
    }, [refreshSessions]);

    // Pin session
    const pinSession = useCallback(async (sessionId: string) => {
        try {
            const { error } = await supabase
                .from('chat_sessions')
                .update({
                    is_pinned: true,
                    pinned_at: new Date().toISOString()
                })
                .eq('id', sessionId);

            if (error) {
                console.error('Error pinning session:', error);
                return;
            }

            await refreshSessions();
        } catch (err) {
            console.error('Failed to pin session:', err);
        }
    }, [refreshSessions]);

    // Unpin session
    const unpinSession = useCallback(async (sessionId: string) => {
        try {
            const { error } = await supabase
                .from('chat_sessions')
                .update({
                    is_pinned: false,
                    pinned_at: null
                })
                .eq('id', sessionId);

            if (error) {
                console.error('Error unpinning session:', error);
                return;
            }

            await refreshSessions();
        } catch (err) {
            console.error('Failed to unpin session:', err);
        }
    }, [refreshSessions]);

    // Archive session
    const archiveSession = useCallback(async (sessionId: string) => {
        try {
            const { error } = await supabase
                .from('chat_sessions')
                .update({
                    is_archived: true,
                    archived_at: new Date().toISOString(),
                    is_pinned: false,
                    pinned_at: null
                })
                .eq('id', sessionId);

            if (error) {
                console.error('Error archiving session:', error);
                return;
            }

            // If we archived the current session, clear it
            if (sessionId === currentSessionId) {
                setCurrentSessionId(null);
                setMessages([WELCOME_MESSAGE]);
            }

            await refreshSessions();
        } catch (err) {
            console.error('Failed to archive session:', err);
        }
    }, [currentSessionId, refreshSessions]);

    // Unarchive session
    const unarchiveSession = useCallback(async (sessionId: string) => {
        try {
            const { error } = await supabase
                .from('chat_sessions')
                .update({
                    is_archived: false,
                    archived_at: null
                })
                .eq('id', sessionId);

            if (error) {
                console.error('Error unarchiving session:', error);
                return;
            }

            await refreshSessions();
        } catch (err) {
            console.error('Failed to unarchive session:', err);
        }
    }, [refreshSessions]);

    // Search messages across all sessions
    const searchMessages = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const userId = getUserId();

            // Try using the RPC function first
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('search_chat_messages', {
                    p_user_id: userId,
                    p_query: query,
                    p_limit: 50
                });

            if (!rpcError && rpcData) {
                setSearchResults(rpcData);
            } else {
                // Fallback to simple ILIKE search if RPC fails
                const { data, error } = await supabase
                    .from('chat_messages')
                    .select(`
                        id,
                        session_id,
                        role,
                        content,
                        message_timestamp,
                        chat_sessions!inner(title)
                    `)
                    .eq('user_id', userId)
                    .ilike('content', `%${query}%`)
                    .order('message_timestamp', { ascending: false })
                    .limit(50);

                if (error) {
                    console.error('Search error:', error);
                    // If join fails, try simpler query
                    const { data: simpleData, error: simpleError } = await supabase
                        .from('chat_messages')
                        .select('*')
                        .eq('user_id', userId)
                        .ilike('content', `%${query}%`)
                        .order('message_timestamp', { ascending: false })
                        .limit(50);

                    if (!simpleError && simpleData) {
                        const results: SearchResult[] = simpleData.map(msg => ({
                            message_id: msg.id,
                            session_id: msg.session_id,
                            session_title: 'Conversation',
                            role: msg.role,
                            content: msg.content,
                            timestamp: msg.message_timestamp,
                            rank: 1
                        }));
                        setSearchResults(results);
                    }
                } else if (data) {
                    const results: SearchResult[] = data.map((msg: any) => ({
                        message_id: msg.id,
                        session_id: msg.session_id,
                        session_title: msg.chat_sessions?.title || 'Conversation',
                        role: msg.role,
                        content: msg.content,
                        timestamp: msg.message_timestamp,
                        rank: 1
                    }));
                    setSearchResults(results);
                }
            }
        } catch (err) {
            console.error('Failed to search:', err);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Clear search
    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
    }, []);

    // Add message to current session
    const addMessage = useCallback(async (message: Message) => {
        // Update local state first for responsiveness
        setMessages(prev => [...prev, message]);

        // If no session, create one
        let sessionId = currentSessionId;
        if (!sessionId) {
            sessionId = await createNewSession();
            if (!sessionId) {
                console.error('Failed to create session for message');
                return;
            }
        }

        // Save to database
        try {
            const userId = getUserId();
            const { error } = await supabase
                .from('chat_messages')
                .insert({
                    session_id: sessionId,
                    user_id: userId,
                    role: message.role,
                    content: message.content,
                    message_timestamp: message.timestamp.toISOString(),
                    action_result: message.actionResult || null,
                    action_type: message.actionResult ? 'action' : null
                });

            if (error) {
                console.error('Error saving message:', error);
            }
        } catch (err) {
            console.error('Failed to save message:', err);
        }
    }, [currentSessionId, createNewSession]);

    // Clear all messages in current session (but keep session)
    const clearCurrentSession = useCallback(async () => {
        if (!currentSessionId) {
            setMessages([WELCOME_MESSAGE]);
            return;
        }

        try {
            // Delete all messages in session
            const { error } = await supabase
                .from('chat_messages')
                .delete()
                .eq('session_id', currentSessionId);

            if (error) {
                console.error('Error clearing session:', error);
                return;
            }

            // Reset to welcome message
            setMessages([WELCOME_MESSAGE]);

            // Update session
            await supabase
                .from('chat_sessions')
                .update({
                    message_count: 0,
                    last_message_preview: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentSessionId);

        } catch (err) {
            console.error('Failed to clear session:', err);
        }
    }, [currentSessionId]);

    // Reset context - creates a new session and clears messages
    const resetContext = useCallback(async () => {
        // Immediately clear local state for instant feedback
        setMessages([WELCOME_MESSAGE]);
        setCurrentSessionId(null);

        // Then try to create a new session in the database
        try {
            await createNewSession();
        } catch (err) {
            console.error('Failed to create new session during reset:', err);
            // Already reset local state, so UI will still work
        }
    }, [createNewSession]);

    return {
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
    };
}

export type { Message, ChatSession, SearchResult };

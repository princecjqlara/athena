'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface Video {
    id: string;
    name: string;
    thumbnail: string;
    uploadDate: string;
    platform: string;
    hook_type: string;
    status: 'active' | 'completed' | 'draft';
    ctr?: number;
    roas?: number;
    successScore?: number;
    impressions?: number;
    spend?: number;
}

export default function VideosPage() {
    const [videos, setVideos] = useState<Video[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'draft'>('all');
    const [sortBy, setSortBy] = useState<'date' | 'score' | 'ctr' | 'roas'>('date');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // Load videos from database (empty for new users)
        // TODO: Replace with actual Supabase queries
        setTimeout(() => {
            setVideos([]);
            setIsLoading(false);
        }, 300);
    }, []);

    const filteredVideos = videos
        .filter(v => filter === 'all' || v.status === filter)
        .filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            switch (sortBy) {
                case 'score':
                    return (b.successScore || 0) - (a.successScore || 0);
                case 'ctr':
                    return (b.ctr || 0) - (a.ctr || 0);
                case 'roas':
                    return (b.roas || 0) - (a.roas || 0);
                default:
                    return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
            }
        });

    const stats = {
        total: videos.length,
        active: videos.filter(v => v.status === 'active').length,
        completed: videos.filter(v => v.status === 'completed').length,
        avgScore: videos.length > 0
            ? Math.round(videos.reduce((sum, v) => sum + (v.successScore || 0), 0) / videos.length)
            : 0,
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>My Videos</h1>
                    <p className={styles.subtitle}>Manage and analyze all your uploaded videos</p>
                </div>
                <a href="/upload" className="btn btn-primary">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Upload New
                </a>
            </header>

            {/* Quick Stats */}
            <div className={styles.statsBar}>
                <div className={styles.statItem}>
                    <span className={styles.statValue}>{stats.total}</span>
                    <span className={styles.statLabel}>Total Videos</span>
                </div>
                <div className={styles.statDivider}></div>
                <div className={styles.statItem}>
                    <span className={`${styles.statValue} ${styles.active}`}>{stats.active}</span>
                    <span className={styles.statLabel}>Active Campaigns</span>
                </div>
                <div className={styles.statDivider}></div>
                <div className={styles.statItem}>
                    <span className={styles.statValue}>{stats.completed}</span>
                    <span className={styles.statLabel}>Completed</span>
                </div>
                <div className={styles.statDivider}></div>
                <div className={styles.statItem}>
                    <span className={`${styles.statValue} ${styles.score}`}>{stats.avgScore}%</span>
                    <span className={styles.statLabel}>Avg. Success Score</span>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.filtersBar}>
                <div className={styles.searchBox}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.filterTabs}>
                    {(['all', 'active', 'completed', 'draft'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`${styles.filterTab} ${filter === tab ? styles.active : ''}`}
                            onClick={() => setFilter(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                <div className={styles.sortSelect}>
                    <label>Sort by:</label>
                    <select
                        className="form-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    >
                        <option value="date">Date</option>
                        <option value="score">Success Score</option>
                        <option value="ctr">CTR</option>
                        <option value="roas">ROAS</option>
                    </select>
                </div>
            </div>

            {/* Videos Grid */}
            {isLoading ? (
                <div className={styles.videoGrid}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className={`skeleton ${styles.videoSkeleton}`}></div>
                    ))}
                </div>
            ) : filteredVideos.length === 0 ? (
                <div className={styles.emptyState}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <h3>No videos found</h3>
                    <p>
                        {searchQuery
                            ? 'Try adjusting your search or filters'
                            : 'Upload your first video to get started'}
                    </p>
                    {!searchQuery && (
                        <a href="/upload" className="btn btn-primary">Upload Video</a>
                    )}
                </div>
            ) : (
                <div className={styles.videoGrid}>
                    {filteredVideos.map(video => (
                        <div key={video.id} className={`glass-card ${styles.videoCard}`}>
                            <div className={styles.videoThumbnail}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                <div className={`${styles.statusBadge} ${styles[video.status]}`}>
                                    {video.status}
                                </div>
                            </div>

                            <div className={styles.videoContent}>
                                <h3 className={styles.videoName}>{video.name}</h3>

                                <div className={styles.videoMeta}>
                                    <span className="tag tag-primary">{video.platform}</span>
                                    <span className="tag">{video.hook_type}</span>
                                </div>

                                <div className={styles.videoDate}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    {video.uploadDate}
                                </div>

                                {video.status !== 'draft' && (
                                    <div className={styles.videoStats}>
                                        <div className={styles.videoStat}>
                                            <span className={styles.videoStatLabel}>CTR</span>
                                            <span className={styles.videoStatValue}>{video.ctr}%</span>
                                        </div>
                                        <div className={styles.videoStat}>
                                            <span className={styles.videoStatLabel}>ROAS</span>
                                            <span className={styles.videoStatValue}>{video.roas}x</span>
                                        </div>
                                        <div className={styles.videoStat}>
                                            <span className={styles.videoStatLabel}>Score</span>
                                            <span className={`${styles.videoStatValue} ${styles.score}`}>{video.successScore}%</span>
                                        </div>
                                    </div>
                                )}

                                {video.status === 'draft' && (
                                    <div className={styles.draftActions}>
                                        <span className={styles.predictedScore}>
                                            Predicted: <strong>{video.successScore}%</strong>
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.videoActions}>
                                <button className="btn btn-ghost btn-icon" title="View Details">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                </button>
                                <button className="btn btn-ghost btn-icon" title="Edit">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                </button>
                                {video.status !== 'draft' && (
                                    <a href="/analytics" className="btn btn-ghost btn-icon" title="Add Results">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

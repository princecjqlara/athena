'use client';

import { useState } from 'react';

interface DayMetrics {
    date: string;
    impressions: number;
    reach: number;
    frequency: number;
    clicks: number;
    uniqueClicks: number;
    spend: number;
    ctr: number;
    cpc: number;
    cpm: number;
    cpp: number;
    costPerUniqueClick: number;
    linkClicks: number;
    postEngagement: number;
    outboundClicks: number;
    videoPlays: number;
    videoP25: number;
    videoP50: number;
    videoP75: number;
    videoP100: number;
    avgWatchTime: number;
    leads: number;
    purchases: number;
    messagesStarted: number;
    pageEngagement: number;
    postReactions: number;
    comments: number;
    shares: number;
}

interface VideoRetention {
    totalPlays: number;
    retention: Array<{
        point: string;
        viewers: number;
        percent: number;
    }>;
    avgWatchTime: number;
    completionRate: number;
}

interface WatchTimeTrend {
    date: string;
    avgWatchTime: number;
    videoPlays: number;
}

interface DailyReportData {
    days: DayMetrics[];
    videoRetention: VideoRetention | null;
    watchTimeTrend: WatchTimeTrend[];
    summary: {
        totalDays: number;
        startDate: string | null;
        endDate: string | null;
        avgDailySpend: number;
        avgDailyClicks: number;
        avgDailyImpressions: number;
        totalSpend: number;
        totalClicks: number;
        totalImpressions: number;
        totalVideoPlays: number;
        avgWatchTime: number;
        videoCompletionRate: number;
        bestDay: { date: string; ctr: number; clicks: number; spend: number } | null;
        worstDay: { date: string; ctr: number; clicks: number; spend: number } | null;
    };
}

interface Props {
    data: DailyReportData | null;
    adName?: string;
    isLoading?: boolean;
}

export default function DailyReportsViewer({ data, adName, isLoading }: Props) {
    const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'video'>('overview');
    const [selectedMetric, setSelectedMetric] = useState<'impressions' | 'clicks' | 'spend' | 'ctr'>('impressions');

    if (isLoading) {
        return (
            <div style={{
                padding: '40px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
                <p style={{ color: 'var(--text-muted)' }}>Loading daily reports...</p>
            </div>
        );
    }

    if (!data || data.days.length === 0) {
        return (
            <div style={{
                padding: '40px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📊</div>
                <p style={{ color: 'var(--text-muted)' }}>No daily data available for this ad.</p>
            </div>
        );
    }

    const { days, videoRetention, watchTimeTrend, summary } = data;

    // Calculate max values for chart scaling
    const maxImpressions = Math.max(...days.map(d => d.impressions));
    const maxClicks = Math.max(...days.map(d => d.clicks));
    const maxSpend = Math.max(...days.map(d => d.spend));
    const maxCtr = Math.max(...days.map(d => d.ctr));

    const getMetricValue = (day: DayMetrics) => {
        switch (selectedMetric) {
            case 'impressions': return day.impressions;
            case 'clicks': return day.clicks;
            case 'spend': return day.spend;
            case 'ctr': return day.ctr;
        }
    };

    const getMaxValue = () => {
        switch (selectedMetric) {
            case 'impressions': return maxImpressions;
            case 'clicks': return maxClicks;
            case 'spend': return maxSpend;
            case 'ctr': return maxCtr;
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                        📅 Daily Performance Report
                    </h3>
                    {adName && <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{adName}</p>}
                </div>
                <div style={{
                    display: 'flex',
                    gap: '6px',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '4px',
                    borderRadius: '8px'
                }}>
                    {(['overview', 'daily', 'video'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                background: activeTab === tab ? 'var(--accent-primary)' : 'transparent',
                                color: activeTab === tab ? 'black' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab === 'overview' ? '📊 Overview' : tab === 'daily' ? '📈 Daily' : '🎬 Video'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div style={{ padding: '20px' }}>
                    {/* Summary Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '12px',
                        marginBottom: '24px'
                    }}>
                        <div style={{ background: 'rgba(59,130,246,0.1)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                                {summary.totalDays}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Days Running</div>
                        </div>
                        <div style={{ background: 'rgba(34,197,94,0.1)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e' }}>
                                ₱{summary.totalSpend.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Spend</div>
                        </div>
                        <div style={{ background: 'rgba(168,85,247,0.1)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#a855f7' }}>
                                {summary.totalClicks.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Clicks</div>
                        </div>
                        <div style={{ background: 'rgba(249,115,22,0.1)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f97316' }}>
                                {(summary.totalImpressions / 1000).toFixed(1)}K
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Impressions</div>
                        </div>
                    </div>

                    {/* Best & Worst Days */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        {summary.bestDay && (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)',
                                padding: '16px',
                                borderRadius: '10px',
                                border: '1px solid rgba(34,197,94,0.3)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🏆</span>
                                    <span style={{ fontWeight: 600, color: '#22c55e' }}>Best Day</span>
                                </div>
                                <div style={{ fontSize: '0.95rem' }}>{formatDate(summary.bestDay.date)}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {summary.bestDay.ctr.toFixed(2)}% CTR • {summary.bestDay.clicks} clicks • ₱{summary.bestDay.spend.toFixed(2)}
                                </div>
                            </div>
                        )}
                        {summary.worstDay && (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
                                padding: '16px',
                                borderRadius: '10px',
                                border: '1px solid rgba(239,68,68,0.3)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>📉</span>
                                    <span style={{ fontWeight: 600, color: '#ef4444' }}>Needs Improvement</span>
                                </div>
                                <div style={{ fontSize: '0.95rem' }}>{formatDate(summary.worstDay.date)}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {summary.worstDay.ctr.toFixed(2)}% CTR • {summary.worstDay.clicks} clicks • ₱{summary.worstDay.spend.toFixed(2)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Daily Averages */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '16px',
                        borderRadius: '10px'
                    }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Daily Averages</h4>
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                            <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Spend:</span>
                                <span style={{ marginLeft: '8px', fontWeight: 600 }}>₱{summary.avgDailySpend.toFixed(2)}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Clicks:</span>
                                <span style={{ marginLeft: '8px', fontWeight: 600 }}>{summary.avgDailyClicks}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Impressions:</span>
                                <span style={{ marginLeft: '8px', fontWeight: 600 }}>{summary.avgDailyImpressions.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Daily Tab */}
            {activeTab === 'daily' && (
                <div style={{ padding: '20px' }}>
                    {/* Metric Selector */}
                    <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(['impressions', 'clicks', 'spend', 'ctr'] as const).map(metric => (
                            <button
                                key={metric}
                                onClick={() => setSelectedMetric(metric)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    border: selectedMetric === metric ? 'none' : '1px solid rgba(255,255,255,0.2)',
                                    background: selectedMetric === metric ? 'var(--accent-primary)' : 'transparent',
                                    color: selectedMetric === metric ? 'black' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {metric === 'ctr' ? 'CTR %' : metric}
                            </button>
                        ))}
                    </div>

                    {/* Simple Bar Chart */}
                    <div style={{
                        height: '200px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '2px',
                        padding: '20px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        {days.slice(-30).map((day, idx) => {
                            const value = getMetricValue(day);
                            const maxVal = getMaxValue();
                            const height = maxVal > 0 ? (value / maxVal) * 100 : 0;
                            return (
                                <div
                                    key={idx}
                                    title={`${formatDate(day.date)}: ${selectedMetric === 'spend' ? '₱' : ''}${selectedMetric === 'ctr' ? value.toFixed(2) + '%' : value.toLocaleString()}`}
                                    style={{
                                        flex: 1,
                                        height: `${Math.max(height, 2)}%`,
                                        background: `linear-gradient(to top, var(--accent-primary), rgba(185,251,16,0.6))`,
                                        borderRadius: '3px 3px 0 0',
                                        minWidth: '8px',
                                        cursor: 'pointer',
                                        transition: 'opacity 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                />
                            );
                        })}
                    </div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        marginTop: '8px'
                    }}>
                        <span>{days.length > 0 ? formatDate(days[Math.max(0, days.length - 30)].date) : ''}</span>
                        <span>{days.length > 0 ? formatDate(days[days.length - 1].date) : ''}</span>
                    </div>

                    {/* Daily Table */}
                    <div style={{ marginTop: '24px', maxHeight: '300px', overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                                    <th style={{ padding: '10px', textAlign: 'left', position: 'sticky', top: 0, background: 'rgba(20,20,20,0.95)' }}>Date</th>
                                    <th style={{ padding: '10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(20,20,20,0.95)' }}>Impr.</th>
                                    <th style={{ padding: '10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(20,20,20,0.95)' }}>Clicks</th>
                                    <th style={{ padding: '10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(20,20,20,0.95)' }}>CTR</th>
                                    <th style={{ padding: '10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(20,20,20,0.95)' }}>Spend</th>
                                    <th style={{ padding: '10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(20,20,20,0.95)' }}>CPC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...days].reverse().map((day, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '10px' }}>{formatDate(day.date)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>{day.impressions.toLocaleString()}</td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>{day.clicks}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', color: day.ctr > 2 ? '#22c55e' : day.ctr > 1 ? '#f59e0b' : '#ef4444' }}>
                                            {day.ctr.toFixed(2)}%
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>₱{day.spend.toFixed(2)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>₱{day.cpc.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Video Tab */}
            {activeTab === 'video' && (
                <div style={{ padding: '20px' }}>
                    {videoRetention ? (
                        <>
                            {/* Video Stats */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                gap: '12px',
                                marginBottom: '24px'
                            }}>
                                <div style={{ background: 'rgba(139,92,246,0.1)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                                        {videoRetention.totalPlays.toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Video Plays</div>
                                </div>
                                <div style={{ background: 'rgba(34,197,94,0.1)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e' }}>
                                        {videoRetention.completionRate}%
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Completion Rate</div>
                                </div>
                                <div style={{ background: 'rgba(249,115,22,0.1)', padding: '16px', borderRadius: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f97316' }}>
                                        {videoRetention.avgWatchTime.toFixed(1)}s
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg Watch Time</div>
                                </div>
                            </div>

                            {/* Retention Graph */}
                            <div style={{
                                background: 'rgba(255,255,255,0.03)',
                                padding: '20px',
                                borderRadius: '12px',
                                marginBottom: '24px'
                            }}>
                                <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem' }}>📉 Video Retention Curve</h4>
                                <div style={{ height: '150px', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                                    {videoRetention.retention.map((point, idx) => (
                                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div
                                                style={{
                                                    width: '100%',
                                                    height: `${point.percent}%`,
                                                    background: `linear-gradient(to top, 
                                                        ${idx === 0 ? '#3b82f6' : idx === videoRetention.retention.length - 1 ? '#22c55e' : '#8b5cf6'}, 
                                                        ${idx === 0 ? 'rgba(59,130,246,0.4)' : idx === videoRetention.retention.length - 1 ? 'rgba(34,197,94,0.4)' : 'rgba(139,92,246,0.4)'}
                                                    )`,
                                                    borderRadius: '6px 6px 0 0',
                                                    minHeight: '10px',
                                                    position: 'relative'
                                                }}
                                            >
                                                <span style={{
                                                    position: 'absolute',
                                                    top: '-22px',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    color: 'var(--text-primary)'
                                                }}>
                                                    {point.percent}%
                                                </span>
                                            </div>
                                            <span style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {point.point}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Watch Time Trend */}
                            {watchTimeTrend && watchTimeTrend.length > 0 && (
                                <div style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: '20px',
                                    borderRadius: '12px'
                                }}>
                                    <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem' }}>⏱️ Daily Watch Time Trend</h4>
                                    <div style={{
                                        height: '100px',
                                        display: 'flex',
                                        alignItems: 'flex-end',
                                        gap: '2px'
                                    }}>
                                        {watchTimeTrend.slice(-30).map((point, idx) => {
                                            const maxTime = Math.max(...watchTimeTrend.map(p => p.avgWatchTime));
                                            const height = maxTime > 0 ? (point.avgWatchTime / maxTime) * 100 : 0;
                                            return (
                                                <div
                                                    key={idx}
                                                    title={`${formatDate(point.date)}: ${point.avgWatchTime.toFixed(1)}s avg`}
                                                    style={{
                                                        flex: 1,
                                                        height: `${Math.max(height, 5)}%`,
                                                        background: 'linear-gradient(to top, #f97316, rgba(249,115,22,0.4))',
                                                        borderRadius: '2px 2px 0 0',
                                                        minWidth: '6px',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                        marginTop: '8px'
                                    }}>
                                        <span>{watchTimeTrend.length > 0 ? formatDate(watchTimeTrend[Math.max(0, watchTimeTrend.length - 30)].date) : ''}</span>
                                        <span>{watchTimeTrend.length > 0 ? formatDate(watchTimeTrend[watchTimeTrend.length - 1].date) : ''}</span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{
                            padding: '40px',
                            textAlign: 'center',
                            color: 'var(--text-muted)'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎬</div>
                            <p>No video data available for this ad.</p>
                            <p style={{ fontSize: '0.85rem' }}>Video metrics are only available for video ad creatives.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Footer with date range */}
            <div style={{
                padding: '12px 20px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.8rem',
                color: 'var(--text-muted)'
            }}>
                <span>
                    {summary.startDate && summary.endDate && (
                        <>📅 {formatDate(summary.startDate)} - {formatDate(summary.endDate)}</>
                    )}
                </span>
                <span>{days.length} days of data</span>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import TopActionsPanel from '@/components/recommendations/TopActionsPanel';
import AlertCenter from '@/components/anomalies/AlertCenter';

interface DashboardStats {
  totalVideos: number;
  totalAds: number;
  averageCtr: number;
  averageRoas: number;
  totalSpend: number;
  totalRevenue: number;
  modelAccuracy: number;
  dataPoints: number;
}

interface RecentVideo {
  id: string;
  thumbnail: string;
  name: string;
  successScore: number;
  ctr: number;
  platform: string;
  date: string;
}

interface TopPattern {
  pattern: string;
  successRate: number;
  count: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    totalAds: 0,
    averageCtr: 0,
    averageRoas: 0,
    totalSpend: 0,
    totalRevenue: 0,
    modelAccuracy: 0,
    dataPoints: 0,
  });

  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [topPatterns, setTopPatterns] = useState<TopPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');

  // Get or create user ID
  useEffect(() => {
    let id = localStorage.getItem('athena_user_id');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('athena_user_id', id);
    }
    setUserId(id);
  }, []);

  useEffect(() => {
    // Load real data from localStorage
    try {
      const stored = localStorage.getItem('ads');
      const ads = stored ? JSON.parse(stored) : [];

      // Calculate aggregate stats from all ads
      let totalCtr = 0;
      let totalRoas = 0;
      let totalSpend = 0;
      let totalRevenue = 0;
      let adsWithCtr = 0;
      let adsWithRoas = 0;

      ads.forEach((ad: Record<string, unknown>) => {
        // Handle both data structures (uploaded vs imported)
        const ctr = (ad.adInsights as Record<string, number>)?.ctr || (ad as Record<string, number>).ctr || 0;
        const roas = (ad as Record<string, number>).roas || 0;
        const spend = (ad.adInsights as Record<string, number>)?.spend || (ad as Record<string, number>).spend || 0;
        const revenue = (ad as Record<string, number>).revenue || 0;

        if (ctr > 0) { totalCtr += ctr; adsWithCtr++; }
        if (roas > 0) { totalRoas += roas; adsWithRoas++; }
        totalSpend += spend;
        totalRevenue += revenue;
      });

      setStats({
        totalVideos: ads.length,
        totalAds: ads.filter((a: Record<string, unknown>) => a.importedFromFacebook || a.facebookAdId).length,
        averageCtr: adsWithCtr > 0 ? Math.round((totalCtr / adsWithCtr) * 100) / 100 : 0,
        averageRoas: adsWithRoas > 0 ? Math.round((totalRoas / adsWithRoas) * 10) / 10 : 0,
        totalSpend: Math.round(totalSpend),
        totalRevenue: Math.round(totalRevenue),
        modelAccuracy: Math.min(95, Math.round(ads.length * 2)), // Mock accuracy based on data points
        dataPoints: ads.length,
      });

      // Get recent ads for display
      const recent = ads.slice(-6).reverse().map((ad: Record<string, unknown>, i: number) => ({
        id: ad.id as string || `ad-${i}`,
        thumbnail: (ad.thumbnailUrl as string) || '',
        name: ((ad.extractedContent as Record<string, string>)?.title) || (ad.name as string) || 'Untitled Ad',
        successScore: (ad.successScore as number) || 0,
        ctr: (ad.adInsights as Record<string, number>)?.ctr || (ad as Record<string, number>).ctr || 0,
        platform: ((ad.extractedContent as Record<string, string>)?.platform) || (ad.platform as string) || 'Unknown',
        date: new Date((ad.importedAt as string) || (ad.uploadDate as string) || (ad.createdAt as string) || Date.now()).toLocaleDateString()
      }));
      setRecentVideos(recent);

      setTopPatterns([]);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    }
    setIsLoading(false);
  }, []);

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Welcome back! Here's your ad performance overview.</p>
        </div>
        <div className={styles.headerActions}>
          <a href="/upload" className="btn btn-primary btn-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Video
          </a>
        </div>
      </header>

      {/* AI Recommendations & Alerts */}
      {userId && (
        <section style={{ marginBottom: '24px' }}>
          <AlertCenter orgId={userId} userId={userId} maxItems={5} />
          <TopActionsPanel orgId={userId} userId={userId} maxItems={5} />
        </section>
      )}

      {/* Stats Grid */}
      <section className={styles.statsGrid}>
        <StatCard
          label="Total Ads"
          value={stats.totalVideos}
          icon="ads"
          trend="+3 this week"
          isLoading={isLoading}
        />
        <StatCard
          label="Active Campaigns"
          value={stats.totalAds}
          icon="campaign"
          trend="+8 this month"
          isLoading={isLoading}
        />
        <StatCard
          label="Avg. CTR"
          value={`${stats.averageCtr}%`}
          icon="click"
          trend="+0.5% vs last month"
          trendPositive
          isLoading={isLoading}
        />
        <StatCard
          label="Avg. ROAS"
          value={`${stats.averageRoas}x`}
          icon="money"
          trend="+0.3x vs last month"
          trendPositive
          isLoading={isLoading}
        />
      </section>

      {/* Revenue Stats */}
      <section className={styles.revenueSection}>
        <div className={`glass-card ${styles.revenueCard}`}>
          <div className={styles.revenueHeader}>
            <h3>Revenue Overview</h3>
            <select className="form-select" style={{ width: 'auto' }}>
              <option>Last 30 days</option>
              <option>Last 7 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          <div className={styles.revenueStats}>
            <div className={styles.revenueStat}>
              <span className={styles.revenueLabel}>Total Spend</span>
              <span className={styles.revenueValue}>₱{stats.totalSpend.toLocaleString()}</span>
            </div>
            <div className={styles.revenueDivider}></div>
            <div className={styles.revenueStat}>
              <span className={styles.revenueLabel}>Total Revenue</span>
              <span className={`${styles.revenueValue} ${styles.positive}`}>₱{stats.totalRevenue.toLocaleString()}</span>
            </div>
            <div className={styles.revenueDivider}></div>
            <div className={styles.revenueStat}>
              <span className={styles.revenueLabel}>Net Profit</span>
              <span className={`${styles.revenueValue} ${styles.positive}`}>
                ₱{(stats.totalRevenue - stats.totalSpend).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className={`glass-card ${styles.mlCard}`}>
          <div className={styles.mlHeader}>
            <div className={styles.mlIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4.5a2.5 2.5 0 00-4.96-.46 2.5 2.5 0 00-1.98 3 2.5 2.5 0 00-1.32 4.24 3 3 0 00.34 5.58 2.5 2.5 0 002.96 3.08A2.5 2.5 0 0012 19.5" />
                <path d="M12 4.5a2.5 2.5 0 014.96-.46 2.5 2.5 0 011.98 3 2.5 2.5 0 011.32 4.24 3 3 0 01-.34 5.58 2.5 2.5 0 01-2.96 3.08A2.5 2.5 0 0012 19.5" />
              </svg>
            </div>
            <div>
              <h3>AI Model Status</h3>
              <p>Learning from your data</p>
            </div>
          </div>
          <div className={styles.mlStats}>
            <div className={styles.mlStat}>
              <span className={styles.mlLabel}>Data Points</span>
              <span className={styles.mlValue}>{stats.dataPoints}</span>
            </div>
            <div className={styles.mlStat}>
              <span className={styles.mlLabel}>Accuracy</span>
              <span className={styles.mlValue}>{stats.modelAccuracy}%</span>
            </div>
          </div>
          <div className={styles.progressSection}>
            <div className={styles.progressLabel}>
              <span>Training Progress</span>
              <span>{Math.min(stats.dataPoints * 2, 100)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(stats.dataPoints * 2, 100)}%` }}></div>
            </div>
            <p className={styles.mlHint}>
              {stats.dataPoints < 50
                ? `Add ${50 - stats.dataPoints} more videos for better predictions`
                : 'Model is well-trained!'}
            </p>
          </div>
        </div>
      </section>

      {/* Bottom Grid */}
      <section className={styles.bottomGrid}>
        {/* Top Patterns */}
        <div className={`glass-card ${styles.patternsCard}`}>
          <div className={styles.cardHeader}>
            <h3>Top Winning Patterns</h3>
            <a href="/mindmap" className="btn btn-ghost btn-sm">View Mind Map</a>
          </div>
          <div className={styles.patternsList}>
            {topPatterns.length === 0 ? (
              <div className={styles.emptyState}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 4.5a2.5 2.5 0 00-4.96-.46 2.5 2.5 0 00-1.98 3 2.5 2.5 0 00-1.32 4.24 3 3 0 00.34 5.58 2.5 2.5 0 002.96 3.08A2.5 2.5 0 0012 19.5" />
                  <path d="M12 4.5a2.5 2.5 0 014.96-.46 2.5 2.5 0 011.98 3 2.5 2.5 0 011.32 4.24 3 3 0 01-.34 5.58 2.5 2.5 0 01-2.96 3.08A2.5 2.5 0 0112 19.5" />
                </svg>
                <p>No patterns discovered yet</p>
                <span>Upload videos and add results to start learning patterns</span>
              </div>
            ) : (
              topPatterns.map((pattern, index) => (
                <div key={index} className={styles.patternItem}>
                  <div className={styles.patternRank}>#{index + 1}</div>
                  <div className={styles.patternInfo}>
                    <span className={styles.patternName}>{pattern.pattern}</span>
                    <div className={styles.patternMeta}>
                      <span className="tag tag-success">{pattern.successRate}% success</span>
                      <span className="tag">{pattern.count} videos</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Videos */}
        <div className={`glass-card ${styles.videosCard}`}>
          <div className={styles.cardHeader}>
            <h3>Recent Videos</h3>
            <a href="/videos" className="btn btn-ghost btn-sm">View All</a>
          </div>
          <div className={styles.videosList}>
            {recentVideos.length === 0 ? (
              <div className={styles.emptyState}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                <p>No videos uploaded yet</p>
                <a href="/upload" className="btn btn-primary btn-sm">Upload First Video</a>
              </div>
            ) : (
              recentVideos.map((video) => (
                <div key={video.id} className={styles.videoItem}>
                  <div className={styles.videoThumbnail}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                  <div className={styles.videoInfo}>
                    <span className={styles.videoName}>{video.name}</span>
                    <div className={styles.videoMeta}>
                      <span className="tag tag-primary">{video.platform}</span>
                      <span className="tag">{video.ctr}% CTR</span>
                    </div>
                  </div>
                  <div className={styles.videoScore}>
                    <div
                      className={styles.scoreCircle}
                      style={{
                        '--score': video.successScore,
                        background: `conic-gradient(var(--success) ${video.successScore}%, var(--bg-tertiary) 0)`
                      } as React.CSSProperties}
                    >
                      <span>{video.successScore}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className={styles.quickActions}>
        <h3>Quick Actions</h3>
        <div className={styles.actionGrid}>
          <a href="/upload" className={`glass-card ${styles.actionCard}`}>
            <div className={styles.actionIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span>Upload New Video</span>
          </a>
          <a href="/analytics" className={`glass-card ${styles.actionCard}`}>
            <div className={styles.actionIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
            </div>
            <span>Input Ad Results</span>
          </a>
          <a href="/predict" className={`glass-card ${styles.actionCard}`}>
            <div className={styles.actionIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <span>Get Predictions</span>
          </a>
          <a href="/videos" className={`glass-card ${styles.actionCard}`}>
            <div className={styles.actionIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <span>Browse Videos</span>
          </a>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  trend,
  trendPositive = false,
  isLoading
}: {
  label: string;
  value: string | number;
  icon: string;
  trend: string;
  trendPositive?: boolean;
  isLoading: boolean;
}) {
  const icons: Record<string, React.ReactNode> = {
    ads: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    video: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
    campaign: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    click: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
      </svg>
    ),
    money: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  };

  return (
    <div className={`glass-card ${styles.statCard}`}>
      <div className={styles.statIcon}>{icons[icon]}</div>
      <div className={styles.statContent}>
        <span className={styles.statLabel}>{label}</span>
        {isLoading ? (
          <div className={`skeleton ${styles.statSkeleton}`}></div>
        ) : (
          <>
            <span className={styles.statValue}>{value}</span>
            <span className={`${styles.statTrend} ${trendPositive ? styles.positive : ''}`}>
              {trend}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

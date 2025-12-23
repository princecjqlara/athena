'use client';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17L12 22L22 17" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="gradient" x1="2" y1="2" x2="22" y2="22">
                  <stop stopColor="#6366f1" />
                  <stop offset="0.5" stopColor="#a855f7" />
                  <stop offset="1" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="logo-text">Athena</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavItem href="/" icon="dashboard" label="Dashboard" />
        <NavItem href="/upload" icon="upload" label="Upload Ad" />
        <NavItem href="/results" icon="chart" label="Add Results" />
        <NavItem href="/mindmap" icon="mindmap" label="Algorithm" />
        <NavItem href="/videos" icon="video" label="My Ads" />
        <NavItem href="/settings" icon="settings" label="Settings" />
      </nav>

      <div className="sidebar-footer">
        <div className="ml-status">
          <div className="status-dot"></div>
          <span>ML Model Active</span>
        </div>
      </div>

      <style jsx>{`
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: 260px;
          background: rgba(18, 18, 26, 0.95);
          backdrop-filter: blur(20px);
          border-right: 1px solid var(--border-primary);
          display: flex;
          flex-direction: column;
          z-index: 100;
        }
        
        .sidebar-header {
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--border-primary);
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }
        
        .logo-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-tertiary);
          border-radius: var(--radius-lg);
        }
        
        .logo-text {
          font-size: 1.25rem;
          font-weight: 700;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .sidebar-nav {
          flex: 1;
          padding: var(--spacing-md);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }
        
        .sidebar-footer {
          padding: var(--spacing-lg);
          border-top: 1px solid var(--border-primary);
        }
        
        .ml-status {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          background: var(--success);
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
      `}</style>
    </aside>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  const icons: Record<string, React.ReactNode> = {
    dashboard: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
    mindmap: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <circle cx="4" cy="6" r="2" />
        <circle cx="20" cy="6" r="2" />
        <circle cx="4" cy="18" r="2" />
        <circle cx="20" cy="18" r="2" />
        <line x1="9.5" y1="10" x2="5.5" y2="7" />
        <line x1="14.5" y1="10" x2="18.5" y2="7" />
        <line x1="9.5" y1="14" x2="5.5" y2="17" />
        <line x1="14.5" y1="14" x2="18.5" y2="17" />
      </svg>
    ),
    upload: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    chart: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    brain: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4.5a2.5 2.5 0 00-4.96-.46 2.5 2.5 0 00-1.98 3 2.5 2.5 0 00-1.32 4.24 3 3 0 00.34 5.58 2.5 2.5 0 002.96 3.08A2.5 2.5 0 0012 19.5" />
        <path d="M12 4.5a2.5 2.5 0 014.96-.46 2.5 2.5 0 011.98 3 2.5 2.5 0 011.32 4.24 3 3 0 01-.34 5.58 2.5 2.5 0 01-2.96 3.08A2.5 2.5 0 0012 19.5" />
        <path d="M12 4.5v15" />
      </svg>
    ),
    video: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
    settings: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  };

  return (
    <a href={href} className="nav-item">
      <span className="nav-icon">{icons[icon]}</span>
      <span className="nav-label">{label}</span>

      <style jsx>{`
        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-md);
          color: var(--text-secondary);
          border-radius: var(--radius-lg);
          transition: all var(--transition-fast);
          text-decoration: none;
        }
        
        .nav-item:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }
        
        .nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .nav-label {
          font-size: 0.875rem;
          font-weight: 500;
        }
      `}</style>
    </a>
  );
}

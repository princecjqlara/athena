'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const pathname = usePathname();

  // Load collapsed state and user session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setIsCollapsed(true);

    // Load user session for display
    const userName = localStorage.getItem('fb_user_name') || localStorage.getItem('athena_user_email');
    if (userName) {
      setUser({ name: userName });
    }
  }, []);

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar_collapsed', String(newState));
    // Dispatch event for main content to adjust
    window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: newState } }));
  };

  // Check if nav item is active based on current pathname
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <img src="/logo.png" alt="Athena" width="36" height="36" style={{ borderRadius: '6px' }} />
          </div>
          {!isCollapsed && <span className="logo-text">Athena</span>}
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavItem href="/" icon="dashboard" label="Dashboard" collapsed={isCollapsed} active={isActive('/')} />
        <NavItem href="/upload" icon="upload" label="Upload Ad" collapsed={isCollapsed} active={isActive('/upload')} />
        <NavItem href="/import" icon="download" label="Import from FB" collapsed={isCollapsed} active={isActive('/import')} />
        <NavItem href="/results" icon="chart" label="Add Results" collapsed={isCollapsed} active={isActive('/results')} />
        <NavItem href="/mindmap" icon="mindmap" label="Algorithm" collapsed={isCollapsed} active={isActive('/mindmap')} />
        <NavItem href="/pipeline" icon="pipeline" label="Pipeline" collapsed={isCollapsed} active={isActive('/pipeline')} />
        <NavItem href="/marketplace" icon="marketplace" label="Marketplace" collapsed={isCollapsed} active={isActive('/marketplace')} />
        <NavItem href="/myads" icon="ads" label="My Ads" collapsed={isCollapsed} active={isActive('/myads')} />
        <NavItem href="/settings" icon="settings" label="Settings" collapsed={isCollapsed} active={isActive('/settings')} />
        <NavItem href="/organizer" icon="organizer" label="Organizer" collapsed={isCollapsed} active={isActive('/organizer')} />
      </nav>

      <div className="sidebar-footer">
        {!isCollapsed && user && (
          <div className="user-session" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
            👤 {user.name}
          </div>
        )}
        {!isCollapsed && (
          <div className="ml-status">
            <div className="status-dot"></div>
            <span>ML Model Active</span>
          </div>
        )}
        <button className="collapse-btn" onClick={toggleCollapsed} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isCollapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>
      </div>

      <style jsx>{`
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: 260px;
          background: rgba(26, 15, 46, 0.95);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(200, 245, 96, 0.1);
          display: flex;
          flex-direction: column;
          z-index: 100;
          transition: width 0.2s ease;
        }
        
        .sidebar.collapsed {
          width: 72px;
        }
        
        .sidebar-header {
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--border-primary);
        }
        
        .collapsed .sidebar-header {
          padding: var(--spacing-md);
          display: flex;
          justify-content: center;
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
          flex-shrink: 0;
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
        
        .collapsed .sidebar-nav {
          padding: var(--spacing-sm);
          align-items: center;
        }
        
        .sidebar-footer {
          padding: var(--spacing-lg);
          border-top: 1px solid var(--border-primary);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }
        
        .collapsed .sidebar-footer {
          padding: var(--spacing-md);
          align-items: center;
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
        
        .collapse-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: var(--spacing-sm);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .collapse-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }
        
        .collapsed .collapse-btn {
          width: 40px;
          height: 40px;
          padding: 0;
        }

        /* Light Mode Sidebar */
        :global([data-theme="light"]) .sidebar,
        :global(.light) .sidebar {
          background: rgba(255, 255, 255, 0.95);
          border-right: 1px solid rgba(0, 0, 0, 0.1);
        }

        :global([data-theme="light"]) .collapse-btn,
        :global(.light) .collapse-btn {
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        :global([data-theme="light"]) .collapse-btn:hover,
        :global(.light) .collapse-btn:hover {
          background: rgba(0, 0, 0, 0.08);
        }

        :global([data-theme="light"]) .user-session,
        :global(.light) .user-session {
          color: rgba(0, 0, 0, 0.6) !important;
        }
      `}</style>
    </aside>
  );
}


function NavItem({ href, icon, label, collapsed, active }: { href: string; icon: string; label: string; collapsed?: boolean; active?: boolean }) {
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
    download: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
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
        <path d="M19 10c0 4.418-3.582 8-8 8H5l-3 3V5a2 2 0 0 1 2-2h7c4.418 0 8 3.582 8 8z" />
        <circle cx="13" cy="10" r="1" fill="currentColor" />
        <circle cx="9" cy="10" r="1" fill="currentColor" />
        <path d="M21 15l-3-3m0 0l-3 3m3-3v9" />
      </svg>
    ),
    ads: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l18-5v12L3 13v-2z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
    pipeline: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="12" r="3" />
        <circle cx="19" cy="12" r="3" />
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="19" r="2" />
        <path d="M7.5 10.5L10 7" />
        <path d="M14 7L16.5 10.5" />
        <path d="M7.5 13.5L10 17" />
        <path d="M14 17L16.5 13.5" />
      </svg>
    ),
    marketplace: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    settings: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    organizer: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
  };

  return (
    <a href={href} className={`nav-item ${collapsed ? 'collapsed' : ''} ${active ? 'active' : ''}`} title={collapsed ? label : undefined}>
      <span className={`nav-icon ${active ? 'active' : ''}`}>{icons[icon]}</span>
      {!collapsed && <span className="nav-label">{label}</span>}

      <style jsx>{`
        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-xs);
          color: var(--text-secondary);
          border-radius: var(--radius-xl);
          transition: all var(--transition-fast);
          text-decoration: none;
        }
        
        .nav-item.collapsed {
          justify-content: center;
          padding: 0;
        }
        
        .nav-item:hover,
        .nav-item.active {
          color: var(--text-primary);
        }
        
        .nav-item:hover .nav-icon,
        .nav-item.active .nav-icon,
        .nav-icon.active {
          background: rgba(200, 245, 96, 0.15);
          color: #c8f560;
          box-shadow: 0 0 20px rgba(200, 245, 96, 0.2);
        }
        
        .nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          transition: all var(--transition-fast);
        }
        
        .nav-label {
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
        }

        /* Light Mode NavItem */
        :global([data-theme="light"]) .nav-icon,
        :global(.light) .nav-icon {
          background: rgba(0, 0, 0, 0.05);
        }

        :global([data-theme="light"]) .nav-item:hover .nav-icon,
        :global([data-theme="light"]) .nav-item.active .nav-icon,
        :global(.light) .nav-item:hover .nav-icon,
        :global(.light) .nav-item.active .nav-icon {
          background: rgba(22, 163, 74, 0.15);
          color: #16a34a;
          box-shadow: 0 0 20px rgba(22, 163, 74, 0.2);
        }
      `}</style>
    </a>
  );
}


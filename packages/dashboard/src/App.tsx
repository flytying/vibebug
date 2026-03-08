import { BrowserRouter, Routes, Route, NavLink } from 'react-router';
import { OverviewPage } from './pages/OverviewPage';
import { IssuesPage } from './pages/IssuesPage';
import { IssueDetailPage } from './pages/IssueDetailPage';
import { InsightsPage } from './pages/InsightsPage';
import { api } from './api/client';
import { useApi } from './hooks/useApi';
import { useTheme } from './hooks/useTheme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Bug, LayoutDashboard, List, Lightbulb, Sun, Moon } from 'lucide-react';

function NavItem({ to, children, icon: Icon }: { to: string; children: React.ReactNode; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-secondary-foreground hover:text-foreground hover:bg-muted'
        )
      }
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </NavLink>
  );
}

export function App() {
  const { data: project } = useApi(() => api.getProject());
  const { theme, toggleTheme } = useTheme();

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        {/* Top bar */}
        <nav className="border-b border-border px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-5">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Bug className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight">VibeBug</span>
            </div>

            <div className="w-px h-5 bg-border" />

            {/* Nav links */}
            <div className="flex gap-1">
              <NavItem to="/" icon={LayoutDashboard}>Overview</NavItem>
              <NavItem to="/issues" icon={List}>Captures</NavItem>
              <NavItem to="/insights" icon={Lightbulb}>Insights</NavItem>
            </div>
          </div>

          {/* Right side: theme toggle + project context */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={toggleTheme} className="w-8 h-8 p-0">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {project && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-secondary-foreground font-medium">{project.name}</span>
                <span className="text-muted-foreground truncate max-w-[240px]">{project.rootPath}</span>
              </div>
            )}
          </div>
        </nav>

        <main className="max-w-[1140px] mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/issues" element={<IssuesPage />} />
            <Route path="/issues/:id" element={<IssueDetailPage />} />
            <Route path="/insights" element={<InsightsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

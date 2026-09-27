import { Component, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router';
import { ErrorNotice, NotFound } from './components/States';
import { DashboardPage } from './pages/DashboardPage';
import { SessionPage } from './pages/SessionPage';
import { TopicPage } from './pages/TopicPage';
import { TopicsPage } from './pages/TopicsPage';

export function App() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl items-baseline gap-x-8 px-5 py-4">
          <Link to="/" className="font-serif text-xl font-semibold tracking-tight">
            Cognibloom
          </Link>
          <nav aria-label="Main" className="flex gap-6">
            <NavLink to="/" end className={navLinkStyle}>
              Progress
            </NavLink>
            <NavLink to="/topics" className={navLinkStyle}>
              Topics
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-8 pb-16 sm:pt-12">
        <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/topics" element={<TopicsPage />} />
            <Route path="/topics/:id" element={<TopicPage />} />
            <Route path="/sessions/:id" element={<SessionPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function navLinkStyle({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'text-ink underline decoration-leaf decoration-2 underline-offset-[7px]'
    : 'text-graphite hover:text-ink';
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorNotice
          error={new Error('This page ran into a problem and stopped. Reloading usually fixes it.')}
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

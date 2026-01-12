'use client';

import TopNav from './TopNav';
import Sidebar from './Sidebar';
import ErrorBoundary from './ErrorBoundary';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black">
        {/* Fixed Top Navigation - 80px height */}
        <TopNav />

        {/* Fixed Sidebar - starts at top-20 (80px) below nav */}
        <div className="fixed left-0 top-20 bottom-0 w-56 z-40">
          <Sidebar />
        </div>

        {/* Main Content Area */}
        {/* pt-28 = 112px top padding (80px for nav + 32px extra spacing) */}
        {/* pl-64 = 256px left padding (224px sidebar + 32px gap) */}
        <div
          className="min-h-screen"
          style={{
            paddingTop: '112px',
            paddingLeft: '256px',
            paddingRight: '32px',
            paddingBottom: '32px'
          }}
        >
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

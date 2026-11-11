import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from './lib/queryClient';
import './styles/globals.css';

// The app shell is a fixed h-screen frame and <html> is overflow:hidden on
// those screens, so the page itself must never scroll. A scrollIntoView /
// focus() anywhere can still scroll it programmatically, which pushes the
// header + tabs off the top with no scrollbar to bring them back (Review
// "stuck" with blank space at the bottom). Snap it back whenever that happens.
window.addEventListener(
  'scroll',
  () => {
    const root = document.scrollingElement as HTMLElement | null;
    if (!root || !root.scrollTop) return;
    const hidden = (el: Element) => getComputedStyle(el).overflowY === 'hidden';
    if (hidden(document.documentElement) || hidden(document.body)) root.scrollTop = 0;
  },
  { passive: true }
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

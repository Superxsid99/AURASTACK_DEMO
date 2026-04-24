import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

const rootEl = document.getElementById('root');

const showBootError = (message: string) => {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div style="padding:16px;background:#1f2937;color:#f9fafb;font-family:Inter,Arial,sans-serif;line-height:1.5">
      <h2 style="margin:0 0 8px;font-size:16px;">Frontend Runtime Error</h2>
      <pre style="white-space:pre-wrap;margin:0;font-size:13px;">${message}</pre>
    </div>
  `;
};

window.addEventListener('error', (event) => {
  showBootError(event.error?.stack || event.message || 'Unknown runtime error');
});

window.addEventListener('unhandledrejection', (event) => {
  showBootError(`Unhandled promise rejection: ${String(event.reason)}`);
});

try {
  if (!rootEl) {
    throw new Error('Root element not found');
  }
  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
} catch (error) {
  const err = error as Error;
  showBootError(err.stack || err.message || 'Unknown boot error');
}

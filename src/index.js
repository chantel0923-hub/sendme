import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import UpdateBanner from './UpdateBanner';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
    <UpdateBanner />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Registers public/service-worker.js — required for SendMe to qualify as an
// installable PWA (Chrome's automatic "Add to Home Screen" prompt on
// Android depends on this). onUpdate fires when a new version has been
// downloaded and is waiting to activate; rather than swapping versions
// silently, that's surfaced as a visible "Refresh" prompt via UpdateBanner,
// since this app handles real donations and PayFast payments and should
// never leave someone running stale JS without their knowledge.
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    window.dispatchEvent(new CustomEvent('sendme-sw-update', { detail: registration }));
  },
});

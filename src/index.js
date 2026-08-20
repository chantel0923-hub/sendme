import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import WhatsAppSupportButton from './WhatsAppSupportButton';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
    <WhatsAppSupportButton />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// ROLLED BACK — the service worker registered here was correlated with an
// app freeze after login, reported shortly after this shipped. Rather than
// just stop registering NEW ones (which wouldn't remove an already-active
// service worker sitting on someone's device — service workers persist
// per-origin until explicitly unregistered), this actively unregisters
// any SendMe service worker still running from the previous deploy. This
// is a deliberate, temporary rollback while the freeze is root-caused —
// re-enable registration only once that's understood and confirmed safe.
serviceWorkerRegistration.unregister();


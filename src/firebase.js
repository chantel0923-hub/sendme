// firebase.js — Firebase Cloud Messaging (web push) client setup.
// Fill in the 6 values below from Firebase Console > Project Settings > General > Your apps,
// and the VAPID key from Project Settings > Cloud Messaging > Web configuration.
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            "AIzaSyCFyYLVemlqHrM_tt2m6lL25mlJYCoxeS8",
  authDomain:        "sendme-8709e.firebaseapp.com",
  projectId:         "sendme-8709e",
  storageBucket:     "sendme-8709e.firebasestorage.app",
  messagingSenderId: "275680285881",
  appId:             "1:275680285881:web:346732ebf2905be42df768",
};

const VAPID_KEY = "BH6J56v7jcADdQOHVBDUhuRrILkuG7SsNhskgAjmQf_QJ6Dt4X8j9JEoj6jnB0272zvb7pgqXQF2vQ06hgwcLbk";

const app = initializeApp(firebaseConfig);

// Asks the browser for notification permission, registers the service worker,
// and returns an FCM token identifying this browser/device.
export async function requestPushPermission() {
  try {
    const supported = await isSupported().catch(() => false);
    if (!supported || !("serviceWorker" in navigator)) {
      return { ok: false, reason: "unsupported" };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { ok: false, reason: "no-token" };
    return { ok: true, token };
  } catch (e) {
    console.error("requestPushPermission error:", e);
    return { ok: false, reason: "error" };
  }
}

// Optional: handle a push arriving while the tab is open and in focus
// (background/closed-tab notifications are handled by the service worker itself).
export function listenForegroundMessages(callback) {
  isSupported().then(supported => {
    if (!supported) return;
    const messaging = getMessaging(app);
    onMessage(messaging, callback);
  });
}

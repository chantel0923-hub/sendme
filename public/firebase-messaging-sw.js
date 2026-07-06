// firebase-messaging-sw.js — MUST be placed at /public/firebase-messaging-sw.js
// (served from the site root, e.g. https://sendme-nine.vercel.app/firebase-messaging-sw.js)
// This is what lets a push notification show up even when the tab is closed.
// Fill in the same 6 config values used in src/firebase.js.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyCFyYLVemlqHrM_tt2m6lL25mlJYCoxeS8",
  authDomain:        "sendme-8709e.firebaseapp.com",
  projectId:         "sendme-8709e",
  storageBucket:     "sendme-8709e.firebasestorage.app",
  messagingSenderId: "275680285881",
  appId:             "1:275680285881:web:346732ebf2905be42df768",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "SendMe", {
    body: body || "",
    icon: icon || "/logo192.png",
    data: (payload.fcmOptions || payload.data || {}),
  });
});

// Tapping the notification opens the linked mission (or home if no link was sent)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "/";
  event.waitUntil(clients.openWindow(link));
});

// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
// Using standard configurations for Legatrixon Firebase Project
firebase.initializeApp({
  apiKey: "placeholder-api-key",
  authDomain: "legatrixon-firebase.firebaseapp.com",
  projectId: "legatrixon-firebase",
  storageBucket: "legatrixon-firebase.appspot.com",
  messagingSenderId: "904542993845",
  appId: "1:904542993845:web:placeholder"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'LEGATRIXON Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'New notification received.',
    icon: '/logo.png',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

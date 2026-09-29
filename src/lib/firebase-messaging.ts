import { API_BASE_URL } from './api'
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase Web Configuration matching standard Legatrixon Firebase project
const firebaseConfig = {
  apiKey: "placeholder-api-key",
  authDomain: "legatrixon-firebase.firebaseapp.com",
  projectId: "legatrixon-firebase",
  storageBucket: "legatrixon-firebase.appspot.com",
  messagingSenderId: "904542993845",
  appId: "1:904542993845:web:placeholder"
};

// Standard general public VAPID key for Firebase Cloud Messaging
const VAPID_KEY = 'BCb_pD61Z65B5uL_0jL72vK5_W3J5r-5z-8V7e5XW8Wl5vM4mP5F-y5h-D5V7v5z-W-7n-w3y-Z5V5p-M-W-b-E';

export async function requestAndRegisterFcmToken(clerkGetToken: () => Promise<string | null>) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    console.log('Push notifications not supported in this environment.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Browser notification permission not granted.');
      return;
    }

    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    // Register Firebase service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('FCM Service Worker registered successfully:', registration.scope);

    // Retrieve FCM Device Token
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (currentToken) {
      console.log('Retrieved FCM Token:', currentToken);
      
      const apiToken = await clerkGetToken();
      if (!apiToken) {
        console.warn('Unable to retrieve Clerk token for registration.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/settings/notifications/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ fcmToken: currentToken })
      });

      if (response.ok) {
        console.log('Successfully registered FCM Token with backend settings.');
      } else {
        console.error('Failed to register FCM Token with backend:', response.statusText);
      }
    } else {
      console.warn('FCM Token not available.');
    }

    // Capture foreground push notifications
    onMessage(messaging, (payload) => {
      console.log('Foreground FCM notification received:', payload);
      if (payload.notification) {
        new Notification(payload.notification.title || 'LEGATRIXON Alert', {
          body: payload.notification.body,
          icon: '/logo.png'
        });
      }
    });

  } catch (err) {
    console.error('Error in requestAndRegisterFcmToken:', err);
  }
}


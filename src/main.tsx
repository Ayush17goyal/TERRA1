import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'

// Global Fetch Interceptor to catch AI limit hits and trigger popup alert
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  try {
    const response = await originalFetch(...args);
    if (!response.ok) {
      const clone = response.clone();
      try {
        const text = await clone.text();
        if (text.includes("Site is handling too many requests will be available in 15 minutes")) {
          alert("Site is handling too many requests will be available in 15 minutes");
        }
      } catch (e) {
        // Ignore clone reading errors
      }
    }
    return response;
  } catch (error: any) {
    if (error && error.message && error.message.includes("Site is handling too many requests will be available in 15 minutes")) {
      alert("Site is handling too many requests will be available in 15 minutes");
    }
    throw error;
  }
};


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!clerkPublishableKey) throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not configured')

const clerkLocalization = {
  unstable__errors: {
    form_identifier_not_found: "Enter student mail id only",
    user_not_found: "Enter student mail id only",
    email_address_invalid: "Enter student mail id only",
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey} localization={clerkLocalization}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
)

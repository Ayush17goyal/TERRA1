import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const featureChunk = (id: string) => {
  if (id.includes('/src/features/chat/')) return 'feature-chat'
  if (id.includes('/src/features/drafting/')) return 'feature-drafting'
  if (id.includes('/src/features/learning/')) return 'feature-learning'
  if (id.includes('/src/features/documents/')) return 'feature-documents'
  if (id.includes('/src/features/admin/')) return 'feature-admin'
  if (id.includes('/src/modules/moot-court/MemorialArchitect')) return 'module-moot-memorial'
  if (id.includes('/src/modules/moot-court/BenchSimulator')) return 'module-moot-bench'
  if (id.includes('/src/modules/moot-court/LegalResearchTrainer')) return 'module-moot-research'
  if (id.includes('/src/modules/moot-court/')) return 'module-moot-core'
  if (id.includes('/src/modules/learn-drafting/')) return 'module-learn-drafting'
  if (id.includes('/src/modules/draft-analyzer/')) return 'module-draft-analyzer'
  return undefined
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const clerkEnv = loadEnv(mode, path.resolve(__dirname, 'server'), 'NEXT_PUBLIC_CLERK_')
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'es2022',
      cssCodeSplit: true,
      sourcemap: mode !== 'production',
      assetsInlineLimit: 2048,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const feature = featureChunk(id)
            if (feature) return feature
            if (!id.includes('node_modules')) return undefined
            if (id.includes('@monaco-editor') || id.includes('monaco-editor')) return 'vendor-monaco'
            if (id.includes('pdfjs-dist') || id.includes('pdf-lib') || id.includes('pdf-parse')) return 'vendor-pdf'
            if (id.includes('jspdf') || id.includes('docx') || id.includes('pptxgenjs') || id.includes('html2canvas')) return 'vendor-export'
            if (id.includes('recharts')) return 'vendor-charts'
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('@clerk')) return 'vendor-auth'
            if (id.includes('@tanstack')) return 'vendor-query'
            if (id.includes('framer-motion')) return 'vendor-motion'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react'
            return 'vendor-misc'
          },
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
      exclude: ['monaco-editor', 'pdfjs-dist'],
    },
    define: {
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(clerkEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''),
    },
  }
})
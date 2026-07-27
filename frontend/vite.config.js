import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config updated for repository 'one-piece-card-trader'
export default defineConfig({
  plugins: [react()],
  base: '/one-piece-card-trader/'
})

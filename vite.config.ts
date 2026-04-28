import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/KontraRadar/' : '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

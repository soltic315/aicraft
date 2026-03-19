import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/aicraft/' : '/',
  server: {
    open: true,
  },
});

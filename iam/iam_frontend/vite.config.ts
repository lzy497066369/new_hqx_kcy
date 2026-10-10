import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            target: process.env.IAM_API_TARGET ?? 'http://localhost:3101',
            ws: true,
          },
        },
      },
    },
  };
});

import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['opencc-js']
      }
    }
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        include: ['sqlite3']
      })
    ],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    server: {
      watch: {
        ignored: ['**/.env*']
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          selection: resolve(__dirname, 'src/renderer/selection.html')
        }
      }
    }
  }
})

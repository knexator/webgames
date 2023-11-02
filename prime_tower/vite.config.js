import { defineConfig } from 'vite'

export default defineConfig(({ command, mode, ssrBuild }) => {
  if (command === 'serve') {
    // During development, we want to preview our game as hosted on itch.io
    return {
      base: './',
      build: {
        outDir: './dist',
        emptyOutDir: true,
        rollupOptions: {
          input: ['./itchio.html', './src/index.html']
        },
        target: 'esnext'
      },
      server: {
        open: 'itchio.html'
      }
    }
  } else if (command === 'build') {
    // At build time, we only build the game itself, not the itch.io container
    return {
      base: './',
      root: 'src',
      build: {
        outDir: '../dist',
        emptyOutDir: true,
        target: 'esnext'
      }
    }
  }
})

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Enable globals (describe, test, expect, vi, etc.)
    environment: 'node', // Specify Node environment for backend tests
  },
}); 
// App slice 1 (plan §9): PURE modules only, node environment. No jest-expo,
// no RN rendering tests — that's a bigger decision, not this slice.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});

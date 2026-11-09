import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

// list filters are persisted in sessionStorage — isolate tests from each other
afterEach(() => {
  try { sessionStorage.clear(); } catch { /* not a DOM environment */ }
});

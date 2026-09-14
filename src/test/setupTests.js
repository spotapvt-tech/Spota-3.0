// Runs before every Vitest test file (wired via vite.config.js `test.setupFiles`).
// Adds jest-dom's DOM matchers (toBeInTheDocument, toHaveTextContent, etc.)
// for any component tests written with React Testing Library.
import '@testing-library/jest-dom/vitest';

// Error monitoring — Sentry, gated behind an env var.
//
// Safe to import unconditionally: if VITE_SENTRY_DSN isn't set (no project
// yet, or a local dev build), initSentry() is a no-op — no dependency on
// Sentry actually being configured, no errors sent anywhere. Once a DSN is
// added to .env.local (or the hosting provider's env vars for
// staging/prod), this activates automatically.
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Conservative default: capture errors, skip session replay/tracing
    // until there's a reason to pay for the extra event volume.
    tracesSampleRate: 0
  });
}

// Wrap a component tree so render errors are reported instead of producing
// a blank screen. Usage: <SentryErrorBoundary fallback={...}><App /></SentryErrorBoundary>
export const SentryErrorBoundary = Sentry.ErrorBoundary;

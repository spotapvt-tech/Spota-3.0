import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, ArrowLeft } from 'lucide-react';
import './AuthView.css';

// Step constants
const STEP = {
  EMAIL:   'email',
  SIGNIN:  'signin',
  SIGNUP:  'signup',
  GUEST:   'guest',
};

export default function AuthView({ onClose }) {
  const { signIn, signUp, signInAnonymous } = useAuth();

  const [step, setStep]     = useState(STEP.EMAIL);
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [username, setUsername] = useState('');
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  const clearError = () => setError('');

  // ── Step 1: email submitted → decide new vs returning
  const handleEmailContinue = (e) => {
    e.preventDefault();
    clearError();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    // In a real app, you'd check if the user exists in Supabase here.
    // For now, we show both paths via toggle on Step 2.
    setStep(STEP.SIGNIN);
  };

  // ── Step 2a: Sign In
  const handleSignIn = async (e) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      await signIn(email, pass);
    } catch (err) {
      setError(err.message || 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2b: Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault();
    clearError();
    if (!username.trim()) { setError('Choose a username.'); return; }
    if (pass.length < 6)   { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await signUp(email, pass, username);
      setError('');
      alert('Account created! Check your email for a confirmation link, then sign in.');
      setStep(STEP.SIGNIN);
      setIsNewUser(false);
    } catch (err) {
      setError(err.message || 'Sign up failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  // ── Guest
  const handleGuest = (e) => {
    e.preventDefault();
    signInAnonymous(guestName.trim() || 'Guest Explorer');
  };

  // ── Back
  const goBack = () => {
    clearError();
    if (step === STEP.EMAIL) { onClose?.(); return; }
    setStep(STEP.EMAIL);
    setIsNewUser(false);
    setPass('');
  };

  return (
    <div className="auth-shell">
      {/* ── Top bar */}
      <div className="auth-topbar">
        <button className="auth-back-btn" onClick={goBack} aria-label="Back">
          {step === STEP.EMAIL ? null : <ArrowLeft size={20} />}
        </button>
        <span className="auth-logo">( spota )</span>
        {onClose ? (
          <button className="auth-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        ) : (
          <span style={{ width: 36 }} />
        )}
      </div>

      {/* ══════════════════════════════════
          STEP 1 — Email
      ══════════════════════════════════ */}
      {step === STEP.EMAIL && (
        <form className="auth-body" onSubmit={handleEmailContinue}>
          <h1 className="auth-headline">find your<br />hidden gem.</h1>

          <div className="auth-field-group">
            <input
              className={`auth-input ${error ? 'auth-input--error' : ''}`}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); }}
              autoFocus
              autoComplete="email"
            />
            {error && <p className="auth-error-text">{error}</p>}
          </div>

          <button className="auth-cta-btn" type="submit">
            Continue →
          </button>

          <button
            type="button"
            className="auth-link-btn"
            onClick={() => { clearError(); setStep(STEP.GUEST); }}
          >
            Explore as guest
          </button>
        </form>
      )}

      {/* ══════════════════════════════════
          STEP 2a — Sign In
      ══════════════════════════════════ */}
      {step === STEP.SIGNIN && !isNewUser && (
        <form className="auth-body" onSubmit={handleSignIn}>
          <h1 className="auth-headline">welcome<br />back.</h1>
          <p className="auth-sub">{email}</p>

          <div className="auth-field-group">
            <input
              className={`auth-input ${error ? 'auth-input--error' : ''}`}
              type="password"
              placeholder="Password"
              value={pass}
              onChange={(e) => { setPass(e.target.value); clearError(); }}
              autoFocus
              autoComplete="current-password"
            />
            {error && <p className="auth-error-text">{error}</p>}
          </div>

          <button className="auth-cta-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <button
            type="button"
            className="auth-link-btn"
            onClick={() => { setIsNewUser(true); clearError(); setPass(''); }}
          >
            New here? Create account
          </button>
        </form>
      )}

      {/* ══════════════════════════════════
          STEP 2b — Sign Up
      ══════════════════════════════════ */}
      {step === STEP.SIGNIN && isNewUser && (
        <form className="auth-body" onSubmit={handleSignUp}>
          <h1 className="auth-headline">looks like<br />you're new here</h1>

          <div className="auth-field-group">
            <input
              className="auth-input"
              type="text"
              placeholder="Username (e.g. zenexplorer)"
              value={username}
              onChange={(e) => { setUsername(e.target.value); clearError(); }}
              autoFocus
              maxLength={24}
            />
            <input
              className={`auth-input ${error ? 'auth-input--error' : ''}`}
              type="password"
              placeholder="Create a password (6+ chars)"
              value={pass}
              onChange={(e) => { setPass(e.target.value); clearError(); }}
              autoComplete="new-password"
            />
            {error && <p className="auth-error-text">{error}</p>}
          </div>

          <button className="auth-cta-btn" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Join Spota 💎'}
          </button>

          <button
            type="button"
            className="auth-link-btn"
            onClick={() => { setIsNewUser(false); clearError(); setPass(''); }}
          >
            Already have an account? Sign In
          </button>
        </form>
      )}

      {/* ══════════════════════════════════
          GUEST STEP
      ══════════════════════════════════ */}
      {step === STEP.GUEST && (
        <form className="auth-body" onSubmit={handleGuest}>
          <h1 className="auth-headline">pick your<br />explorer name</h1>
          <p className="auth-sub">No account needed. Start dropping gems.</p>

          <div className="auth-field-group">
            <input
              className="auth-input"
              type="text"
              placeholder="e.g. ZenWanderer"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              autoFocus
              maxLength={20}
            />
          </div>

          <button className="auth-cta-btn" type="submit">
            Explore Now →
          </button>
        </form>
      )}

      {/* ── Bottom tagline */}
      <p className="auth-tagline">( your world is waiting )</p>
    </div>
  );
}

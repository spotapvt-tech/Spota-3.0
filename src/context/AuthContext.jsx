import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedGuest = localStorage.getItem('spota_guest_user');
      return savedGuest ? JSON.parse(savedGuest) : null;
    } catch (e) {
      console.warn('LocalStorage blocked or unavailable on initial mount:', e);
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('spota_guest_user');
    } catch (e) {
      return true;
    }
  });

  // Helper to fetch custom profile from the profiles table
  const fetchUserProfile = async (authUser) => {
    if (!authUser || authUser.isGuest) return authUser;
    try {
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile query timeout')), 2500)
      );

      const result = await Promise.race([queryPromise, timeoutPromise]);
      const data = result?.data;
      const error = result?.error;
      
      if (!error && data) {
        return { 
          ...authUser, 
          // Inject database fields into the user state
          user_metadata: {
            ...authUser.user_metadata,
            username: data.username || authUser.user_metadata.username,
            reputation: data.reputation ?? authUser.user_metadata.reputation,
            is_verified: data.is_verified ?? authUser.user_metadata.is_verified,
            // Server-set only (see supabase_p0_security_fixes.sql) — never
            // trust a client-supplied value for this.
            is_admin: data.is_admin === true
          }
        };
      }

      // Self-heal: If profile table has no record for this user, insert it
      if (error && error.code === 'PGRST116') {
        const defaultUsername = authUser.user_metadata?.username || 
                                (authUser.email ? authUser.email.split('@')[0] : null) || 
                                `explorer_${authUser.id.substring(0, 8)}`;
        
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            username: defaultUsername,
            avatar_url: authUser.user_metadata?.avatar_url || null,
            reputation: 0,
            is_verified: false
          })
          .select()
          .single();

        if (!insertError && newProfile) {
          return {
            ...authUser,
            user_metadata: {
              ...authUser.user_metadata,
              username: newProfile.username,
              reputation: newProfile.reputation,
              is_verified: newProfile.is_verified
            }
          };
        }
      }
    } catch (e) {
      console.warn('Profiles table check bypassed or timed out, using cached metadata:', e);
    }
    return authUser;
  };

  // Handle Supabase Auth state changes
  useEffect(() => {
    const handleUserSession = async (session) => {
      if (session?.user) {
        // 1. Set user state immediately to the cached auth session user (optimistic load)
        setUser(session.user);
        setLoading(false);

        // 2. Fetch the enriched profile data in the background
        try {
          const enrichedUser = await fetchUserProfile(session.user);
          setUser(enrichedUser);
        } catch (e) {
          console.warn('Background profile enrichment failed:', e);
        }
      } else {
        // Fallback to local guest user if stored
        try {
          const savedGuest = localStorage.getItem('spota_guest_user');
          setUser(savedGuest ? JSON.parse(savedGuest) : null);
        } catch (e) {
          console.warn('LocalStorage fallback failed during session load:', e);
          setUser(null);
        }
        setLoading(false);
      }
    };

    // Check active session on load with robust error handling
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserSession(session);
    }).catch(err => {
      console.error('Error fetching auth session on load:', err);
      // Fail-safe fallback to guest session if offline
      try {
        const savedGuest = localStorage.getItem('spota_guest_user');
        if (savedGuest) {
          setUser(JSON.parse(savedGuest));
        }
      } catch (e) {
        console.warn('LocalStorage fallback failed on auth catch:', e);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      handleUserSession(session);
      if (session?.user) {
        // Clear guest session if real user logs in
        try {
          localStorage.removeItem('spota_guest_user');
        } catch (e) {
          console.warn('LocalStorage clear failed:', e);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email, password, username) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0],
            reputation: 0,
            is_verified: false
          }
        }
      });
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInAnonymous = useCallback((username = 'Guest Explorer') => {
    const guestUser = {
      id: `guest_${Math.random().toString(36).substr(2, 9)}`,
      email: 'guest@spota.local',
      isGuest: true,
      user_metadata: {
        username: username,
        reputation: 0,
        is_verified: false
      }
    };
    localStorage.setItem('spota_guest_user', JSON.stringify(guestUser));
    setUser(guestUser);
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('spota_guest_user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#F7F9F6',
        color: '#2C3531',
        fontFamily: "'Outfit', sans-serif"
      }}>
        <div className="pulse-loader" style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: '#6C8C74',
          animation: 'pulse 1.5s infinite ease-in-out'
        }} />
        <span style={{ marginTop: '16px', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>Loading Spota...</span>
        <style>{`
          @keyframes pulse {
            0% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(0.8); opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signUp,
      signIn,
      signInAnonymous,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

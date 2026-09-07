import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [adminProfile, setAdminProfile] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    () => localStorage.getItem('activity_tracker_selected_subject') || ''
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Load admin profile and associated subjects
  const loadAdminProfile = useCallback(async (userId, userEmail) => {
    if (!userId) {
      setAdminProfile(null);
      setSubjects([]);
      return;
    }

    setIsLoadingProfile(true);
    try {
      // 1. Fetch admin record
      const { data: profile, error } = await supabase
        .from('admins')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch admin profile:', error);
      }

      let currentProfile = profile;

      // Self-heal / seed first admin as super_admin if profile missing
      if (!currentProfile) {
        const { count } = await supabase.from('admins').select('*', { count: 'exact', head: true });
        const assignedRole = (count === 0 || count === null) ? 'super_admin' : 'teacher';
        const defaultName = userEmail ? userEmail.split('@')[0].toUpperCase() : 'ADMIN';

        const { data: inserted, error: insertErr } = await supabase
          .from('admins')
          .insert({
            id: userId,
            email: userEmail,
            full_name: defaultName,
            role: assignedRole,
          })
          .select()
          .single();

        if (!insertErr && inserted) {
          currentProfile = inserted;
        } else {
          // Fallback profile object in memory if DB insert is restricted
          currentProfile = {
            id: userId,
            email: userEmail,
            full_name: defaultName,
            role: assignedRole,
          };
        }
      }

      setAdminProfile(currentProfile);

      // 2. Fetch subjects for this admin (or all subjects if super_admin)
      let query = supabase.from('subjects').select('*').order('code', { ascending: true });
      if (currentProfile?.role !== 'super_admin') {
        query = query.eq('admin_id', userId);
      }

      const { data: subjectList, error: subjErr } = await query;
      if (!subjErr && subjectList) {
        setSubjects(subjectList);
        // Automatically select the first subject if none selected or invalid
        if (subjectList.length > 0) {
          const stored = localStorage.getItem('activity_tracker_selected_subject');
          const stillValid = subjectList.some((s) => s.id === stored);
          if (stillValid) {
            setSelectedSubjectId(stored);
          } else {
            setSelectedSubjectId(subjectList[0].id);
            localStorage.setItem('activity_tracker_selected_subject', subjectList[0].id);
          }
        } else {
          setSelectedSubjectId('');
        }
      }
    } catch (err) {
      console.error('Error in loadAdminProfile:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadAdminProfile(session.user.id, session.user.email);
      } else {
        setAdminProfile(null);
        setSubjects([]);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadAdminProfile(session.user.id, session.user.email);
      } else {
        setAdminProfile(null);
        setSubjects([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadAdminProfile]);

  const handleSelectSubject = (subjectId) => {
    setSelectedSubjectId(subjectId);
    if (subjectId) {
      localStorage.setItem('activity_tracker_selected_subject', subjectId);
    } else {
      localStorage.removeItem('activity_tracker_selected_subject');
    }
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAdminProfile(null);
    setSubjects([]);
    setSelectedSubjectId('');
    localStorage.removeItem('activity_tracker_selected_subject');
  };

  const refreshAdmin = async () => {
    if (session?.user) {
      await loadAdminProfile(session.user.id, session.user.email);
    }
  };

  const isSuperAdmin = adminProfile?.role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        session,
        adminProfile,
        isSuperAdmin,
        subjects,
        selectedSubjectId,
        setSelectedSubjectId: handleSelectSubject,
        refreshAdmin,
        isLoading: session === undefined || isLoadingProfile,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

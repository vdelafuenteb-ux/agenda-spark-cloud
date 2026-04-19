import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/integrations/firebase/config';
import { useAuth } from '@/hooks/useAuth';

export type UserRole = 'admin' | 'user';

export interface PendingUser {
  uid: string;
  email: string;
  display_name: string;
  created_at: string;
}

// Bootstrap admins: users whose emails match this list get auto-approved with
// `admin` role on first sign-in. Configure via VITE_ADMIN_EMAILS (comma-sep).
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);

export function useApproval() {
  const { user } = useAuth();
  const [approved, setApproved] = useState<boolean | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setApproved(null); setRole(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const ref = doc(firestore, 'users', user.id);
      const snap = await getDoc(ref);
      const email = (user.email || '').toLowerCase();
      const isBootstrapAdmin = ADMIN_EMAILS.includes(email);

      if (!snap.exists()) {
        const payload = {
          uid: user.id,
          email,
          display_name: (user.user_metadata?.name as string) || email.split('@')[0] || '',
          approved: isBootstrapAdmin,
          role: isBootstrapAdmin ? 'admin' : 'user',
          created_at: new Date().toISOString(),
        };
        await setDoc(ref, payload);
        if (!cancelled) { setApproved(payload.approved); setRole(payload.role as UserRole); }
      } else {
        const data = snap.data() as any;
        // Upgrade legacy docs that never got admin role set.
        if (isBootstrapAdmin && (data.role !== 'admin' || !data.approved)) {
          await updateDoc(ref, { approved: true, role: 'admin' });
          if (!cancelled) { setApproved(true); setRole('admin'); }
        } else {
          if (!cancelled) { setApproved(!!data.approved); setRole((data.role as UserRole) || 'user'); }
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const listPending = useCallback(async (): Promise<PendingUser[]> => {
    const q = query(collection(firestore, 'users'), where('approved', '==', false));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        uid: d.id,
        email: data.email,
        display_name: data.display_name || '',
        created_at: data.created_at || '',
      };
    });
  }, []);

  const approveUser = useCallback(async (uid: string) => {
    await updateDoc(doc(firestore, 'users', uid), { approved: true, approved_at: new Date().toISOString() });
  }, []);

  const rejectUser = useCallback(async (uid: string) => {
    await updateDoc(doc(firestore, 'users', uid), { approved: false, rejected: true, rejected_at: new Date().toISOString() });
  }, []);

  const isAdmin = role === 'admin';
  return { approved, role, isAdmin, loading, listPending, approveUser, rejectUser };
}

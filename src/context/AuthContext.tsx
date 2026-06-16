
'use client';
// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut as fbSignOut } from 'firebase/auth';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { getAuthInstance, getDbInstance } from '@/lib/firebase';

export type UserRole = 'admin' | 'manager' | 'staff' | 'owner';

interface AuthCtx {
  user:             User | null;
  role:             UserRole;
  staffDocId:       string | null;   // Firestore doc ID of the staff member
  passwordChanged:  boolean;         // false = needs to change temp password
  loading:          boolean;
  signOut:          () => Promise<void>;
  markPasswordChanged: () => Promise<void>; // call after successful password change
}

const AuthContext = createContext<AuthCtx>({
  user: null, role: 'staff', staffDocId: null,
  passwordChanged: true, loading: true,
  signOut: async () => {},
  markPasswordChanged: async () => {},
});

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner:   ['*'],
  admin:   ['*'],
  manager: [
    '/dashboard', '/reports',
    '/leads', '/parents', '/tutors', '/assignments',
    '/fees', '/attendance', '/communications', '/tasks',
    '/change-password', '/settings',
  ],
  staff: [
    '/dashboard',
    '/parents', '/tutors',
    '/communications', '/tasks',
    '/change-password',
  ],
};

export function canAccess(role: UserRole, path: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms.includes('*')) return true;
  return perms.some(p => path === p || path.startsWith(p + '/'));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,            setUser]            = useState<User | null>(null);
  const [role,            setRole]            = useState<UserRole>('staff');
  const [staffDocId,      setStaffDocId]      = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(true);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), async (u) => {
      setUser(u);
      if (u) {
        await fetchRole(u.email!);
      } else {
        setRole('staff');
        setStaffDocId(null);
        setPasswordChanged(true);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function fetchRole(email: string) {
    try {
      const db   = getDbInstance();
      const snap = await getDocs(query(collection(db, 'staff'), where('email', '==', email)));

      if (snap.empty) {
        // Not in staff collection = original owner/admin
        setRole('owner');
        setStaffDocId(null);
        setPasswordChanged(true); // owner never needs to change password
        return;
      }

      const staffDoc  = snap.docs[0];
      const data      = staffDoc.data();
      const staffRole = data.role as UserRole;

      setStaffDocId(staffDoc.id);
      setRole(data.status === 'inactive' ? 'staff' : staffRole || 'staff');

      // Check if they still need to change their temporary password
      setPasswordChanged(data.passwordChanged === true);

    } catch {
      // Firestore lookup failed = treat as owner
      setRole('owner');
      setStaffDocId(null);
      setPasswordChanged(true);
    }
  }

  // Called after staff successfully changes password
  async function markPasswordChanged() {
    if (!staffDocId) return;
    try {
      await updateDoc(doc(getDbInstance(), 'staff', staffDocId), { passwordChanged: true });
      setPasswordChanged(true);
    } catch (e) {
      console.error('Failed to mark password changed:', e);
    }
  }

  async function signOut() {
    await fbSignOut(getAuthInstance());
    setRole('staff');
    setStaffDocId(null);
    setPasswordChanged(true);
  }

  return (
    <AuthContext.Provider value={{ user, role, staffDocId, passwordChanged, loading, signOut, markPasswordChanged }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Firebase-backed compatibility shim for the Supabase client API used by the
// rest of the app. It preserves the import surface `supabase.from(...)`,
// `supabase.auth.*`, `supabase.storage.*`, `supabase.functions.invoke(...)`
// so consumers do not have to change. Not a full reimplementation — only the
// subset of the Supabase API this codebase actually calls.

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updatePassword,
  type User as FbUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  documentId,
  query as fsQuery,
  where,
  orderBy,
  limit as fsLimit,
  serverTimestamp,
  writeBatch,
  type Query,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

import {
  firebaseAuth,
  firestore,
  firebaseStorage,
  firebaseFunctions,
} from '@/integrations/firebase/config';

// ---------- Session shape compatible with @supabase/supabase-js ----------

export interface CompatUser {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  aud: string;
  created_at: string;
}

export interface CompatSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: 'bearer';
  user: CompatUser;
}

function toCompatUser(u: FbUser): CompatUser {
  return {
    id: u.uid,
    email: u.email,
    user_metadata: {
      name: u.displayName,
      avatar_url: u.photoURL,
    },
    app_metadata: {},
    aud: 'authenticated',
    created_at: u.metadata.creationTime || new Date().toISOString(),
  };
}

async function toCompatSession(u: FbUser | null): Promise<CompatSession | null> {
  if (!u) return null;
  const token = await u.getIdToken();
  return {
    access_token: token,
    refresh_token: u.refreshToken,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer' as const,
    user: toCompatUser(u),
  };
}

// ---------- Auth API ----------

const authApi = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const session = await toCompatSession(cred.user);
      return { data: { user: session!.user, session }, error: null };
    } catch (e: any) {
      return { data: { user: null, session: null }, error: { message: e.message, name: e.code } };
    }
  },

  async signUp({
    email,
    password,
  }: {
    email: string;
    password: string;
    options?: { emailRedirectTo?: string; data?: Record<string, unknown> };
  }) {
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const session = await toCompatSession(cred.user);
      return { data: { user: session!.user, session }, error: null };
    } catch (e: any) {
      return { data: { user: null, session: null }, error: { message: e.message, name: e.code } };
    }
  },

  async signOut() {
    try {
      await fbSignOut(firebaseAuth);
      return { error: null };
    } catch (e: any) {
      return { error: { message: e.message, name: e.code } };
    }
  },

  async getSession() {
    const u = firebaseAuth.currentUser;
    if (!u) {
      // Wait once for the first auth state event so a page refresh can resolve.
      const session = await new Promise<CompatSession | null>((resolve) => {
        const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
          unsub();
          resolve(await toCompatSession(user));
        });
      });
      return { data: { session }, error: null };
    }
    return { data: { session: await toCompatSession(u) }, error: null };
  },

  async getUser() {
    const u = firebaseAuth.currentUser;
    return { data: { user: u ? toCompatUser(u) : null }, error: null };
  },

  async updateUser({ password }: { password?: string; email?: string; data?: Record<string, unknown> }) {
    try {
      const u = firebaseAuth.currentUser;
      if (!u) throw new Error('No authenticated user');
      if (password) await updatePassword(u, password);
      return { data: { user: toCompatUser(u) }, error: null };
    } catch (e: any) {
      return { data: { user: null }, error: { message: e.message, name: e.code } };
    }
  },

  async resetPasswordForEmail(email: string, _opts?: { redirectTo?: string }) {
    try {
      await sendPasswordResetEmail(firebaseAuth, email, _opts?.redirectTo ? { url: _opts.redirectTo } : undefined);
      return { data: {}, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message, name: e.code } };
    }
  },

  onAuthStateChange(cb: (event: string, session: CompatSession | null) => void) {
    let previousUid: string | null = firebaseAuth.currentUser?.uid ?? null;
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      const session = await toCompatSession(user);
      const uid = user?.uid ?? null;
      let event = 'SIGNED_OUT';
      if (uid && !previousUid) event = 'SIGNED_IN';
      else if (uid && previousUid) event = 'TOKEN_REFRESHED';
      previousUid = uid;
      cb(event, session);
    });
    return {
      data: { subscription: { unsubscribe: unsub } },
    };
  },
};

// ---------- Firestore query builder that mimics PostgREST ----------

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
interface Filter {
  op: FilterOp;
  column: string;
  value: unknown;
}

interface OrderSpec {
  column: string;
  ascending: boolean;
}

class QueryBuilder {
  private filters: Filter[] = [];
  private orders: OrderSpec[] = [];
  private _limit: number | null = null;
  private _singleRow = false;
  private _maybeSingle = false;

  constructor(private tableName: string, private mode: 'select' | 'insert' | 'update' | 'delete' = 'select', private payload: any = null) {}

  // --- filter methods (return `this` to allow chaining) ---
  eq(column: string, value: unknown) { this.filters.push({ op: 'eq', column, value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ op: 'neq', column, value }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ op: 'gt', column, value }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ op: 'gte', column, value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ op: 'lt', column, value }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ op: 'lte', column, value }); return this; }
  in(column: string, values: unknown[]) { this.filters.push({ op: 'in', column, value: values }); return this; }
  is(column: string, value: unknown) { this.filters.push({ op: 'eq', column, value }); return this; }

  order(column: string, opts: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: opts.ascending !== false });
    return this;
  }

  limit(n: number) { this._limit = n; return this; }

  single(): Promise<any> { this._singleRow = true; return this.execute(); }
  maybeSingle(): Promise<any> { this._maybeSingle = true; return this.execute(); }
  select(_cols?: string): QueryBuilder { return this; }

  match(filter: Record<string, unknown>): QueryBuilder {
    for (const [k, v] of Object.entries(filter)) this.filters.push({ op: 'eq', column: k, value: v });
    return this;
  }

  then<T>(onFulfilled?: (v: any) => T, onRejected?: (e: any) => T) {
    return this.execute().then(onFulfilled, onRejected);
  }

  private applyConstraints(): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];
    for (const f of this.filters) {
      // Firestore docs don't store their ID as a field — queries on "id" must
      // use the documentId() sentinel instead of a literal field path.
      const ref = f.column === 'id' ? documentId() : f.column;
      switch (f.op) {
        case 'eq': constraints.push(where(ref as any, '==', f.value)); break;
        case 'neq': constraints.push(where(ref as any, '!=', f.value)); break;
        case 'gt': constraints.push(where(ref as any, '>', f.value)); break;
        case 'gte': constraints.push(where(ref as any, '>=', f.value)); break;
        case 'lt': constraints.push(where(ref as any, '<', f.value)); break;
        case 'lte': constraints.push(where(ref as any, '<=', f.value)); break;
        case 'in': constraints.push(where(ref as any, 'in', f.value as unknown[])); break;
      }
    }
    for (const o of this.orders) {
      constraints.push(orderBy(o.column, o.ascending ? 'asc' : 'desc'));
    }
    if (this._limit != null) constraints.push(fsLimit(this._limit));
    return constraints;
  }

  private async execute(returnInserted = false): Promise<any> {
    const colRef = collection(firestore, this.tableName);
    try {
      if (this.mode === 'select') {
        const q: Query<DocumentData> = fsQuery(colRef, ...this.applyConstraints());
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (this._singleRow) {
          if (rows.length === 0) return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
          return { data: rows[0], error: null };
        }
        if (this._maybeSingle) {
          return { data: rows[0] ?? null, error: null };
        }
        return { data: rows, error: null };
      }

      if (this.mode === 'insert') {
        const items: any[] = Array.isArray(this.payload) ? this.payload : [this.payload];
        const created: any[] = [];
        for (const item of items) {
          const withTimestamps = {
            ...item,
            created_at: item.created_at ?? new Date().toISOString(),
            updated_at: item.updated_at ?? new Date().toISOString(),
          };
          if (item.id) {
            await setDoc(doc(colRef, item.id), withTimestamps);
            created.push({ id: item.id, ...withTimestamps });
          } else {
            const ref = await addDoc(colRef, withTimestamps);
            created.push({ id: ref.id, ...withTimestamps });
          }
        }
        if (this._singleRow) return { data: created[0], error: null };
        if (returnInserted) return { data: created, error: null };
        return { data: created, error: null };
      }

      if (this.mode === 'update') {
        // Fast path: single eq on 'id' → operate on the doc directly, no query.
        const idEq = this.filters.find((f) => f.op === 'eq' && f.column === 'id');
        const onlyIdFilter = idEq && this.filters.length === 1;
        if (onlyIdFilter && typeof idEq.value === 'string') {
          const ref = doc(colRef, idEq.value);
          await updateDoc(ref, { ...this.payload, updated_at: new Date().toISOString() } as any);
          if (this._singleRow) {
            const snap = await getDoc(ref);
            return { data: snap.exists() ? { id: snap.id, ...snap.data() } : null, error: null };
          }
          return { data: null, error: null };
        }
        const q: Query<DocumentData> = fsQuery(colRef, ...this.applyConstraints());
        const snap = await getDocs(q);
        const updated: any[] = [];
        const batch = writeBatch(firestore);
        for (const d of snap.docs) {
          batch.update(d.ref, { ...this.payload, updated_at: new Date().toISOString() });
          updated.push({ id: d.id, ...d.data(), ...this.payload });
        }
        await batch.commit();
        if (this._singleRow) return { data: updated[0] ?? null, error: null };
        return { data: updated, error: null };
      }

      if (this.mode === 'delete') {
        // Fast path: single eq on 'id' → delete the doc directly.
        const idEq = this.filters.find((f) => f.op === 'eq' && f.column === 'id');
        const onlyIdFilter = idEq && this.filters.length === 1;
        if (onlyIdFilter && typeof idEq.value === 'string') {
          await deleteDoc(doc(colRef, idEq.value));
          return { data: null, error: null };
        }
        const q: Query<DocumentData> = fsQuery(colRef, ...this.applyConstraints());
        const snap = await getDocs(q);
        const batch = writeBatch(firestore);
        for (const d of snap.docs) batch.delete(d.ref);
        await batch.commit();
        return { data: null, error: null };
      }
    } catch (e: any) {
      return { data: null, error: { message: e.message, code: e.code || 'unknown' } };
    }
  }
}

// ---------- Table API ----------

function fromTable(tableName: string) {
  return {
    select(_cols?: string) { return new QueryBuilder(tableName, 'select'); },
    insert(payload: any) { return new QueryBuilder(tableName, 'insert', payload); },
    update(payload: any) { return new QueryBuilder(tableName, 'update', payload); },
    delete() { return new QueryBuilder(tableName, 'delete'); },
    upsert(payload: any) {
      // Naive upsert — treat like insert with explicit IDs.
      return new QueryBuilder(tableName, 'insert', payload);
    },
  };
}

// ---------- Storage API ----------

function storageBucket(bucket: string) {
  return {
    async upload(path: string, file: File | Blob, _opts?: any) {
      try {
        const r = storageRef(firebaseStorage, `${bucket}/${path}`);
        await uploadBytes(r, file);
        return { data: { path }, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e.message } };
      }
    },
    getPublicUrl(path: string) {
      // Firebase Storage public URLs require an async fetch for a download token.
      // For parity with Supabase (which is sync), we return a best-effort URL that
      // works when the object has public read rules. For tokenized URLs, call
      // `createSignedUrl` instead. Consumers that need a real URL should be
      // migrated to `await createSignedUrl(path)`.
      const encoded = encodeURIComponent(`${bucket}/${path}`);
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}/o/${encoded}?alt=media`;
      return { data: { publicUrl } };
    },
    async createSignedUrl(path: string, _expiresIn?: number) {
      try {
        const r = storageRef(firebaseStorage, `${bucket}/${path}`);
        const url = await getDownloadURL(r);
        return { data: { signedUrl: url }, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e.message } };
      }
    },
    async remove(paths: string[]) {
      try {
        await Promise.all(
          paths.map((p) => deleteObject(storageRef(firebaseStorage, `${bucket}/${p}`))),
        );
        return { data: null, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e.message } };
      }
    },
  };
}

// ---------- Functions API ----------

// Supabase Edge Functions use kebab-case names ('send-notification-email'),
// Cloud Functions deploy with the JS export name (camelCase). Normalize here
// so existing `functions.invoke('send-x')` call sites don't need to change.
function kebabToCamel(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

const functionsApi = {
  async invoke(name: string, options?: { body?: any; headers?: Record<string, string> }) {
    try {
      const callable = httpsCallable(firebaseFunctions, kebabToCamel(name));
      const result = await callable(options?.body ?? {});
      return { data: result.data, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message, name: e.code } };
    }
  },
};

// ---------- Public client ----------

export const supabase = {
  auth: authApi,
  from: fromTable,
  storage: { from: storageBucket },
  functions: functionsApi,
  // Not implemented — surfaced as noisy errors so regressions are caught.
  rpc(_name: string, _params?: any) {
    throw new Error('supabase.rpc() is not supported in the Firebase port. Port this call to a Cloud Function or Firestore query.');
  },
  channel(_name: string) {
    throw new Error('Realtime channels are not implemented in the Firebase port. Use onSnapshot() directly from firebase/firestore if realtime is needed.');
  },
  removeChannel(_c: unknown) {
    /* no-op */
  },
};

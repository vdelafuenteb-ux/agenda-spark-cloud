// Shared utilities for Cloud Functions.
// Ports of supabase/functions/*/index.ts live in this codebase. The originals
// depended on Supabase Postgres + Deno; these use Firestore + Node.

import * as admin from 'firebase-admin';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

export const FIREBASE_EMAIL_URL =
  'https://us-central1-sistemattransit.cloudfunctions.net/correoAdministracion';

export const APP_URL = 'https://project-zenflow-66.lovable.app';

export const CC_TEAM = [
  'matias@transitglobalgroup.com',
  'vicente@transitglobalgroup.com',
];

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

export function chileDate(): { day: number; hour: number; dateStr: string } {
  const chileTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const dateStr = `${chileTime.getFullYear()}-${String(chileTime.getMonth() + 1).padStart(2, '0')}-${String(chileTime.getDate()).padStart(2, '0')}`;
  return { day: chileTime.getDay(), hour: chileTime.getHours(), dateStr };
}

export function requireAuth(request: CallableRequest<unknown>): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  return request.auth.uid;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
}): Promise<{ status: number; body: string }> {
  if (!params.to || !params.to.includes('@')) {
    throw new Error(`Destinatario inválido: "${params.to}"`);
  }
  const cc = (params.cc ?? CC_TEAM).filter(
    (addr) => addr && addr.toLowerCase() !== params.to.toLowerCase(),
  );

  const payload: Record<string, unknown> = {
    para: params.to,
    asunto: params.subject,
    mensaje: params.html,
  };
  if (cc.length > 0) payload.cc = cc;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    console.log(`[sendEmail] POST ${FIREBASE_EMAIL_URL} to=${params.to} cc=${cc.length} subject="${params.subject.slice(0, 80)}"`);
    const res = await fetch(FIREBASE_EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.text();
    console.log(`[sendEmail] <= status=${res.status} body=${body.slice(0, 200)}`);
    if (!res.ok) {
      throw new Error(`correoAdministracion respondió ${res.status}: ${body.slice(0, 300)}`);
    }
    return { status: res.status, body };
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error('Timeout (15s) esperando respuesta del endpoint de correo');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// -------- Firestore helpers --------

export function db() {
  return admin.firestore();
}

export async function getUserEmail(uid: string): Promise<string | null> {
  try {
    const u = await admin.auth().getUser(uid);
    return u.email ?? null;
  } catch {
    return null;
  }
}

// Mint a new update_tokens doc. Returns the token string (also the doc id).
export async function createUpdateToken(params: {
  userId: string;
  assigneeName: string;
  topicId?: string | null;
  ttlDays?: number;
}): Promise<string> {
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = new Date(Date.now() + (params.ttlDays ?? 7) * 24 * 60 * 60 * 1000).toISOString();
  await db().collection('update_tokens').doc(token).set({
    token,
    user_id: params.userId,
    assignee_name: params.assigneeName,
    topic_id: params.topicId ?? null,
    used: false,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });
  return token;
}

// Find a reusable unused/unexpired token for (userId, assigneeName), else mint one.
export async function getOrCreateUpdateToken(params: {
  userId: string;
  assigneeName: string;
  topicId?: string | null;
}): Promise<string> {
  const nowIso = new Date().toISOString();
  const snap = await db()
    .collection('update_tokens')
    .where('user_id', '==', params.userId)
    .where('assignee_name', '==', params.assigneeName)
    .where('used', '==', false)
    .where('expires_at', '>', nowIso)
    .limit(1)
    .get();
  if (!snap.empty) return (snap.docs[0].data().token as string) ?? snap.docs[0].id;
  return createUpdateToken(params);
}

export function jsonResponse(body: unknown, status = 200): { status: number; body: unknown } {
  return { status, body };
}

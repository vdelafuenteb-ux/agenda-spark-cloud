# Port de Supabase → Firebase

Proyecto portado al Firebase project `agenda-d5b56`.

## Estado

### ✅ Listo y compila

- **Frontend**: `npm run build` pasa, `npx tsc --noEmit` pasa.
- **Adapter Supabase→Firebase** en `src/integrations/supabase/client.ts`. Los
  37 archivos consumidores no se tocaron.
  - Auth (signIn, signUp, signOut, reset, onAuthStateChange, getSession, getUser, updateUser) → Firebase Auth.
  - Queries (`from(t).select/insert/update/delete/eq/in/gt/gte/lt/lte/neq/order/limit/single/maybeSingle/match`) → Firestore.
  - Storage (upload, getPublicUrl, createSignedUrl, remove) → Firebase Storage.
  - `functions.invoke('kebab-case-name', {body})` → `httpsCallable(camelCaseName)`.
- **13 Cloud Functions** portadas y compiladas en `functions/lib/`:

| Supabase Edge Function | Cloud Function export | Trigger |
|---|---|---|
| send-notification-email | `sendNotificationEmail` | onCall (auth) |
| send-bulk-notification | `sendBulkNotification` | onCall (auth) |
| send-new-topic-notification | `sendNewTopicNotification` | onCall (auth) |
| send-topic-closed-notification | `sendTopicClosedNotification` | onCall (auth) |
| send-incident-notification | `sendIncidentNotification` | onCall (auth) |
| send-reminder-email | `sendReminderEmail` | onCall (admin) |
| send-topic-reminders | `sendTopicReminders` + `sendTopicRemindersScheduled` | onCall + schedule (hourly) |
| mark-email-responded | `markEmailResponded` | onRequest (public, HTML) |
| validate-update-token | `validateUpdateToken` | onCall (public) |
| submit-update | `submitUpdate` | onCall (public) |
| save-score-snapshots | `saveScoreSnapshots` + `saveScoreSnapshotsScheduled` | onCall + schedule (daily 07:00 CL) |
| send-daily-summary | `sendDailySummary` + `sendDailySummaryScheduled` | onCall + schedule (daily 07:30 CL) |
| send-scheduled-emails | `sendScheduledEmails` + `sendScheduledEmailsScheduled` | onCall + schedule (hourly) |

- **Firebase project files**: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`.

### ⚠️ Antes de producción (trabajo manual)

1. **`firestore.rules` es permisivo** (cualquier usuario autenticado puede
   leer/escribir). Endurecer traduciendo las RLS policies en
   `supabase/migrations/` a reglas Firestore por colección (workspace
   membership, ownership, etc.). Si no haces esto, cualquier usuario
   autenticado puede ver los datos de otros.

2. **Índices Firestore**. `firestore.indexes.json` está vacío. Al desplegar y
   usar la app, la consola de Firebase sugerirá índices necesarios para las
   queries compuestas (varios `where` + `orderBy`). Acéptalos ahí o añádelos
   manualmente.

3. **Datos**. Firestore se crea vacío — tablas se materializan al insertar.
   Si quieres migrar data existente de Supabase, hay que exportar CSV/JSON y
   escribir un script de import.

4. **Migración de usuarios Supabase → Firebase Auth** (si aplica). Los users
   de Supabase no se migran automáticamente. Usa `firebase auth:import` con
   un export de Supabase si necesitas conservar cuentas existentes.

5. **Variables de entorno de Functions**. Las funciones usan un endpoint
   público de correo (`correoAdministracion`), así que no necesitan secrets
   para email. Si quieres mover el endpoint a uno tuyo, actualiza
   `FIREBASE_EMAIL_URL` en `functions/src/_shared.ts`.

6. **Lógica compleja por re-verificar**. Los ports preservan la semántica
   pero cambian storage engines. Casos a revisar con datos reales:
   - Tokens de actualización: ahora el `token` es el doc ID en Firestore
     (antes era columna en tabla). El frontend sigue usando `/update/:token`
     (URL) y las funciones validan via `db().collection('update_tokens').doc(token).get()`.
   - Consultas `in` sobre más de 30 IDs se chunkan (`validate-update-token`,
     `save-score-snapshots`, `send-daily-summary`, `send-scheduled-emails`).
   - `topic_reminders` → en vez de `select('*, topics(...)')` hacemos
     fetch por topic_id (Firestore no joinea).

## Ejecutar en local

```bash
# Frontend
npm install --legacy-peer-deps
npm run dev          # http://localhost:5173

# Functions (compilar)
cd functions && npm install && npm run build

# Emulators (auth + firestore + functions + storage + hosting)
npm install -g firebase-tools
firebase login
firebase emulators:start
```

## Desplegar

```bash
firebase use agenda-d5b56

# Frontend
npm run build
firebase deploy --only hosting

# Functions
cd functions && npm run build && cd ..
firebase deploy --only functions

# Reglas + índices
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## Variables de entorno (.env)

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=agenda-d5b56.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=agenda-d5b56
VITE_FIREBASE_STORAGE_BUCKET=agenda-d5b56.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=911361369779
VITE_FIREBASE_APP_ID=1:911361369779:web:01277cde53212c5a7872c6
VITE_FIREBASE_FUNCTIONS_REGION=us-central1
```

## Supabase legacy

La carpeta `supabase/` se conserva como referencia del schema original y las
Edge Functions. No afecta runtime. Borrarla cuando valides que todo funciona.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { requireAuth, sendEmail } from './_shared';

// Diagnostic endpoint that sends a minimal email to the requested address and
// surfaces any failure reason to the caller. Use from Settings → "Probar email".
export const testEmail = onCall(async (request) => {
  requireAuth(request);
  const { to } = (request.data ?? {}) as { to?: string };
  if (!to || !to.includes('@')) throw new HttpsError('invalid-argument', 'Email destinatario inválido');
  try {
    const res = await sendEmail({
      to,
      subject: '✅ Prueba de correo — Agenda TT',
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:600px;margin:0 auto;">
        <h2 style="color:#2563eb;">Correo de prueba</h2>
        <p>Este es un correo de prueba enviado desde el sistema <strong>Agenda TT</strong> para verificar la conexión con el servicio de correo.</p>
        <p>Si recibes este mensaje, la configuración está funcionando correctamente.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
        <p style="font-size:11px;color:#999;">Puedes ignorar este correo.</p>
      </div>`,
      cc: [],
    });
    return { success: true, status: res.status };
  } catch (e: any) {
    console.error('[testEmail] failed:', e);
    throw new HttpsError('internal', e?.message || 'Error enviando correo de prueba');
  }
});

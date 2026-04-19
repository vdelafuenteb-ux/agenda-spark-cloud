import { onRequest } from 'firebase-functions/v2/https';
import { corsHeaders, db } from './_shared';

function buildHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8f9fa;color:#333;}.card{background:white;border-radius:12px;padding:40px;max-width:480px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.1);}h1{font-size:24px;margin-bottom:16px;}p{font-size:16px;color:#666;line-height:1.6;}</style>
</head><body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

// Public endpoint hit from email links — no auth, returns HTML.
export const markEmailResponded = onRequest(async (req, res) => {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  const ids = (req.query.ids as string) || '';
  const idList = ids.split(',').map((id) => id.trim()).filter(Boolean);
  if (idList.length === 0) {
    res.status(400).type('html').send(buildHtml('Error', 'No se proporcionaron IDs válidos.'));
    return;
  }

  try {
    const batch = db().batch();
    for (const id of idList) {
      batch.update(db().collection('notification_emails').doc(id), {
        responded: true,
        responded_at: new Date().toISOString(),
      });
    }
    await batch.commit();
    res.status(200).type('html').send(
      buildHtml('✅ ¡Confirmación recibida!', `Se registró tu actualización correctamente (${idList.length} tema${idList.length > 1 ? 's' : ''}).<br/><br/>Gracias por responder. Puedes cerrar esta pestaña.`),
    );
  } catch (e) {
    console.error('mark-email-responded error:', e);
    res.status(500).type('html').send(buildHtml('Error', 'No se pudo registrar tu confirmación.'));
  }
});

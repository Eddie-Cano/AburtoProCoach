import { createHash } from 'node:crypto';
import { extractEmail, extractPhone, saveLeadCore, syncLeadToCrm } from './_leadcore.js';
import { sendTransactionalEmail } from './_email.js';

const ANDRES_EMAIL = 'aburtocoaching@gmail.com';
const hash = value => createHash('sha256').update(String(value || '')).digest('hex');

function clean(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    if (req.headers.origin && req.headers.origin !== `https://${req.headers.host}`) {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ error: 'Datos inválidos.' }); }
    }

    const service = clean(body?.service, 140);
    const name = clean(body?.name, 100);
    const phone = extractPhone(clean(body?.phone, 40));
    const email = extractEmail(clean(body?.email, 160));
    const message = clean(body?.message, 1000);
    const consent = body?.consent === true;

    if (!service || name.length < 2 || !phone || !email || message.length < 3 || !consent) {
      return res.status(400).json({ error: 'Completa nombre, número, correo, mensaje y autorización de contacto.' });
    }

    const allowedServices = new Set([
      'Coaching 1 a 1',
      'Bodybuilding Training System',
      'Trainer Presencial',
      'Posing Coaching | Aburto Team',
      'Preparación para Competencia',
    ]);
    if (!allowedServices.has(service)) {
      return res.status(400).json({ error: 'Servicio no válido.' });
    }

    const submissionId = hash(`${service}:${name}:${email}:${phone}:${Date.now()}`).slice(0, 24);
    const summary = [
      'Nueva consulta de disponibilidad — Andrés Aburto Pro Coach',
      '',
      `Servicio: ${service}`,
      `Nombre: ${name}`,
      `Número: ${phone}`,
      `Correo: ${email}`,
      '',
      '¿Qué necesita saber?',
      message,
      '',
      `Origen: ${req.headers.referer || req.headers.origin || `https://${req.headers.host}`}`,
    ].join('\n');

    let core = { saved: false };
    try {
      core = await saveLeadCore({
        name,
        phone,
        email,
        source: 'consulta-disponibilidad',
        interest: service,
        priority: 'high',
        summary: `${name} consulta disponibilidad para ${service}. ${message}`,
        notes: 'Solicitud directa desde la sección Elige tu siguiente nivel.',
        metadata: {
          service,
          message,
          consent: true,
          type: 'availability_inquiry',
        },
      });
    } catch {
      core = { saved: false };
    }

    let crmDelivery = { synced: false, queued: false };
    try {
      crmDelivery = await syncLeadToCrm({
        id: core.leadId || `AB-CONS-${submissionId.slice(0, 10)}`,
        leadId: core.leadId || '',
        projectId: core.projectId || '',
        createdAt: core.createdAt || new Date().toISOString(),
        channel: 'Consulta',
        source: 'Web — Consultar disponibilidad',
        name,
        email,
        phone,
        interest: service,
        modality: service.includes('Presencial') ? 'Presencial' : 'Por confirmar',
        experience: '',
        timing: '',
        message,
        route: service,
        status: 'Nuevo',
        priority: 'Alta',
        owner: 'Andrés Aburto',
        consent: 'Sí',
        originUrl: req.headers.referer || req.headers.origin || `https://${req.headers.host}`,
        notes: 'Dar seguimiento por correo/teléfono. No es una compra.',
        dedupeId: core.leadId || submissionId,
      });
    } catch {
      crmDelivery = { synced: false, queued: false };
    }

    let emailResult;
    try {
      emailResult = await sendTransactionalEmail({
        to: [ANDRES_EMAIL],
        subject: `Consulta de disponibilidad: ${service} — ${name}`,
        text: summary,
        idempotencyKey: `aburto/availability/${submissionId}`,
        tags: [{ name: 'category', value: 'availability_inquiry' }],
      });
    } catch {
      return res.status(503).json({ error: 'La solicitud no pudo enviarse por correo. Intenta nuevamente.' });
    }

    if (!emailResult?.sent) {
      return res.status(503).json({ error: 'El correo de la solicitud no pudo enviarse. Intenta nuevamente.' });
    }

    return res.status(200).json({
      ok: true,
      service,
      saved: core.saved === true,
      crmSynced: crmDelivery.synced === true,
      emailed: true,
    });
  } catch {
    return res.status(503).json({ error: 'No se pudo procesar la consulta.' });
  }
}

import { generateText, APICallError } from 'ai';

const SYSTEM = `Eres el asistente de orientación inicial de Andrés Aburto Pro Coach.

Información autorizada:
- Andrés trabaja entrenamiento personalizado, nutrición deportiva, preparación competitiva y posing.
- La primera colección digital está en desarrollo: "5 claves antes de competir", "Posing intensivo" y "Diario de progreso".
- Comunidad, tienda, precios, fechas, disponibilidad y alcance final todavía no están confirmados públicamente.
- El canal público actual es Instagram: @andrsaburto.

Tu objetivo es orientar y calificar, no diagnosticar ni vender agresivamente. Responde en español mexicano, directo, amable y profesional, con máximo 90 palabras. Haz sólo una pregunta breve cuando falte información. No inventes logros, resultados, precios, disponibilidad, ubicaciones ni características. No prescribas dietas, calorías, suplementos, fármacos, diuréticos, agua o sodio. Ante síntomas, lesiones, trastornos alimentarios o decisiones médicas, recomienda valoración profesional. Si el usuario está listo, resume su objetivo y sugiere contactar al equipo por Instagram.`;

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-10).map((message) => ({
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    content: String(message?.content || '').slice(0, 800),
  })).filter((message) => message.content.trim());
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); }
    catch { return res.status(400).json({ error: 'Solicitud inválida.' }); }
  }
  const messages = cleanMessages(body.messages);
  if (!messages.length) return res.status(400).json({ error: 'Escribe una pregunta para continuar.' });
  try {
    const { text } = await generateText({
      model: 'openai/gpt-5.4-mini',
      system: SYSTEM,
      messages,
      maxOutputTokens: 220,
      providerOptions: { gateway: { tags: ['feature:aburto-assistant', 'stage:first-layer'] } },
    });
    return res.status(200).json({ text });
  } catch (error) {
    if (APICallError.isInstance(error) && [401, 402, 403, 429].includes(error.statusCode)) return res.status(503).json({ error: 'El asistente generativo está temporalmente fuera de servicio.' });
    console.error('aburto-assistant', error);
    return res.status(503).json({ error: 'No fue posible procesar la consulta.' });
  }
}

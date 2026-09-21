# Andrés Aburto — primera capa funcional

Sitio de presentación, tienda de servicios, herramientas y productos digitales.

## Alcance público actual

- Presentación de Andrés, servicios, método y trayectoria.
- Guía digital “5 Claves Antes de Competir” publicada a $300 MXN.
- Posing Intensivo y Diario de Progreso visibles como “Próximamente”.
- Tienda con Coaching 1 a 1, Bodybuilding Training System, Trainer Presencial, Posing Coaching y Preparación para Competencia.
- Asistente conversacional con ruta guiada y respuesta generativa mediante Vercel AI Gateway.
- Resumen de solicitud con copia automática por correo y continuación directa por WhatsApp.

La comunidad y el merch permanecen fuera de la experiencia pública hasta una fase posterior.

## Stripe

El catálogo live de Raíz Noble contiene cinco productos. Coaching 1 a 1 es un solo producto con dos precios: online y presencial. Los seis Payment Links están activos y documentados en `stripe-catalog.json`; usan Checkout alojado por Stripe y métodos de pago dinámicos. No se habilitó Stripe Tax.

Los botones principales llevan al checkout. Cada servicio conserva una opción secundaria para hablar con el asistente; esas solicitudes siguen entrando al CRM y generan la alerta de WhatsApp correspondiente.

Los IDs no secretos del catálogo están documentados en `stripe-catalog.json`. No guardar claves privadas ni secretos de webhook en Git.

## Desarrollo

```bash
npm install
npx vercel dev
```

El endpoint `api/chat.js` usa AI SDK y AI Gateway. En producción requiere AI Gateway habilitado para el proyecto de Vercel. Si el servicio generativo no está disponible, la ruta guiada y las respuestas locales continúan funcionando.

## Pendientes de validación con Andrés

- Biografía, credenciales y campeonatos publicados.
- Ubicación, disponibilidad y fechas de inicio.
- Fecha de lanzamiento de Posing Intensivo y Diario de Progreso.
- Canal definitivo de recepción y almacenamiento de leads.
- Dominio oficial.

## Herramientas gratuitas y registro compartido

Calculadora de macros y temporizador de posing en `#herramientas`. Durante la revisión actual, ambas herramientas están en acceso abierto y muestran resultados sin solicitar nombre, correo ni teléfono. El sistema de registro permanece en el código para reactivarlo posteriormente. No se guarda información corporal ni se suscribe a publicidad.

`api/access.js` usa Upstash Redis privado. Conectar una instancia al proyecto Vercel y configurar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en Production; después redesplegar. Sin ambas variables el sitio indica que el registro abrirá próximamente: no simula guardados ni desbloquea resultados. La conexión actual de Vercel no tiene acceso al equipo raiz-noble; el aprovisionamiento sigue pendiente.

Los contactos están en claves `aburto:lead:<sha256 del correo normalizado>`, con nombre, correo, teléfono, fecha y versión del consentimiento. Las sesiones HttpOnly/Secure duran 180 días. Otro navegador permite recuperar el acceso gratuito con correo y teléfono coincidentes, sin mostrar datos personales; esto no autentica compras ni da acceso a expedientes. No hay listado público de prospectos. Revisar contactos desde la consola privada de Upstash. Para eliminar un registro borrar su clave y todas las sesiones que la referencien. No confundir este mecanismo con un sistema de identidad verificada.


Durante la etapa de pruebas, los registros nuevos de las herramientas y las solicitudes finalizadas en el asistente envían una copia operativa a `raiznoblemx@gmail.com` mediante Resend. Configurar `RESEND_API_KEY` en Vercel y, opcionalmente, `LEAD_FROM_EMAIL` para usar un remitente verificado. El cierre del asistente también prepara el resumen para enviarlo por WhatsApp a `+52 228 278 0491`; el botón abre el chat correcto con el resumen precargado y WhatsApp requiere que el visitante pulse **Enviar** en su aplicación. Si Resend no está configurado o falla, el registro en Redis continúa funcionando y no se pierden los datos. La notificación de herramientas envía un correo operativo separado a Raíz Noble y una confirmación independiente al correo del interesado. Ambos incluyen únicamente nombre, correo, teléfono y fecha; nunca envían edad, peso, estatura ni resultados de macros. Para entregar correos a direcciones externas, `LEAD_FROM_EMAIL` debe usar un dominio verificado en Resend. El asistente envía nombre, contacto, interés, experiencia, modalidad y momento estimado para comenzar. Las solicitudes del asistente también se guardan temporalmente en Redis durante 30 días.

Revisar con Andrés los criterios orientativos de la calculadora. La interfaz compara Mifflin–St Jeor, Harris–Benedict revisada (Roza–Shizgal) y Tinsley. Tinsley usa la variante por masa libre de grasa cuando el usuario proporciona un porcentaje de grasa y, en caso contrario, la variante por peso corporal. El gasto diario se estima multiplicando el gasto en reposo por un factor total editable de 1.20 a 2.60; la intensidad del entrenamiento se registra como contexto y no se multiplica de nuevo. Los factores 2.40–2.60 se señalan como excepcionales. Proteína 1.6 g/kg, grasas 30% y carbohidratos restantes; adultos sanos, sin protocolos de peak week. Ningún dato corporal sale del navegador. Referencias incluidas en la interfaz. El temporizador se pausa cuando se oculta la pestaña.

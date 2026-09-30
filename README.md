# Andrés Aburto — primera capa funcional

Sitio de presentación, tienda de servicios, herramientas y productos digitales.

## Alcance público actual

- Presentación de Andrés, servicios, método y trayectoria.
- Biblioteca digital: “El Día 29” ($526), “Romantizar la Prep” ($526) y “5 Claves Antes de Competir” ($320), en MXN.
- Posing Intensivo en desarrollo; Starter Pack y la edición Founding 100 preparados para apertura.
- Tienda con Coaching 1 a 1, Bodybuilding Training System, Trainer Presencial, Posing Coaching y Preparación para Competencia.
- Asistente conversacional con ruta guiada y respuesta generativa mediante Vercel AI Gateway.
- El asistente registra solicitudes. Las alertas de venta por WhatsApp y correo corresponden a pagos confirmados.

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
- Fecha de apertura de Founding 100, lanzamiento y precio exclusivo de Posing Intensivo.
- Canal definitivo de recepción y almacenamiento de leads.
- Dominio oficial.

## Herramientas gratuitas y registro compartido

Calculadora de macros y temporizador de posing en `#herramientas`. Durante la revisión actual, ambas herramientas están en acceso abierto y muestran resultados sin solicitar nombre, correo ni teléfono. El sistema de registro permanece en el código para reactivarlo posteriormente. No se guarda información corporal ni se suscribe a publicidad.

`api/access.js` usa Upstash Redis privado. Conectar una instancia al proyecto Vercel y configurar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en Production; después redesplegar. Sin ambas variables el sitio indica que el registro abrirá próximamente: no simula guardados ni desbloquea resultados. La conexión actual de Vercel no tiene acceso al equipo raiz-noble; el aprovisionamiento sigue pendiente.

Los contactos están en claves `aburto:lead:<sha256 del correo normalizado>`, con nombre, correo, teléfono, fecha y versión del consentimiento. Las sesiones HttpOnly/Secure duran 180 días. Otro navegador permite recuperar el acceso gratuito con correo y teléfono coincidentes, sin mostrar datos personales; esto no autentica compras ni da acceso a expedientes. No hay listado público de prospectos. Revisar contactos desde la consola privada de Upstash. Para eliminar un registro borrar su clave y todas las sesiones que la referencien. No confundir este mecanismo con un sistema de identidad verificada.


Durante la etapa de pruebas, los registros nuevos de las herramientas y las solicitudes finalizadas en el asistente envían una copia operativa a `raiznoblemx@gmail.com` mediante Resend. Configurar `RESEND_API_KEY` en Vercel y, opcionalmente, `LEAD_FROM_EMAIL` para usar un remitente verificado. El cierre del asistente también prepara el resumen para enviarlo por WhatsApp a `+52 228 278 0491`; el botón abre el chat correcto con el resumen precargado y WhatsApp requiere que el visitante pulse **Enviar** en su aplicación. Si Resend no está configurado o falla, el registro en Redis continúa funcionando y no se pierden los datos. La notificación de herramientas envía un correo operativo separado a Raíz Noble y una confirmación independiente al correo del interesado. Ambos incluyen únicamente nombre, correo, teléfono y fecha; nunca envían edad, peso, estatura ni resultados de macros. Para entregar correos a direcciones externas, `LEAD_FROM_EMAIL` debe usar un dominio verificado en Resend. El asistente envía nombre, contacto, interés, experiencia, modalidad y momento estimado para comenzar. Las solicitudes del asistente también se guardan temporalmente en Redis durante 30 días.

## Correo transaccional de compra

### Acceso privado con Google OIDC

La entrega usa `GCP_PROJECT_NUMBER`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` y `GCP_SERVICE_ACCOUNT_EMAIL`. El correo debe ser el de la cuenta de servicio (`.iam.gserviceaccount.com`), no una API key. No requiere una clave privada JSON.

En el proveedor Google Workload Identity, la audiencia permitida del token Vercel es `https://vercel.com/raiz-noble`. La audiencia del intercambio STS identifica al proveedor Google y es un valor diferente. La cuenta de servicio necesita la vinculación Workload Identity User para el proyecto y entorno autorizados, acceso de editor a los tres PDF y las APIs Drive e IAM Service Account Credentials habilitadas. El token solicita los alcances Drive y Sheets. La cuenta de servicio requiere acceso de editor a los tres PDF y a la hoja global; habilitar Google Sheets API. Las ventas se sincronizan directamente con Sheets; el webhook de CRM existente sigue siendo compatible cuando se configura.

La entrega de productos digitales usa Resend desde funciones de Vercel. La plantilla en `api/_email.js` agradece la compra, identifica el producto, muestra el botón de acceso privado de Google Drive y, cuando `TELEGRAM_WAITLIST_URL` está configurada, ofrece el registro voluntario a la lista de espera. Cada envío usa una clave de idempotencia basada en el Checkout Session, con progreso durable de entrega, para impedir duplicados durante reintentos.

Variables de producción:

- `RESEND_API_KEY`: la integración de Resend en Vercel puede crearla y guardarla automáticamente.
- `PURCHASE_FROM_EMAIL`: remitente verificado, por ejemplo `Aburto Pro Coach <compras@aburtoprocoach.com>`.
- `PURCHASE_REPLY_TO_EMAIL`: correo que recibirá las respuestas de compradores.
- `SITE_URL`: `https://www.aburtoprocoach.com`.
- `TELEGRAM_WAITLIST_URL`: URL HTTPS del formulario de consentimiento, cuando esté publicado.

La vista previa no envía mensajes y queda disponible en `/api/email-preview?producto=dia-29`; también acepta `5-claves` y `romantizar`. El estado seguro de configuración se consulta en `/api/health` sin exponer secretos.

Revisar con Andrés los criterios orientativos de la calculadora. La interfaz compara Mifflin–St Jeor, Harris–Benedict revisada (Roza–Shizgal) y Tinsley. Tinsley usa la variante por masa libre de grasa cuando el usuario proporciona un porcentaje de grasa y, en caso contrario, la variante por peso corporal. El gasto diario se estima multiplicando el gasto en reposo por un factor total editable de 1.20 a 2.60; la intensidad del entrenamiento se registra como contexto y no se multiplica de nuevo. Los factores 2.40–2.60 se señalan como excepcionales. Proteína 1.6 g/kg, grasas 30% y carbohidratos restantes; adultos sanos, sin protocolos de peak week. Ningún dato corporal sale del navegador. Referencias incluidas en la interfaz. El temporizador se pausa cuando se oculta la pestaña.

## Starter Pack / Founding 100

- Página de campaña: `/founding-members.html`. Landing del paquete: `/productos/starter-pack.html`.
- Total individual: $1,372. Apertura: $960.40 (30% exacto). Posterior: $1,050 (23.469% de ahorro, mostrado como aproximadamente 23%).
- La ventana para iniciar una compra Founding termina al llegar a 100 miembros confirmados o 72 horas desde `FOUNDING_START_AT`, lo que suceda primero. Un checkout iniciado dentro de la ventana conserva el precio hasta su expiración (hasta una hora; mínimo 31 minutos cerca del cierre, por el mínimo de Stripe). No se abren nuevas reservas fuera de la ventana.
- El cupo se reserva con un script Lua atómico en Redis, incluyendo reservas en proceso. La identidad es el hash del correo normalizado; el correo del Customer de Stripe queda fijado antes del Checkout. Una membresía por correo. No se usan contadores de visitantes ni temporizadores que reinicien por navegador.
- Las reservas sólo se liberan tras `checkout.session.expired` firmado o un error definitivo al crear Checkout. Un timeout conserva la reserva para recuperar el mismo checkout con idempotencia.
- El webhook confirma membresía, registra la venta, concede los tres accesos privados y envía un agradecimiento con tres botones y el número Founding. Continúa las notificaciones a Raíz Noble y actualiza el progreso en Sheets. Las claves de membresía, permisos y progreso no caducan automáticamente.
- Un reembolso completo revoca los accesos de esa compra y Founding Access, conservando otros derechos sobre el mismo archivo. Los reembolsos parciales no revocan la entrega. Los números usados no se reasignan.
- Sheets: Ventas A:AH (34 columnas); Founding Members A:R (18 columnas). La sincronización deduplica por Checkout Session. Configuración lanzamiento documenta la oferta y la fecha, pero el reloj autoritativo se configura en Vercel.
- Founding Access: aviso privado, acceso anticipado y precio exclusivo para **comprar** Posing Intensivo más adelante. No se incluye el curso en el paquete; no inventar fecha ni porcentaje de descuento para él.

### Conexiones necesarias antes de abrir

1. `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` para los cupos y el progreso durable.
2. Cuenta Google OIDC válida (`GCP_SERVICE_ACCOUNT_EMAIL` con dominio `.iam.gserviceaccount.com`), permiso de editor a los tres PDF y a la hoja global; APIs Drive, Sheets e IAM Credentials.
3. Resend configurado con remitente verificado (ya conectado en producción).
4. `STRIPE_SECRET_KEY` del mismo account Raíz Noble: Checkout Sessions y Customers. `STRIPE_WEBHOOK_SECRET` del endpoint `/api/stripe-webhook`; eventos checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired, charge.refunded, charge.dispute.created.
5. `FOUNDING_START_AT` con fecha ISO y zona horaria, por ejemplo el instante de apertura acordado con Andrés. Sin fecha, la página permanece en preparación y no inicia la cuenta regresiva.

La compra permanece cerrada si faltan conexiones; `/api/commerce` devuelve configuración sin secretos. La vista previa `/api/email-preview?producto=founding-100` usa datos de ejemplo y no envía mensajes. El código de pruebas simula pagos y proveedores sin cargos ni envíos reales. La validación real de Drive, Sheets y Stripe debe completarse antes de abrir.

El plan gratuito de Resend tiene 100 correos/día. El Starter Pack consume un único correo por comprador, con los tres accesos; el aviso interno queda en Sheets y WhatsApp. La copia interna por email es opcional mediante `SEND_PACK_SALES_EMAIL=true` y consumiría un segundo correo por compra. Los demás envíos del sitio también consumen cuota. El progreso guardado evita repetir correos durante los reintentos del webhook. Supervisar los pendientes de entrega en Sheets si se agota la cuota; no presentar un email enviado hasta que el proveedor lo confirme.

Stripe verificado el 30 de septiembre de 2026: catálogo y precios del pack ($960.40/$1,050) y de los dos libros de $526 creados en la cuenta Raíz Noble. Los secretos de API y firma están guardados únicamente en Vercel Production. El endpoint de Stripe está desactivado mientras se verifica Redis y Google; activarlo antes de abrir la campaña. Los identificadores públicos están en `stripe-catalog.json`.

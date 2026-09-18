# Andrés Aburto — primera capa funcional

Sitio de presentación, orientación y validación de productos digitales.

## Alcance público actual

- Presentación de Andrés, servicios, método y trayectoria.
- Primera colección digital: guía de competencia, curso de posing y diario de progreso.
- Lista prioritaria sin cobros ni descargas hasta validar contenido, precio y fecha.
- Asistente conversacional con ruta guiada y respuesta generativa mediante Vercel AI Gateway.
- Resumen de solicitud para continuar el contacto por Instagram.

La comunidad, la tienda, el merch y el carrito fueron retirados de la experiencia pública hasta una fase posterior.

## Desarrollo

```bash
npm install
npx vercel dev
```

El endpoint `api/chat.js` usa AI SDK y AI Gateway. En producción requiere AI Gateway habilitado para el proyecto de Vercel. Si el servicio generativo no está disponible, la ruta guiada y las respuestas locales continúan funcionando.

## Pendientes de validación con Andrés

- Biografía, credenciales y campeonatos publicados.
- Modalidades, ubicación, disponibilidad y precios.
- Contenido y fecha de lanzamiento de los tres productos.
- Canal definitivo de recepción y almacenamiento de leads.
- Dominio oficial.

## Herramientas gratuitas y registro compartido

Calculadora de macros, checklist de organización competitiva y temporizador de posing en `#herramientas`. El registro se solicita antes de revelar resultados o iniciar el temporizador. Requiere nombre, correo, teléfono y consentimiento de acceso. No se guarda información corporal ni se suscribe a publicidad.

`api/access.js` usa Upstash Redis privado. Conectar una instancia al proyecto Vercel y configurar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en Production; después redesplegar. Sin ambas variables el sitio indica que el registro abrirá próximamente: no simula guardados ni desbloquea resultados. La conexión actual de Vercel no tiene acceso al equipo raiz-noble; el aprovisionamiento sigue pendiente.

Los contactos están en claves `aburto:lead:<sha256 del correo normalizado>`, con nombre, correo, teléfono, fecha y versión del consentimiento. Las sesiones HttpOnly/Secure duran 180 días. Otro navegador permite recuperar el acceso gratuito con correo y teléfono coincidentes, sin mostrar datos personales; esto no autentica compras ni da acceso a expedientes. No hay listado público de prospectos. Revisar contactos desde la consola privada de Upstash. Para eliminar un registro borrar su clave y todas las sesiones que la referencien. No confundir este mecanismo con un sistema de identidad verificada.

Revisar con Andrés los criterios orientativos de la calculadora y checklist. Cálculo educativo Mifflin–St Jeor, proteína 1.6 g/kg, grasas 30% y carbohidratos restantes; adultos sanos, sin protocolos de peak week. Referencias incluidas en la interfaz. El temporizador se pausa cuando se oculta la pestaña.

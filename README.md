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

# TinyMindKids Production Render Queue V1

Backend de producción inicial para Render.

## Qué agrega

- Cola real de trabajos.
- Estados:
  - queued
  - generating_story
  - generating_images
  - generating_voice
  - rendering_video
  - ready
  - failed
- Progreso.
- Endpoint para consultar job.
- Compatibilidad con `/api/create-full-video`.
- Archivos generados en `/renders`.

## Variables Render

```txt
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-1
PUBLIC_BASE_URL=https://tinymind-mp4-render-server.onrender.com
```

## Render

Build command:

```txt
npm install
```

Start command:

```txt
npm start
```

## Rutas

```txt
GET /api/health
POST /api/jobs
GET /api/jobs/:id
GET /api/jobs
POST /api/create-full-video
```

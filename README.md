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


## V2 Placeholder Mode

Agrega en Render:

```txt
USE_PLACEHOLDER_IMAGES=true
```

Esto evita llamar OpenAI Images cuando la cuenta/IP esté bloqueada por `detected_unusual_activity`.
El sistema seguirá generando historia, voz y MP4 usando imágenes temporales.


## V3 Debug Endpoints

Agregado para diagnosticar sin tocar frontend:

```txt
GET /api/test-openai
GET /api/test-openai-image
GET /api/test-elevenlabs
GET /api/test-full-local
```

Variables útiles:

```txt
USE_PLACEHOLDER_IMAGES=true
USE_LOCAL_STORY=true
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-1
```


## V4 OpenAI TTS

Agregado:
- OpenAI TTS como voz principal.
- ElevenLabs queda como respaldo.
- Nuevo endpoint:

```txt
GET /api/test-openai-tts
```

Variables Render:

```txt
USE_OPENAI_TTS=true
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
```

No borres ElevenLabs; queda como backup.

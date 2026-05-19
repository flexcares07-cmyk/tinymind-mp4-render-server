# TinyMindKids Render Visual AI V3

Actualización para crear videos con imágenes reales IA + voz + MP4.

## Variables necesarias en Render

```txt
OPENAI_API_KEY=tu_openai_key
ELEVENLABS_API_KEY=tu_elevenlabs_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-1
```

Opcional:

```txt
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

## Rutas nuevas

```txt
GET /api/health
POST /api/generate-story
POST /api/generate-images
POST /api/generate-voice
POST /api/render-mp4
POST /api/create-full-video
```

## Recomendación de Render

Para crear videos con imágenes y voz, usa mínimo 2 GB RAM.

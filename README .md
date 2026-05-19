# TinyMindKids Render AI V2

Servidor actualizado para Render.

## Variables necesarias en Render

```txt
OPENAI_API_KEY=tu_key_openai_nueva
ELEVENLABS_API_KEY=tu_key_elevenlabs
OPENAI_MODEL=gpt-4.1-mini
```

Opcional:

```txt
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

## Rutas

```txt
GET /api/health
POST /api/generate-story
POST /api/generate-voice
POST /api/render-mp4
POST /api/create-full-video
```

## Render

Build Command:

```txt
npm install
```

Start Command:

```txt
npm start
```

## Prueba

```txt
https://tinymind-mp4-render-server.onrender.com/api/health
```

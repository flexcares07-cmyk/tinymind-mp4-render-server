# TinyMindKids Render Visual AI

Backend con OpenAI, imágenes IA, ElevenLabs y FFmpeg.

Variables en Render:
OPENAI_API_KEY
ELEVENLABS_API_KEY
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-1
PUBLIC_BASE_URL=https://tinymind-mp4-render-server.onrender.com

Rutas:
GET /api/health
POST /api/generate-story
POST /api/generate-voice
POST /api/render-mp4
POST /api/create-full-video

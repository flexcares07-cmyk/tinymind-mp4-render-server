# TinyMind Kids Studio — Premium 3-Min Video App

App premium para crear videos infantiles de 3 minutos mínimos.

## Qué incluye
- UI premium PWA
- Generador de guion con OpenAI
- 15 escenas x 12 segundos = 180 segundos
- Prompts visuales por escena
- Voz TTS por escena
- Imagen IA por escena
- Timeline exportable listo para render
- Guardrails de seguridad infantil

## Variables Netlify
OPENAI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TEXT_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy

## Importante
Netlify Functions no es ideal para renderizar MP4 pesado de 3 minutos.
Para video final MP4 agrega:
- FFmpeg server
- Remotion Cloud
- Runway / Pika / Replicate
- Firebase Storage o Cloudflare R2

## Deploy
Netlify → Deploy manually → subir ZIP.
Luego agregar variables y hacer Redeploy.

# TinyMind MP4 AI Backend

Incluye:
- create-script con OpenAI
- generate-scene con imagen IA y voz IA
- render-mp4 con FFmpeg

Render:
Runtime: Docker

Variables necesarias para imagen/voz real:
OPENAI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy

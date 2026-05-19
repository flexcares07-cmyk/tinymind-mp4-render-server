# TinyMind MP4 Render Server

Servidor para generar un MP4 básico desde 15 escenas.

## Render settings

Build Command:
npm install

Start Command:
node server.js

## Importante

Este servidor necesita FFmpeg disponible en Render. Si Render Free no trae FFmpeg, agregaremos Dockerfile en el siguiente paso.

## Routes

GET /api/health
POST /api/render-mp4

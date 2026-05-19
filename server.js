const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.options("*", cors());
app.use(express.json({ limit: "80mb" }));

const outDir = path.join(__dirname, "renders");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "alloy";

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

function esc(text = "") {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\n/g, " ");
}

function svgPreview(title, subtitle) {
  const safeTitle = String(title || "TinyMind Kids").replace(/[<>&]/g, "");
  const safeSub = String(subtitle || "Preview IA").replace(/[<>&]/g, "").slice(0, 90);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0%" stop-color="#8B5CF6"/><stop offset="52%" stop-color="#EC4899"/><stop offset="100%" stop-color="#FDE68A"/></linearGradient></defs>
  <rect width="1280" height="720" rx="34" fill="#10172F"/>
  <circle cx="175" cy="170" r="96" fill="#34D399" opacity="0.9"/>
  <circle cx="1080" cy="170" r="130" fill="#8B5CF6" opacity="0.55"/>
  <rect x="110" y="470" width="1060" height="115" rx="35" fill="url(#g)" opacity="0.95"/>
  <text x="640" y="120" fill="#ffffff" text-anchor="middle" font-size="64" font-family="Arial" font-weight="900">TinyMind Kids</text>
  <text x="640" y="250" fill="#FDE68A" text-anchor="middle" font-size="54" font-family="Arial" font-weight="900">${safeTitle}</text>
  <text x="640" y="540" fill="#06131A" text-anchor="middle" font-size="36" font-family="Arial" font-weight="900">${safeSub}</text>
</svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

function fallbackScript(idea, language, ageRange, style) {
  return `Dino aprende a compartir

En un valle colorido vivía Dino, un pequeño dinosaurio que amaba sus juguetes. Un día llegaron Tina y Max para jugar con él, pero Dino no quería compartir.

Al principio Dino pensó que sería más feliz jugando solo, pero pronto notó que nadie celebraba sus torres, nadie corría con sus carritos y nadie se reía con sus rugidos.

Cuando la pelota de Max cayó cerca del río, Dino decidió ayudar. Tomó una rama larga y empujó la pelota hasta la orilla. Max sonrió y compartió su pelota con Dino.

Dino entendió que compartir no significa perder sus cosas, sino ganar momentos felices con amigos. Desde ese día, Dino abrió su caja de juguetes y todos jugaron juntos.

Moraleja: compartir hace que la diversión sea más grande.

Edad: ${ageRange}
Idioma: ${language}
Estilo: ${style}`;
}

function buildStoryFromScript(script, body) {
  const clean = String(script || "").trim();
  const parts = clean.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  const titles = ["Inicio colorido","Llegan los amigos","El problema","Dino juega solo","Algo sucede","Dino ayuda","El rescate","Un gesto amable","La lección","La disculpa","Todos juegan","Construyen juntos","Risas y amistad","Moraleja","Final feliz"];
  return {
    title: "TinyMind Kids Video",
    durationSec: 180,
    ageRange: body.ageRange || "4-7",
    language: body.language || "español",
    style: body.style || "3D cartoon premium",
    logline: `Video educativo infantil sobre ${body.idea || body.topic || "amistad"}`,
    scenes: Array.from({ length: 15 }).map((_, i) => ({
      id: `scene-${i+1}`,
      durationSec: 12,
      title: titles[i],
      narration: parts[i] || parts[Math.floor(i/2)] || clean.slice(i*220, (i+1)*220),
      visualPrompt: `${body.style || "3D cartoon premium"}, video infantil seguro, colores vivos, personaje tierno, ${body.idea || body.topic || ""}, escena ${i+1}, no text, no logos`,
      motionPrompt: "movimiento de cámara suave, ambiente alegre, animación tranquila",
      learningGoal: body.lesson || "compartir, amistad y resolver problemas con calma"
    })),
    youtube: { title: "TinyMind Kids Video", description: clean, tags: ["infantil","educativo","TinyMind"] }
  };
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    app: "TinyMind MP4 AI Render Server",
    status: "live",
    openaiConfigured: Boolean(openai),
    model: MODEL,
    imageModel: IMAGE_MODEL,
    ttsModel: TTS_MODEL,
    routes: ["GET /api/health", "POST /api/create-script", "POST /api/generate-scene", "POST /api/render-mp4"]
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "live", openaiConfigured: Boolean(openai), model: MODEL });
});

app.post("/api/create-script", async (req, res) => {
  const body = req.body || {};
  const idea = body.idea || body.topic || "Un dinosaurio pequeño aprende a compartir sus juguetes con sus amigos";
  try {
    if (!openai) {
      const script = fallbackScript(idea, body.language, body.ageRange, body.style);
      return res.json({ ok: true, mode: "fallback-no-openai-key", script, story: buildStoryFromScript(script, body) });
    }
    const prompt = `Crea un guion infantil seguro de 3 minutos en ${body.language || "español"} para edad ${body.ageRange || "4-7"}.
Idea: ${idea}
Estilo: ${body.style || "3D cartoon premium"}
Lección: ${body.lesson || "compartir y amistad"}
Devuelve solo el guion narrativo listo para convertir en 15 escenas.`;
    const r = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: "Eres guionista experto en contenido infantil seguro, educativo y visual." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });
    const script = r.choices?.[0]?.message?.content || fallbackScript(idea, body.language, body.ageRange, body.style);
    res.json({ ok: true, mode: "openai", script, story: buildStoryFromScript(script, body) });
  } catch (e) {
    const script = fallbackScript(idea, body.language, body.ageRange, body.style);
    res.json({ ok: true, mode: "fallback-openai-error", error: e.message, script, story: buildStoryFromScript(script, body) });
  }
});

app.post("/api/generate-scene", async (req, res) => {
  const scene = req.body?.scene || {};
  const generateImage = req.body?.generateImage !== false;
  const generateVoice = req.body?.generateVoice !== false;

  let image = null;
  let audio = null;
  let imageError = null;
  let audioError = null;

  if (openai && generateImage) {
    try {
      const img = await openai.images.generate({
        model: IMAGE_MODEL,
        prompt: scene.visualPrompt || scene.title || "cute kids cartoon scene, safe, colorful",
        size: "1024x1024"
      });
      const b64 = img.data?.[0]?.b64_json;
      if (b64) image = `data:image/png;base64,${b64}`;
      else imageError = "No image data returned";
    } catch (e) {
      imageError = e.message;
    }
  }

  if (openai && generateVoice) {
    try {
      const speech = await openai.audio.speech.create({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: (scene.narration || "TinyMind Kids").slice(0, 3500)
      });
      const buffer = Buffer.from(await speech.arrayBuffer());
      audio = `data:audio/mpeg;base64,${buffer.toString("base64")}`;
    } catch (e) {
      audioError = e.message;
    }
  }

  if (!image) image = svgPreview(scene.title || "Escena IA", scene.narration || "Preview de escena");
  if (!audio && !audioError) audioError = openai ? null : "OPENAI_API_KEY no configurada en este backend";

  res.json({
    ok: true,
    assets: {
      image,
      audio,
      imageError,
      audioError,
      visualPrompt: scene.visualPrompt,
      voiceText: scene.narration,
      status: "ready"
    }
  });
});

app.post("/api/render-mp4", async (req, res) => {
  try {
    const story = req.body?.story;
    if (!story || !Array.isArray(story.scenes)) return res.status(400).json({ ok: false, error: "story.scenes is required" });

    const id = Date.now().toString();
    const listFile = path.join(outDir, `${id}-list.txt`);
    const finalFile = path.join(outDir, `${id}.mp4`);
    const scenes = story.scenes.slice(0, 15);
    const tempVideos = [];

    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const sceneFile = path.join(outDir, `${id}-scene-${i}.mp4`);
      tempVideos.push(sceneFile);
      const title = esc(s.title || `Escena ${i + 1}`);
      const narration = esc((s.narration || "").slice(0, 120));
      const duration = Number(s.durationSec || 12);

      await new Promise((resolve, reject) => {
        const args = ["-y","-f","lavfi","-i",`color=c=0x10172F:s=1280x720:d=${duration}`,"-vf",
          `drawbox=x=40:y=40:w=1200:h=640:color=0x202B55@0.85:t=fill,drawtext=text='TinyMind Kids':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=90,drawtext=text='${title}':fontcolor=0xFDE68A:fontsize=44:x=(w-text_w)/2:y=190,drawtext=text='${narration}':fontcolor=white:fontsize=30:x=90:y=330:box=1:boxcolor=0x000000@0.25:boxborderw=20`,
          "-pix_fmt","yuv420p","-r","30",sceneFile];
        execFile("ffmpeg", args, (err) => err ? reject(err) : resolve());
      });
    }

    fs.writeFileSync(listFile, tempVideos.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));

    await new Promise((resolve, reject) => {
      execFile("ffmpeg", ["-y","-f","concat","-safe","0","-i",listFile,"-c","copy",finalFile], (err) => err ? reject(err) : resolve());
    });

    const publicPath = `/renders/${path.basename(finalFile)}`;
    res.json({ ok: true, status: "rendered", videoUrl: `${req.protocol}://${req.get("host")}${publicPath}`, file: path.basename(finalFile) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use("/renders", express.static(outDir));

app.listen(PORT, () => console.log(`TinyMind MP4 AI backend running on port ${PORT}`));

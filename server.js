const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();
const PORT = process.env.PORT || 10000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "80mb" }));

const outDir = path.join(__dirname, "renders");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
app.use("/renders", express.static(outDir));

function safeId(prefix = "tinymind") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanText(text = "", max = 1400) {
  return String(text)
    .replace(/[^\w\s.,!?¿¡áéíóúÁÉÍÓÚñÑ:-]/g, "")
    .slice(0, max);
}

function publicUrl(req, file) {
  const base = PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${base}/renders/${file}`;
}

function runFfmpeg(args, timeout = 420000) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, { timeout }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr ? String(stderr).slice(-2000) : error.message));
      else resolve({ stdout, stderr });
    });
  });
}

async function generateStoryData({ topic, durationSeconds = 180, sceneCount = 6 }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing.");

  const prompt = `
Crea una historia infantil segura, dulce, educativa y visual para niños.
Tema: ${topic}
Duración aproximada: ${durationSeconds} segundos.
Número de escenas: ${sceneCount}.

Devuelve SOLO JSON válido:
{
  "title": "título corto",
  "summary": "resumen corto",
  "narration": "narración completa en español, natural y cálida",
  "scenes": [
    {
      "text": "narración corta de esta escena",
      "visualPrompt": "prompt visual detallado para imagen infantil 3D animada, colores vivos, personajes tiernos, sin texto ni letras en la imagen"
    }
  ]
}
No uses markdown.
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "Eres un creador profesional de cuentos infantiles seguros, educativos y visuales." },
        { role: "user", content: prompt }
      ],
      temperature: 0.85
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data).slice(0, 1200));

  const content = data.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(content);
  } catch {
    return {
      title: "Historia infantil",
      summary: "",
      narration: content,
      scenes: [{ text: content, visualPrompt: "cute animated 3D children's story scene, bright colors, friendly characters, no text" }]
    };
  }
}

async function generateImageFile(prompt, index) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing.");

  const finalPrompt = `
Children's storybook video frame.
${prompt}

Style: original child-friendly 3D animated illustration, soft cinematic lighting, colorful, warm, safe for children, high detail, no written text, no watermark, no logo.
Aspect ratio: 16:9.
`;

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: finalPrompt,
      size: "1536x1024"
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data).slice(0, 1500));

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image API did not return b64_json.");

  const fileName = `${safeId(`scene_${index + 1}`)}.png`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(b64, "base64"));
  return { fileName, filePath };
}

async function generateVoiceFile(text) {
  if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY missing.");

  const audioName = `${safeId("narration")}.mp3`;
  const audioPath = path.join(outDir, audioName);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text: cleanText(text, 5000),
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.78,
        style: 0.28,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 1200));
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(audioPath, Buffer.from(arrayBuffer));
  return { audioName, audioPath };
}

async function renderVideoFromImages({ scenes, imagePaths, audioPath, durationSeconds = 180 }) {
  const videoName = `${safeId("tinymind_final")}.mp4`;
  const outputFile = path.join(outDir, videoName);

  const perScene = Math.max(4, Math.floor(Number(durationSeconds || 180) / imagePaths.length));
  const args = [];

  imagePaths.forEach((img) => {
    args.push("-loop", "1", "-t", String(perScene), "-i", img);
  });

  let audioInputIndex = null;
  if (audioPath && fs.existsSync(audioPath)) {
    audioInputIndex = imagePaths.length;
    args.push("-i", audioPath);
  }

  const filters = [];
  imagePaths.forEach((_, i) => {
    const caption = cleanText(scenes[i]?.text || `Escena ${i + 1}`, 240)
      .replace(/:/g, "\\:")
      .replace(/'/g, "\\'");
    filters.push(
      `[${i}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,` +
      `zoompan=z='min(zoom+0.0008,1.08)':d=${perScene * 30}:s=1280x720:fps=30,` +
      `drawtext=text='${caption}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=h-120:` +
      `box=1:boxcolor=black@0.42:boxborderw=24[v${i}]`
    );
  });

  const concatInputs = imagePaths.map((_, i) => `[v${i}]`).join("");
  filters.push(`${concatInputs}concat=n=${imagePaths.length}:v=1:a=0[outv]`);

  args.push("-filter_complex", filters.join(";"), "-map", "[outv]");

  if (audioInputIndex !== null) {
    args.push("-map", `${audioInputIndex}:a`, "-c:a", "aac", "-shortest");
  }

  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", outputFile);

  await runFfmpeg(args);
  return { videoName, outputFile };
}

app.get("/", (req, res) => {
  res.type("text").send("TinyMindKids Visual AI Render Server\nstatus: live");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "TinyMindKids Visual AI Render Server",
    status: "live",
    openai: OPENAI_API_KEY ? "configured" : "missing",
    imageModel: OPENAI_IMAGE_MODEL,
    elevenlabs: ELEVENLABS_API_KEY ? "configured" : "missing",
    ffmpeg: "ready"
  });
});

app.post("/api/generate-story", async (req, res) => {
  try {
    const story = await generateStoryData(req.body || {});
    res.json({ ok: true, ...story });
  } catch (err) {
    res.status(500).json({ ok: false, error: "generate-story failed", details: err.message });
  }
});

app.post("/api/generate-voice", async (req, res) => {
  try {
    const { text = "Hola, bienvenido a TinyMind Kids." } = req.body || {};
    const voice = await generateVoiceFile(text);
    res.json({ ok: true, file: `/renders/${voice.audioName}`, url: publicUrl(req, voice.audioName) });
  } catch (err) {
    res.status(500).json({ ok: false, error: "generate-voice failed", details: err.message });
  }
});

app.post("/api/create-full-video", async (req, res) => {
  try {
    const { topic = "Un dinosaurio aprende a compartir", durationSeconds = 180, sceneCount = 6 } = req.body || {};

    const story = await generateStoryData({ topic, durationSeconds, sceneCount });
    const scenes = Array.isArray(story.scenes) ? story.scenes.slice(0, Math.min(sceneCount, 8)) : [];
    if (!scenes.length) throw new Error("No scenes generated.");

    const images = [];
    for (let i = 0; i < scenes.length; i++) {
      images.push(await generateImageFile(scenes[i].visualPrompt || scenes[i].text || topic, i));
    }

    const narration = story.narration || scenes.map(s => s.text).join(" ");
    const voice = await generateVoiceFile(narration);

    const video = await renderVideoFromImages({
      scenes,
      imagePaths: images.map(img => img.filePath),
      audioPath: voice.audioPath,
      durationSeconds
    });

    res.json({
      ok: true,
      title: story.title,
      summary: story.summary,
      scenes,
      images: images.map(img => ({ file: `/renders/${img.fileName}`, url: publicUrl(req, img.fileName) })),
      audio: publicUrl(req, voice.audioName),
      video: publicUrl(req, video.videoName),
      downloadUrl: publicUrl(req, video.videoName)
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "create-full-video failed", details: err.message });
  }
});

app.post("/api/render-mp4", async (req, res) => {
  try {
    const { title = "TinyMind Kids", scenes = [], durationSeconds = 180 } = req.body || {};
    const fallbackScenes = Array.isArray(scenes) && scenes.length ? scenes : [
      { text: "Un pequeño dinosaurio aprende a compartir.", visualPrompt: "cute little dinosaur sharing toys with friends in a colorful bedroom" },
      { text: "Sus amigos juegan felices juntos.", visualPrompt: "friendly animal friends playing together in a sunny park" }
    ];

    const images = [];
    for (let i = 0; i < Math.min(fallbackScenes.length, 8); i++) {
      images.push(await generateImageFile(fallbackScenes[i].visualPrompt || fallbackScenes[i].text, i));
    }

    const video = await renderVideoFromImages({
      scenes: fallbackScenes,
      imagePaths: images.map(img => img.filePath),
      audioPath: null,
      durationSeconds
    });

    res.json({
      ok: true,
      title,
      url: publicUrl(req, video.videoName),
      downloadUrl: publicUrl(req, video.videoName),
      images: images.map(img => publicUrl(req, img.fileName))
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "render-mp4 failed", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`TinyMindKids Visual AI Render Server live on port ${PORT}`);
});

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
app.use(express.json({ limit: "90mb" }));

const rendersDir = path.join(__dirname, "renders");
const jobsDir = path.join(__dirname, "jobs");

if (!fs.existsSync(rendersDir)) fs.mkdirSync(rendersDir, { recursive: true });
if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir, { recursive: true });

app.use("/renders", express.static(rendersDir));

const queue = [];
let activeJob = null;

function safeId(prefix = "job") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicUrl(req, file) {
  const base = PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${base}/renders/${file}`;
}

function saveJob(job) {
  fs.writeFileSync(path.join(jobsDir, `${job.id}.json`), JSON.stringify(job, null, 2));
}

function loadJob(id) {
  const file = path.join(jobsDir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function cleanText(text = "", max = 1200) {
  return String(text)
    .replace(/[^\w\s.,!?¿¡áéíóúÁÉÍÓÚñÑ:-]/g, "")
    .slice(0, max);
}

function runFfmpeg(args, timeout = 480000) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, { timeout }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr ? String(stderr).slice(-2400) : error.message));
      else resolve({ stdout, stderr });
    });
  });
}

async function openAIChat(messages, temperature = 0.75) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data).slice(0, 1500));
  return data.choices?.[0]?.message?.content || "";
}

async function generateStory(topic, sceneCount = 6, durationSeconds = 180) {
  const prompt = `
Crea una historia infantil segura y educativa.
Tema: ${topic}
Escenas: ${sceneCount}
Duración: ${durationSeconds} segundos.

Devuelve SOLO JSON válido:
{
  "title": "título",
  "summary": "resumen",
  "narration": "narración completa",
  "scenes": [
    {
      "text": "texto de escena",
      "visualPrompt": "prompt visual 3D infantil, sin texto ni logos"
    }
  ]
}
`;

  const content = await openAIChat([
    { role: "system", content: "Eres un creador profesional de videos infantiles seguros." },
    { role: "user", content: prompt }
  ]);

  try {
    return JSON.parse(content.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim());
  } catch {
    return {
      title: "Historia infantil",
      summary: "",
      narration: content,
      scenes: [{ text: content, visualPrompt: "cute 3D children's story scene, colorful, safe, no text" }]
    };
  }
}

async function generateImage(prompt, index) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing.");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: `${prompt}. Premium 3D children storybook frame, cinematic lighting, colorful, safe for kids, no text, no watermark.`,
      size: "1536x1024"
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data).slice(0, 1500));

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image API returned no image.");

  const file = `scene_${Date.now()}_${index}.png`;
  const filepath = path.join(rendersDir, file);
  fs.writeFileSync(filepath, Buffer.from(b64, "base64"));
  return { file, filepath };
}

async function generateVoice(text) {
  if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY missing.");

  const file = `voice_${Date.now()}.mp3`;
  const filepath = path.join(rendersDir, file);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text: cleanText(text, 5000),
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.78,
        style: 0.25,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 1500));
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(arrayBuffer));
  return { file, filepath };
}

async function renderVideo({ scenes, imagePaths, audioPath, durationSeconds }) {
  const videoFile = `tinymind_video_${Date.now()}.mp4`;
  const output = path.join(rendersDir, videoFile);
  const perScene = Math.max(4, Math.floor(Number(durationSeconds || 180) / imagePaths.length));

  const args = [];
  imagePaths.forEach((img) => {
    args.push("-loop", "1", "-t", String(perScene), "-i", img);
  });

  const audioIndex = imagePaths.length;
  if (audioPath) args.push("-i", audioPath);

  const filters = [];
  imagePaths.forEach((_, i) => {
    const caption = cleanText(scenes[i]?.text || `Escena ${i + 1}`, 220)
      .replace(/:/g, "\\:")
      .replace(/'/g, "\\'");
    filters.push(
      `[${i}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,` +
      `zoompan=z='min(zoom+0.0008,1.08)':d=${perScene * 30}:s=1280x720:fps=30,` +
      `drawtext=text='${caption}':fontcolor=white:fontsize=31:x=(w-text_w)/2:y=h-118:` +
      `box=1:boxcolor=black@0.42:boxborderw=22[v${i}]`
    );
  });

  filters.push(`${imagePaths.map((_, i) => `[v${i}]`).join("")}concat=n=${imagePaths.length}:v=1:a=0[outv]`);

  args.push("-filter_complex", filters.join(";"), "-map", "[outv]");

  if (audioPath) args.push("-map", `${audioIndex}:a`, "-c:a", "aac", "-shortest");

  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", output);

  await runFfmpeg(args);
  return { file: videoFile, filepath: output };
}

async function processJob(job) {
  activeJob = job;
  job.status = "generating_story";
  job.progress = 10;
  saveJob(job);

  try {
    const story = await generateStory(job.topic, job.sceneCount, job.durationSeconds);
    job.title = story.title;
    job.summary = story.summary;
    job.scenes = story.scenes;
    job.status = "generating_images";
    job.progress = 30;
    saveJob(job);

    const images = [];
    for (let i = 0; i < story.scenes.length; i++) {
      const img = await generateImage(story.scenes[i].visualPrompt || story.scenes[i].text, i);
      images.push(img);
      job.progress = 30 + Math.floor(((i + 1) / story.scenes.length) * 30);
      job.images = images.map((x) => x.file);
      saveJob(job);
    }

    job.status = "generating_voice";
    job.progress = 70;
    saveJob(job);

    const voice = await generateVoice(story.narration || story.scenes.map((s) => s.text).join(" "));

    job.status = "rendering_video";
    job.progress = 85;
    saveJob(job);

    const video = await renderVideo({
      scenes: story.scenes,
      imagePaths: images.map((x) => x.filepath),
      audioPath: voice.filepath,
      durationSeconds: job.durationSeconds
    });

    job.status = "ready";
    job.progress = 100;
    job.video = video.file;
    job.audio = voice.file;
    job.completedAt = new Date().toISOString();
    saveJob(job);
  } catch (error) {
    job.status = "failed";
    job.error = error.message;
    job.completedAt = new Date().toISOString();
    saveJob(job);
  } finally {
    activeJob = null;
    processNext();
  }
}

function processNext() {
  if (activeJob || queue.length === 0) return;
  const next = queue.shift();
  processJob(next);
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    app: "TinyMindKids Production Render Queue V1",
    status: "live",
    routes: [
      "GET /api/health",
      "POST /api/jobs",
      "GET /api/jobs/:id",
      "GET /api/jobs",
      "POST /api/create-full-video"
    ]
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "TinyMindKids Production Render Queue V1",
    status: "live",
    openai: OPENAI_API_KEY ? "configured" : "missing",
    elevenlabs: ELEVENLABS_API_KEY ? "configured" : "missing",
    imageModel: OPENAI_IMAGE_MODEL,
    ffmpeg: "ready",
    activeJob: activeJob?.id || null,
    queueLength: queue.length
  });
});

app.post("/api/jobs", (req, res) => {
  const {
    topic = "Un dinosaurio pequeño aprende a compartir sus juguetes con sus amigos.",
    durationSeconds = 180,
    sceneCount = 6,
    priority = "normal"
  } = req.body || {};

  const job = {
    id: safeId("render"),
    topic,
    durationSeconds,
    sceneCount,
    priority,
    status: "queued",
    progress: 0,
    createdAt: new Date().toISOString()
  };

  saveJob(job);
  queue.push(job);
  processNext();

  res.json({ ok: true, jobId: job.id, status: job.status });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = loadJob(req.params.id);
  if (!job) return res.status(404).json({ ok: false, error: "Job not found" });

  const response = { ...job };
  if (job.video) response.videoUrl = publicUrl(req, job.video);
  if (job.audio) response.audioUrl = publicUrl(req, job.audio);
  if (Array.isArray(job.images)) response.imageUrls = job.images.map((file) => publicUrl(req, file));

  res.json({ ok: true, job: response });
});

app.get("/api/jobs", (req, res) => {
  const jobs = fs.readdirSync(jobsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(jobsDir, f), "utf-8")))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 50);

  res.json({ ok: true, activeJob: activeJob?.id || null, queueLength: queue.length, jobs });
});

// compatibility endpoint for current frontend
app.post("/api/create-full-video", async (req, res) => {
  const {
    topic = "Un dinosaurio pequeño aprende a compartir sus juguetes con sus amigos.",
    durationSeconds = 180,
    sceneCount = 6
  } = req.body || {};

  const job = {
    id: safeId("render"),
    topic,
    durationSeconds,
    sceneCount,
    priority: "normal",
    status: "queued",
    progress: 0,
    createdAt: new Date().toISOString()
  };

  saveJob(job);
  queue.push(job);
  processNext();

  res.json({
    ok: true,
    queued: true,
    jobId: job.id,
    statusUrl: `/api/jobs/${job.id}`,
    message: "Video job queued. Poll /api/jobs/:id until status is ready."
  });
});

app.listen(PORT, () => {
  console.log(`TinyMindKids Production Render Queue V1 running on port ${PORT}`);
});

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();
const PORT = process.env.PORT || 10000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

const outDir = path.join(__dirname, "renders");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function cleanText(text = "") {
  return String(text)
    .replace(/[^\w\s.,!?áéíóúÁÉÍÓÚñÑ-]/g, "")
    .slice(0, 1200);
}

function safeFileName(prefix = "tinymind") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

app.get("/", (req, res) => {
  res.type("text").send("TinyMindKids AI Render Server\nstatus: live");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "TinyMindKids AI Render Server",
    status: "live",
    openai: OPENAI_API_KEY ? "configured" : "missing",
    elevenlabs: ELEVENLABS_API_KEY ? "configured" : "missing",
    ffmpeg: "ready"
  });
});

app.post("/api/generate-story", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY is missing in Render Environment." });
    }

    const {
      topic = "Un dinosaurio pequeño aprende a compartir sus juguetes con sus amigos.",
      ageRange = "3-7",
      durationSeconds = 180,
      sceneCount = 6
    } = req.body || {};

    const prompt = `
Crea una historia infantil segura, dulce y educativa en español.
Tema: ${topic}
Edad: ${ageRange}
Duración total aproximada: ${durationSeconds} segundos.
Número de escenas: ${sceneCount}.

Devuelve SOLO JSON válido con esta estructura:
{
  "title": "título corto",
  "summary": "resumen corto",
  "scenes": [
    {
      "text": "texto narrativo de la escena",
      "visualPrompt": "descripción visual animada para generar imagen/video"
    }
  ]
}
No incluyas markdown.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          { role: "system", content: "Eres un creador profesional de historias infantiles educativas, seguras y aptas para niños." },
          { role: "user", content: prompt }
        ],
        temperature: 0.8
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ ok: false, error: "OpenAI request failed", details: data });
    }

    const content = data.choices?.[0]?.message?.content || "";
    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return res.json({
        ok: true,
        title: "Historia generada",
        summary: "",
        scenes: [{ text: content, visualPrompt: "cute children story illustration" }],
        raw: content
      });
    }

    res.json({ ok: true, ...parsed });
  } catch (err) {
    res.status(500).json({ ok: false, error: "generate-story failed", details: err.message });
  }
});

app.post("/api/generate-voice", async (req, res) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ ok: false, error: "ELEVENLABS_API_KEY is missing in Render Environment." });
    }

    const { text = "Hola, bienvenido a TinyMind Kids." } = req.body || {};
    const safeText = cleanText(text);
    const audioId = safeFileName("voice");
    const audioPath = path.join(outDir, `${audioId}.mp3`);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text: safeText,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.25,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ ok: false, error: "ElevenLabs request failed", details: errorText.slice(0, 1000) });
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(audioPath, Buffer.from(arrayBuffer));

    res.json({
      ok: true,
      audioId,
      file: `/renders/${audioId}.mp3`,
      url: `${req.protocol}://${req.get("host")}/renders/${audioId}.mp3`
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "generate-voice failed", details: err.message });
  }
});

app.post("/api/render-mp4", async (req, res) => {
  try {
    const {
      title = "TinyMind Kids Story",
      scenes = [],
      durationSeconds = 180
    } = req.body || {};

    const safeTitle = cleanText(title) || "TinyMind Kids Story";
    const safeScenes = Array.isArray(scenes) && scenes.length
      ? scenes.map((s, i) => cleanText(s.text || s.caption || `Escena ${i + 1}`))
      : [
          "Un pequeño dinosaurio aprende a compartir sus juguetes.",
          "Sus amigos se sienten felices cuando todos juegan juntos.",
          "El dinosaurio descubre que compartir hace el día más bonito."
        ];

    const videoId = safeFileName("tinymind");
    const outputFile = path.join(outDir, `${videoId}.mp4`);
    const perScene = Math.max(5, Math.floor(Number(durationSeconds || 180) / safeScenes.length));

    const filters = [];
    const inputs = [];

    safeScenes.forEach((sceneText, index) => {
      inputs.push("-f", "lavfi", "-t", String(perScene), "-i", "color=c=0x101827:s=1280x720:r=30");
      const text = sceneText.replace(/:/g, "\\:").replace(/'/g, "\\'");
      filters.push(
        `[${index}:v]drawtext=text='${text}':fontcolor=white:fontsize=34:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.45:boxborderw=25[v${index}]`
      );
    });

    const concatInputs = safeScenes.map((_, i) => `[v${i}]`).join("");
    filters.push(`${concatInputs}concat=n=${safeScenes.length}:v=1:a=0[outv]`);

    const args = [
      ...inputs,
      "-filter_complex", filters.join(";"),
      "-map", "[outv]",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-y",
      outputFile
    ];

    execFile("ffmpeg", args, { timeout: 240000 }, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({
          ok: false,
          error: "FFmpeg render failed",
          details: stderr ? String(stderr).slice(-1200) : error.message
        });
      }

      res.json({
        ok: true,
        message: "MP4 generated successfully",
        title: safeTitle,
        videoId,
        file: `/renders/${videoId}.mp4`,
        url: `${req.protocol}://${req.get("host")}/renders/${videoId}.mp4`
      });
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "render-mp4 failed", details: err.message });
  }
});

app.post("/api/create-full-video", async (req, res) => {
  try {
    const { topic = "Un dinosaurio aprende a compartir", durationSeconds = 180 } = req.body || {};

    res.json({
      ok: true,
      message: "Pipeline endpoint ready. Next phase will combine OpenAI story + ElevenLabs voice + FFmpeg final video.",
      topic,
      durationSeconds,
      next: [
        "Call /api/generate-story",
        "Call /api/generate-voice",
        "Call /api/render-mp4"
      ]
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "create-full-video failed", details: err.message });
  }
});

app.use("/renders", express.static(outDir));

app.listen(PORT, () => {
  console.log(`TinyMindKids AI Render Server live on port ${PORT}`);
});

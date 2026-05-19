const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

const outDir = path.join(__dirname, "renders");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

app.get("/", (req, res) => {
  res.json({
    ok: true,
    app: "TinyMind MP4 Render Server",
    status: "live",
    routes: ["GET /api/health", "POST /api/render-mp4"]
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "live", ffmpeg: "required-on-render" });
});

function esc(text = "") {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\:")
    .replace(/'/g, "\\'")
    .replace(/\n/g, " ");
}

app.post("/api/render-mp4", async (req, res) => {
  try {
    const story = req.body?.story;
    if (!story || !Array.isArray(story.scenes)) {
      return res.status(400).json({ ok: false, error: "story.scenes is required" });
    }

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
      const narration = esc((s.narration || "").slice(0, 130));
      const duration = Number(s.durationSec || 12);

      await new Promise((resolve, reject) => {
        const args = [
          "-y",
          "-f", "lavfi",
          "-i", `color=c=0x10172F:s=1280x720:d=${duration}`,
          "-vf",
          `drawbox=x=40:y=40:w=1200:h=640:color=0x202B55@0.85:t=fill,drawtext=text='TinyMind Kids':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=90,drawtext=text='${title}':fontcolor=0xFDE68A:fontsize=44:x=(w-text_w)/2:y=190,drawtext=text='${narration}':fontcolor=white:fontsize=30:x=90:y=330:box=1:boxcolor=0x000000@0.25:boxborderw=20`,
          "-pix_fmt", "yuv420p",
          "-r", "30",
          sceneFile
        ];

        execFile("ffmpeg", args, (err) => err ? reject(err) : resolve());
      });
    }

    fs.writeFileSync(
      listFile,
      tempVideos.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join("\n")
    );

    await new Promise((resolve, reject) => {
      execFile("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", finalFile], (err) =>
        err ? reject(err) : resolve()
      );
    });

    const publicPath = `/renders/${path.basename(finalFile)}`;
    res.json({
      ok: true,
      status: "rendered",
      durationSec: scenes.reduce((a, s) => a + Number(s.durationSec || 12), 0),
      videoUrl: `${req.protocol}://${req.get("host")}${publicPath}`,
      file: path.basename(finalFile)
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.use("/renders", express.static(outDir));

app.listen(PORT, () => {
  console.log(`TinyMind MP4 Render Server running on port ${PORT}`);
});

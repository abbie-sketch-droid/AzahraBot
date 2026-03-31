// ==============================================
// 🎵 Azahrabot Play Command (v8 — Uses ytmp3 engine)
// Spotify + YouTube + ElitePro + robust downloader
// ==============================================

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const yts = require("yt-search");
const { fileTypeFromBuffer } = require("file-type");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const small = require("../lib/small_lib");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// 📁 Temp dir
function ensureTempDir() {
  const dir = path.join(__dirname, "../temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 🔄 SAME DOWNLOAD ENGINE (from your ytmp3)
async function downloadFile(url, destPath) {
  const strategies = [
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Referer": "https://eliteprotech-apis.zone.id/",
    },
    {
      "User-Agent": "Mozilla/5.0 (Android 13)",
    },
    null,
  ];

  for (let i = 0; i < strategies.length; i++) {
    try {
      const res = await axios({
        url,
        method: "GET",
        responseType: "arraybuffer",
        headers: strategies[i] || {},
        timeout: 60000,
      });

      const buffer = Buffer.from(res.data);

      if (buffer.length < 5000) continue;

      fs.writeFileSync(destPath, buffer);
      return buffer;

    } catch {}
  }

  throw new Error("Download failed");
}

// 🔐 Spotify Token
async function getSpotifyToken() {
  const auth = Buffer.from(
    `${small.api.spotifyClientId}:${small.api.spotifyClientSecret}`
  ).toString("base64");

  const res = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return res.data.access_token;
}

// 🎧 Spotify Search
async function searchSpotifyTrack(query) {
  const token = await getSpotifyToken();

  const res = await axios.get("https://api.spotify.com/v1/search", {
    params: { q: query, type: "track", limit: 5 },
    headers: { Authorization: `Bearer ${token}` },
  });

  const tracks = res.data.tracks.items;

  const track =
    tracks.find(t => t.name.toLowerCase().includes(query.toLowerCase())) ||
    tracks[0];

  return {
    title: track.name,
    artist: track.artists.map(a => a.name).join(", "),
    duration: msToTime(track.duration_ms),
    cover: track.album.images[0].url,
  };
}

// 🎬 YouTube
async function getYouTube(query) {
  const res = await yts(query);
  return res.videos.find(v => v.seconds > 30);
}

// ⏱ Time
function msToTime(ms) {
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(0).padStart(2, "0");
  return `${m}:${s}`;
}

// 🚀 MAIN
module.exports = async (sock, msg, from, text, args) => {
  try {
    const query = args.join(" ");
    if (!query) {
      return sock.sendMessage(from, { text: "Usage: .play <song>" }, { quoted: msg });
    }

    await sock.sendMessage(from, { react: { text: "🎶", key: msg.key } });

    const track = await searchSpotifyTrack(query);
    const yt = await getYouTube(`${track.title} ${track.artist} official audio`);
    
    const caption = `
    🎧 *${track.title}*
    ────────────────────
    🎤 *Artist:* ${track.artist}
    ⏱ *Duration:* ${track.duration}
    ────────────────────
    > 🎶 *Powered by ${small.author || "AzarTech"}* ⚡
    `.trim();

    await sock.sendMessage(
      from,
      {
        text: caption + "\n\n⬇️ *Downloading your song...*",
        contextInfo: {
          externalAdReply: {
            title: track.title,
            body: `${track.artist} • ${track.duration}`,
            mediaType: 1,
            renderLargerThumbnail: true,
            thumbnailUrl: track.cover,
            sourceUrl: yt.url,
          },
        },
      },
      { quoted: msg }
    );

    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(yt.url)}&format=mp3`;

    const apiRes = await axios.get(apiUrl);
    const downloadUrl = apiRes.data.downloadURL;

    const tempDir = ensureTempDir();
    const rawPath = path.join(tempDir, `play_${Date.now()}.bin`);

    const buffer = await downloadFile(downloadUrl, rawPath);

    const type = await fileTypeFromBuffer(buffer);

    let finalPath = rawPath;

    // 🎬 Convert if needed
    if (type && type.mime.startsWith("video")) {
      const mp3Path = rawPath + ".mp3";

      await new Promise((res, rej) => {
        ffmpeg(rawPath).toFormat("mp3").on("end", res).on("error", rej).save(mp3Path);
      });

      fs.unlinkSync(rawPath);
      finalPath = mp3Path;
    }

    const audio = fs.readFileSync(finalPath);

    await sock.sendMessage(
      from,
      {
        audio,
        mimetype: "audio/mpeg",
        fileName: `${track.title}.mp3`,
      },
      { quoted: msg }
    );

    fs.unlinkSync(finalPath);

    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

  } catch (e) {
    console.error(e);
    await sock.sendMessage(from, { text: "❌ Failed to fetch song" }, { quoted: msg });
  }
};
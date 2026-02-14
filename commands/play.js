// ==============================================
// 🎵 Azahrabot Play Command (v5.6 — XYRO SPOTIFY STABLE)
// Direct Spotify MP3 (No fallback needed)
// ==============================================

const axios = require("axios");
const small = require("../lib/small_lib");

async function fetchSpotify(query) {
  const base = (small.api?.xyro || "https://api.xyro.site").replace(/\/$/, "");
  const url = `${base}/download/spotify?input=${encodeURIComponent(query)}`;

  const res = await axios.get(url, {
    timeout: 60000,
    headers: { accept: "application/json" },
    validateStatus: () => true,
  });

  if (res.status !== 200) return null;
  return res.data;
}

module.exports = async (sock, msg, from, text, args) => {
  const query = args.join(" ").trim();
  if (!query) {
    return sock.sendMessage(
      from,
      { text: "🎧 *Usage:* .play <song name>" },
      { quoted: msg }
    );
  }

  try {
    await sock.sendMessage(from, { react: { text: "🎶", key: msg.key } });
    await sock.sendMessage(
      from,
      { text: "🔍 *Searching your song...*" },
      { quoted: msg }
    );

    const data = await fetchSpotify(query);
    if (!data?.audio?.url) throw new Error("No audio returned");

    const meta = data.metadata || {};
    const audio = data.audio;

    const title = meta.title || query;
    const artist = meta.artist || "Unknown";
    const duration = meta.duration || "Unknown";
    const cover = meta.cover || "";

    const caption = `
🎧 *${title}*
────────────────────
🎤 *Artist:* ${artist}
⏱ *Duration:* ${duration}
────────────────────
> 🎶 *Powered by ${small.author || "AzarTech"}* ⚡
    `.trim();

    // 🎨 Banner
    await sock.sendMessage(
      from,
      {
        text: caption + "\n\n⬇️ *Downloading your song...*",
        contextInfo: {
          externalAdReply: {
            title,
            body: `${artist} • ${duration}`,
            mediaType: 1,
            renderLargerThumbnail: true,
            thumbnailUrl: cover,
            sourceUrl: meta.url || "",
          },
        },
      },
      { quoted: msg }
    );

    // 🎧 MP3
    await sock.sendMessage(
      from,
      {
        audio: { url: audio.url },
        mimetype: "audio/mpeg",
        fileName: audio.name || `${title}.mp3`,
      },
      { quoted: msg }
    );

    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (err) {
    console.error("❌ .play error:", err.message);
    await sock.sendMessage(
      from,
      { text: "⚠️ Failed to process song.\nTry another title." },
      { quoted: msg }
    );
  }
};

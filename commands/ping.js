// ==============================================
// ⚡ Azahrabot Ping (v5.1 — Button on Final Message)
// ==============================================

const secure = require("../lib/small_lib");

module.exports = async (sock, msg, from) => {
  try {
    await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
  } catch {}

  try {
    const start = Date.now();

    // ⏳ First message (no button)
    await sock.sendMessage(from, { text: "⏳ *Pinging...*" }, { quoted: msg });

    const ping = (Date.now() - start).toFixed(1);

    // ==========================================
    // FINAL MESSAGE — View Channel button here
    // ==========================================
    const newsletterJid = secure.channel?.jid;  

    await sock.sendMessage(
      from,
      {
        text: `*AZAHRA SPEED = ${ping} ms ⚡*`,
        contextInfo: {
          forwardedNewsletterMessageInfo: {
            newsletterJid: newsletterJid,
            serverMessageId: 1,
            newsletterName: secure.channel?.name
          },
          isForwarded: true,
          forwardingScore: 1
        }
      },
      { quoted: msg }
    );

  } catch (err) {
    console.error("❌ Ping error:", err.message);
    await sock.sendMessage(from, { text: "⚠️ Ping test failed." }, { quoted: msg });
  }
};

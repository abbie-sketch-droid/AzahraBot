const fs = require('fs');
const path = require('path');
const settings = require('../../settings');

module.exports = {
  fn: async (sock, msg, from, text, args) => {
    try {
      // 1. Verify owner check
      const sender = msg.key.participant || msg.key.remoteJid;
      const owner = (settings.ownerNumber || "").replace(/[^0-9]/g, "");
      const isOwner = msg.key.fromMe || (sender && owner && sender.includes(owner));
      
      if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Only the bot owner can use this command." }, { quoted: msg });
      }

      // 2. Argument validation
      if (!args || args.length !== 1) {
        return sock.sendMessage(from, { text: "Usage: .setprefix <symbol or emoji>\nExample: .setprefix 🤖" }, { quoted: msg });
      }

      const newPrefix = args[0];

      if (newPrefix.length > 10) {
          return sock.sendMessage(from, { text: "❌ Prefix is too long!" }, { quoted: msg });
      }

      if (/[a-zA-Z0-9]/.test(newPrefix)) {
          return sock.sendMessage(from, { text: "❌ Prefix cannot be a letter or number. Please use symbols (like !, ?, .) or emojis!" }, { quoted: msg });
      }

      // 3. Automatically updates runtime without restart
      if (typeof global.setPrefix === 'function') {
        global.setPrefix(newPrefix);
      }

      // 4. Persist to settings.js to survive restarts
      const settingsPath = path.join(__dirname, "../../settings.js");
      if (fs.existsSync(settingsPath)) {
        let content = fs.readFileSync(settingsPath, "utf8");
        // Regex exactly matches the settings.js format specified by the user
        content = content.replace(/prefix\s*:\s*["'`][^"'`]+["'`]/, `prefix: "${newPrefix}"`);
        fs.writeFileSync(settingsPath, content, "utf8");
      }

      await sock.sendMessage(from, { text: `✅ Successfully changed prefix to: ${newPrefix}` }, { quoted: msg });

    } catch (e) {
      console.error("Setprefix Error:", e);
      await sock.sendMessage(from, { text: "❌ Failed to change prefix." });
    }
  }
};

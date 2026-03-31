// commands/nanobanana.js - Fixed for gemini-2.5-flash-image
const axios = require("axios");
const smallLib = require("../lib/small_lib");

// ✅ CORRECT MODEL NAME (stable version)
const MODEL_NAME = "gemini-2.5-flash-image";

// Helper function for image generation and editing
async function generateImageWithGemini(prompt, imageBuffer = null) {
    const apiKey = smallLib.api.gemini;
    if (!apiKey) throw new Error("Gemini API key missing from small_lib.js");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    let requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    // If an image is provided for editing, add it to the request
    if (imageBuffer) {
        requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: imageBuffer.toString('base64')
                        }
                    }
                ]
            }]
        };
    }

    try {
        const response = await axios.post(endpoint, requestBody, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        });

        // Extract the base64 image data from the response
        const imageBase64 = response.data.candidates[0].content.parts[0].inlineData.data;
        return Buffer.from(imageBase64, "base64");
    } catch (error) {
        console.error("Gemini API Error:", error.response?.data || error.message);
        throw new Error(`API call failed: ${error.response?.data?.error?.message || error.message}`);
    }
}

// Main command handler
module.exports = async (sock, msg, from, text, args, store) => {
    try {
        // Check if user replied to an image
        const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const isEdit = quotedMsg && (quotedMsg.imageMessage || quotedMsg.documentMessage);

        // If no arguments and no image reply, show help
        if (!args.length && !isEdit) {
            return sock.sendMessage(from, {
                text: `🍌 *NanoBanana Commands (Free via Gemini)*

1️⃣ *Generate new image*
\`.nanobanana a futuristic city\`
\`.nanobanana a moon with blood rain\`

2️⃣ *Edit an existing image*
Reply to an image and type:
\`.nanobanana make it black and white\`
or
\`.nanobanana add a hat to the person\`

*Note*: Uses the stable Gemini 2.5 Flash Image model.`
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } });

        // --- Image Editing Mode ---
        if (isEdit) {
            const prompt = args.join(" ").trim();
            if (!prompt) {
                await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
                return sock.sendMessage(from, {
                    text: "❌ Please provide an edit instruction. Example: `.nanobanana make the background a beach`"
                }, { quoted: msg });
            }

            // Download the replied image
            let imageBuffer;
            try {
                imageBuffer = await sock.downloadMediaMessage({ message: quotedMsg });
            } catch (err) {
                await sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } });
                return sock.sendMessage(from, { text: "❌ Failed to download the image." }, { quoted: msg });
            }

            await sock.sendPresenceUpdate('composing', from);

            try {
                const editedBuffer = await generateImageWithGemini(prompt, imageBuffer);
                const caption = `🍌 *NanoBanana Edit*\n🖌️ *Edit:* ${prompt.substring(0, 100)}`;
                await sock.sendMessage(from, { image: editedBuffer, caption }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            } catch (error) {
                await sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } });
                await sock.sendMessage(from, { text: `❌ Edit failed: ${error.message}` }, { quoted: msg });
            }
        } 
        // --- Image Generation Mode ---
        else {
            const prompt = args.join(" ").trim();
            if (!prompt) {
                await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
                return sock.sendMessage(from, {
                    text: "❌ Please provide a prompt. Example: `.nanobanana a beautiful sunset`"
                }, { quoted: msg });
            }

            await sock.sendPresenceUpdate('composing', from);

            try {
                const imageBuffer = await generateImageWithGemini(prompt);
                const caption = `🍌 *NanoBanana*\n🎨 *Prompt:* ${prompt.substring(0, 100)}`;
                await sock.sendMessage(from, { image: imageBuffer, caption }, { quoted: msg });
                await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            } catch (error) {
                await sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } });
                await sock.sendMessage(from, { text: `❌ Generation failed: ${error.message}` }, { quoted: msg });
            }
        }
    } catch (error) {
        console.error("NanoBanana command error:", error);
        await sock.sendMessage(from, { text: `❌ An unexpected error occurred.` }, { quoted: msg });
        await sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } });
    }
};
// server.js
import express from "express";
import fetch from "node-fetch";
import path from "path";

const __dirname = path.resolve();
const app = express();
const PORT = process.env.PORT || 3000;

// Twitch bilgilerin
const CLIENT_ID = "9194msu9dw2oevxccr7avm1oiet4h0";
const CLIENT_SECRET = "BURAYA_SECRETINI_YAPISTIR"; // Twitch'ten aldığın secret

let cachedToken = null;
let tokenExpiry = 0;

// App Access Token alma fonksiyonu
async function getAppToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const resp = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials"
    })
  });
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 60) * 1000; // 1 dk güvenlik
  return cachedToken;
}

// API route: clips
app.get("/api/clips", async (req, res) => {
  try {
    const token = await getAppToken();

    // Kullanıcı bilgisi al
    const userResp = await fetch(
      "https://api.twitch.tv/helix/users?login=cigdemt",
      {
        headers: {
          "Client-ID": CLIENT_ID,
          "Authorization": `Bearer ${token}`
        }
      }
    );
    const userData = await userResp.json();
    const broadcasterId = userData.data[0].id;

    // Klipleri al
    const clipsResp = await fetch(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=20`,
      {
        headers: {
          "Client-ID": CLIENT_ID,
          "Authorization": `Bearer ${token}`
        }
      }
    );
    const clipsData = await clipsResp.json();
    res.json(clipsData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Frontend dosyalarını sun
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => console.log(`Server çalışıyor: http://localhost:${PORT}`));

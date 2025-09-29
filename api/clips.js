// api/clips.js
import fetch from "node-fetch";

const CLIENT_ID = "9194msu9dw2oevxccr7avm1oiet4h0";
const CLIENT_SECRET = "do4b2v05pmah11gtj12rkmfswvg1ya"; // Twitch secret

let cachedToken = null;
let tokenExpiry = 0;

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
  tokenExpiry = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  try {
    const token = await getAppToken();

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

    // 🔹 İşte kritik kısım: azdan çoğa izlenme sayısına göre sıralama
    if (clipsData.data && clipsData.data.length > 0) {
      clipsData.data.sort((a, b) => a.view_count - b.view_count);
    }

    res.status(200).json(clipsData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

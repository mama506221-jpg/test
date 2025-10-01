// api/clips.js
import fetch from "node-fetch";

const CLIENT_ID = "9194msu9dw2oevxccr7avm1oiet4h0";
const CLIENT_SECRET = "do4b2v05pmah11gtj12rkmfswvg1ya";

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

async function getAllClips(broadcasterId, token) {
  let allClips = [];
  let cursor = null;

  do {
    const url = new URL("https://api.twitch.tv/helix/clips");
    url.searchParams.set("broadcaster_id", broadcasterId);
    url.searchParams.set("first", "100");
    if (cursor) url.searchParams.set("after", cursor);

    const resp = await fetch(url, {
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": `Bearer ${token}`
      }
    });
    const data = await resp.json();
    if (data.data) {
      allClips.push(...data.data);
    }
    cursor = data.pagination?.cursor || null;
  } while (cursor);

  // 🔹 En çok izlenenden en aza (sonra frontend ters çevirebilir)
  allClips.sort((a, b) => b.view_count - a.view_count);
  return allClips;
}

export default async function handler(req, res) {
  try {
    const { user } = req.query;
    if (!user) return res.status(400).json({ error: "username gerekli ?user=username" });

    const token = await getAppToken();

    // 1. Kullanıcı ID çek
    const userResp = await fetch(`https://api.twitch.tv/helix/users?login=${user}`, {
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": `Bearer ${token}`
      }
    });
    const userData = await userResp.json();
    if (!userData.data || userData.data.length === 0) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }
    const broadcasterId = userData.data[0].id;

    // 2. Tüm klipleri çek
    const clips = await getAllClips(broadcasterId, token);

    res.status(200).json({
      total: clips.length,
      clips
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

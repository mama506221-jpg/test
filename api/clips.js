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
  let all = [];
  let cursor = null;
  do {
    const url = new URL("https://api.twitch.tv/helix/clips");
    url.searchParams.set("broadcaster_id", broadcasterId);
    url.searchParams.set("first", "100");
    if (cursor) url.searchParams.set("after", cursor);

    const resp = await fetch(url.toString(), {
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": `Bearer ${token}`
      }
    });
    const page = await resp.json();
    if (page.data && page.data.length) all.push(...page.data);
    cursor = page.pagination?.cursor || null;
  } while (cursor);

  // numerik güvenli sıralama: en popüler (yüksek view_count) -> en az popüler
  all.sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0));

  return all;
}

export default async function handler(req, res) {
  try {
    const username = (req.query.user || req.query.username || "pourselen").trim();
    if (!username) return res.status(400).json({ error: "user query param gerekli: ?user=USERNAME" });

    const token = await getAppToken();

    const userResp = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
      headers: { "Client-ID": CLIENT_ID, "Authorization": `Bearer ${token}` }
    });
    const userJson = await userResp.json();
    if (!userJson.data || userJson.data.length === 0) {
      return res.status(404).json({ error: "kullanıcı bulunamadı" });
    }
    const broadcasterId = userJson.data[0].id;

    const allClips = await getAllClips(broadcasterId, token);

    res.status(200).json({
      total: allClips.length,
      clips: allClips
    });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: err.message });
  }
}

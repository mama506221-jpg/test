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

async function getAllClips(broadcasterId, token, startDate, endDate) {
  let all = [];
  let cursor = null;

  while (true) {
    const url = new URL("https://api.twitch.tv/helix/clips");
    url.searchParams.set("broadcaster_id", broadcasterId);
    url.searchParams.set("first", "100");

    if (startDate) url.searchParams.set("started_at", startDate);
    if (endDate) url.searchParams.set("ended_at", endDate);
    if (cursor) url.searchParams.set("after", cursor);

    const resp = await fetch(url, {
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": `Bearer ${token}`
      }
    });
    const data = await resp.json();

    if (!data.data || data.data.length === 0) break;

    all = all.concat(data.data);
    cursor = data.pagination?.cursor;
    if (!cursor) break;
  }
  return all;
}

export default async function handler(req, res) {
  try {
    const { broadcaster = "pourselen", start, end } = req.query;
    const token = await getAppToken();

    const userResp = await fetch(
      `https://api.twitch.tv/helix/users?login=${broadcaster}`,
      {
        headers: {
          "Client-ID": CLIENT_ID,
          "Authorization": `Bearer ${token}`
        }
      }
    );
    const userData = await userResp.json();
    if (!userData.data || userData.data.length === 0) {
      return res.status(404).json({ error: "Böyle bir yayıncı bulunamadı." });
    }
    const broadcasterId = userData.data[0].id;

    const clips = await getAllClips(broadcasterId, token, start, end);

    // Popülerden az popülere sırala
    clips.sort((a, b) => b.view_count - a.view_count);

    res.status(200).json({ total: clips.length, data: clips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

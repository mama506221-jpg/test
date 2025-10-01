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

// 🔹 tüm klipleri çek (sayfalama ile)
async function getAllClips(broadcasterId, token) {
  let all = [];
  let cursor = null;

  while (true) {
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
    const data = await resp.json();
    if (data.data) all.push(...data.data);

    if (data.pagination && data.pagination.cursor) {
      cursor = data.pagination.cursor;
    } else break;
  }

  return all;
}

export default async function handler(req, res) {
  try {
    const token = await getAppToken();

    // yayıncı id al
    const userResp = await fetch(
      "https://api.twitch.tv/helix/users?login=pourselen",
      {
        headers: {
          "Client-ID": CLIENT_ID,
          "Authorization": `Bearer ${token}`
        }
      }
    );
    const userData = await userResp.json();
    const broadcasterId = userData.data[0].id;

    // tüm klipler
    const allClips = await getAllClips(broadcasterId, token);

    // 🔹 Popülerden az popülere sırala
    allClips.sort((a, b) => b.view_count - a.view_count);

    res.status(200).json({
      total: allClips.length,
      data: allClips
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

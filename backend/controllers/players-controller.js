const DEFAULT_API_ENDPOINT = "http://localhost:4001";

function getApiBase() {
  const raw = process.env.API_ENDPOINT || DEFAULT_API_ENDPOINT;
  return raw.replace(/\/+$/, "");
}

function extractPlayers(payload) {
  const source = Array.isArray(payload) ? payload : payload?.items || payload?.players || [];
  if (!Array.isArray(source)) {
    console.warn("Unexpected players payload format:", payload);
    return [];
  }

  return source.map((player) => ({
    name: player.name,
    status: player.status,
    pictureURL: player.pictureURL,
    positions: player.positions,
    team: player.team,
    ...player.currentStats,
  }));
}

function buildUpstreamUrl(query) {
  const searchParams = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, String(item)));
      return;
    }
    if (value != null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  const base = `${getApiBase()}/api/players`;
  return queryString ? `${base}?${queryString}` : base;
}

const getPlayers = async (req, res) => {
  if (!process.env.API_TOKEN) {
    return res.status(500).json({
      errorMessage: "Server configuration is missing API_TOKEN.",
    });
  }

  const url = buildUpstreamUrl(req.query);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-token": process.env.API_TOKEN,
      },
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      return res.status(response.status).json({
        errorMessage: data.errorMessage || data.message || "Failed to fetch players.",
      });
    }

    return res.status(200).json({
      success: true,
      players: extractPlayers(data),
    });
  } catch (err) {
    return res.status(502).json({
      errorMessage: `Unable to reach players service at ${url}.`,
    });
  }
}

module.exports = {
  getPlayers,
};

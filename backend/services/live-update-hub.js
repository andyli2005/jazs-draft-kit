const MAX_RECENT_NOTICES = 50;

const clients = new Set();
const recentNotices = [];

function safeJson(value) {
  return JSON.stringify(value).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function createNoticeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${safeJson(data)}\n\n`);
}

function addNotice(notice) {
  const storedNotice = {
    id: notice.id || createNoticeId(),
    receivedAt: new Date().toISOString(),
    ...notice,
  };

  recentNotices.unshift(storedNotice);
  if (recentNotices.length > MAX_RECENT_NOTICES) {
    recentNotices.length = MAX_RECENT_NOTICES;
  }

  for (const res of clients) {
    writeSse(res, "player-live-update", storedNotice);
  }

  return storedNotice;
}

function getRecentNotices() {
  return [...recentNotices];
}

function streamNotices(req, res) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  res.write("retry: 5000\n\n");
  clients.add(res);

  req.on("close", () => {
    clients.delete(res);
    res.end();
  });
}

module.exports = {
  addNotice,
  getRecentNotices,
  streamNotices,
};

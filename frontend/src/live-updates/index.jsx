import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getLiveUpdateEventUrl } from "./requests";
import {
  MAX_HISTORY_NOTICES,
  MAX_VISIBLE_NOTICES,
  clearStoredHistory,
  readStoredHistory,
  writeStoredHistory,
} from "./utils";

const LiveUpdateContext = createContext(null);

function parseEventNotice(event) {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

function mergeNotice(history, notice) {
  if (!notice?.id || history.some((item) => item.id === notice.id)) {
    return history;
  }
  return [notice, ...history].slice(0, MAX_HISTORY_NOTICES);
}

export function LiveUpdateProvider({ enabled, children }) {
  const [history, setHistory] = useState(() => readStoredHistory());
  const [popupNotices, setPopupNotices] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const historyRef = useRef(history);

  useEffect(() => {
    if (!enabled) {
      historyRef.current = [];
      clearStoredHistory();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const source = new EventSource(getLiveUpdateEventUrl(), { withCredentials: true });

    function handleLiveUpdate(event) {
      const notice = parseEventNotice(event);
      if (!notice?.id) return;

      const nextHistory = mergeNotice(historyRef.current, notice);
      const isNewNotice = nextHistory !== historyRef.current;
      if (isNewNotice) {
        historyRef.current = nextHistory;
        writeStoredHistory(nextHistory);
        setHistory(nextHistory);
        setPopupNotices((prev) => [notice, ...prev].slice(0, MAX_VISIBLE_NOTICES));
        setUnreadCount((prev) => prev + 1);
      }

      window.dispatchEvent(new CustomEvent("draft-kit:player-live-update", { detail: notice }));
    }

    source.addEventListener("player-live-update", handleLiveUpdate);
    return () => {
      source.removeEventListener("player-live-update", handleLiveUpdate);
      source.close();
    };
  }, [enabled]);

  const dismissPopup = useCallback((noticeId) => {
    setPopupNotices((prev) => prev.filter((notice) => notice.id !== noticeId));
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
    setPopupNotices([]);
    setUnreadCount(0);
    clearStoredHistory();
  }, []);

  const value = useMemo(
    () => ({
      history,
      popupNotices,
      unreadCount,
      dismissPopup,
      markAllRead,
      clearHistory,
    }),
    [history, popupNotices, unreadCount, dismissPopup, markAllRead, clearHistory]
  );

  return (
    <LiveUpdateContext.Provider value={value}>
      {children}
    </LiveUpdateContext.Provider>
  );
}

export function useLiveUpdates() {
  const context = useContext(LiveUpdateContext);
  if (!context) {
    throw new Error("useLiveUpdates must be used within LiveUpdateProvider");
  }
  return context;
}

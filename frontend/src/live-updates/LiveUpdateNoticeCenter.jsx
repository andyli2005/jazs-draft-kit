import { useLiveUpdates } from ".";
import { formatNoticeTime, getNoticeTitle } from "./utils";

function LiveUpdateNoticeCenter() {
  const { popupNotices, dismissPopup } = useLiveUpdates();

  if (popupNotices.length === 0) {
    return null;
  }

  return (
    <aside className="live-update-stack" aria-live="polite" aria-label="Live player updates">
      {popupNotices.map((notice) => (
        <article className={`live-update-notice live-update-${notice.type || "news"}`} key={notice.id}>
          <div className="live-update-notice-head">
            <div>
              <p className="live-update-label">{notice.isTest ? "Test player update" : "Player update"}</p>
              <h2>{getNoticeTitle(notice)}</h2>
            </div>
            <button
              type="button"
              className="live-update-close"
              aria-label="Dismiss notice"
              onClick={() => dismissPopup(notice.id)}
            >
              x
            </button>
          </div>
          <p className="live-update-message">{notice.message}</p>
          {notice.receivedAt ? <p className="live-update-time">{formatNoticeTime(notice.receivedAt)}</p> : null}
        </article>
      ))}
    </aside>
  );
}

export default LiveUpdateNoticeCenter;

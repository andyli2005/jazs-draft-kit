import { useLiveUpdates } from ".";
import { formatNoticeTime, getNoticeTitle } from "./utils";

function BellIcon() {
  return (
    <svg className="header-bell-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M10 21h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function LiveUpdateBell({ isOpen, onToggle }) {
  const { history, unreadCount, markAllRead, clearHistory } = useLiveUpdates();

  function handleToggle() {
    const willOpen = !isOpen;
    onToggle(willOpen);
    if (willOpen) {
      markAllRead();
    }
  }

  return (
    <>
      <button
        className="header-bell-trigger"
        type="button"
        onClick={handleToggle}
        aria-label="Open notifications"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="header-bell-badge" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="header-dropdown header-notifications-dropdown" role="menu" aria-label="Notifications menu">
          <div className="header-dropdown-section header-notifications-head">
            <div>
              <p className="header-dropdown-name">Notifications</p>
              <p className="header-dropdown-email">{history.length} current session</p>
            </div>
            {history.length > 0 ? (
              <button className="header-notifications-clear" type="button" onClick={clearHistory}>
                Clear
              </button>
            ) : null}
          </div>
          <hr className="header-dropdown-divider" />
          <div className="header-dropdown-section">
            {history.length === 0 ? (
              <p className="header-dropdown-email">No notifications yet.</p>
            ) : (
              <div className="header-notifications-list">
                {history.map((notice) => (
                  <article className="header-notification-item" key={notice.id} role="menuitem">
                    <div className="header-notification-top">
                      <strong>{getNoticeTitle(notice)}</strong>
                      {notice.receivedAt ? <span>{formatNoticeTime(notice.receivedAt)}</span> : null}
                    </div>
                    <p>{notice.message}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default LiveUpdateBell;

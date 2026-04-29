import { useEffect, useMemo, useRef, useState } from "react";
import { POSITION_OPTIONS } from "../leagues/positions";

function PositionChecklistDropdown({ selected = [], onChange, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  const selectedSet = useMemo(() => new Set(selected || []), [selected]);
  const summary = selected.length > 0 ? selected.join(", ") : "Select positions";

  useEffect(() => {
    function handleOutsideClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function togglePosition(position) {
    if (disabled) return;
    const next = selectedSet.has(position)
      ? selected.filter((item) => item !== position)
      : [...selected, position];
    onChange?.(next);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        className="modal-input"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        style={{
          width: "100%",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{summary}</span>
        <span>{isOpen ? "▴" : "▾"}</span>
      </button>
      {isOpen ? (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 30,
            width: "100%",
            maxHeight: "220px",
            overflowY: "auto",
            padding: "0.6rem",
            border: "1px solid #c8d2e9",
            borderRadius: "10px",
            background: "var(--surface, #fff)",
          }}
        >
          {POSITION_OPTIONS.map((position) => (
            <label key={position} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <input
                type="checkbox"
                checked={selectedSet.has(position)}
                onChange={() => togglePosition(position)}
                disabled={disabled}
              />
              <span>{position}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default PositionChecklistDropdown;

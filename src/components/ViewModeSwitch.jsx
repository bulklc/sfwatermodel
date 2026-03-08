import "./ViewModeSwitch.css";

const MODES = [
  { id: "2d-geo", label: "2D", col: "GEO", row: "2D", enabled: true },
  { id: "2d-sch", label: "2D", col: "SCH", row: "2D", enabled: false },
  { id: "3d-geo", label: "3D", col: "GEO", row: "3D", enabled: false },
  { id: "3d-sch", label: "3D", col: "SCH", row: "3D", enabled: false },
];

export default function ViewModeSwitch({ activeMode = "2d-geo" }) {
  return (
    <div className="view-mode-switch">
      {/* Column headers */}
      <div className="vms-header"></div>
      <div className="vms-col-label">GEO</div>
      <div className="vms-col-label">SCH</div>

      {/* 2D row */}
      <div className="vms-row-label">2D</div>
      {MODES.filter((m) => m.row === "2D").map((mode) => (
        <button
          key={mode.id}
          className={
            "vms-cell" +
            (activeMode === mode.id ? " vms-active" : "") +
            (!mode.enabled ? " vms-disabled" : "")
          }
          disabled={!mode.enabled}
          title={
            mode.enabled ?
              `${mode.row} ${mode.col}`
            : `${mode.row} ${mode.col} (coming soon)`
          }
        >
          {mode.row}
        </button>
      ))}

      {/* 3D row */}
      <div className="vms-row-label">3D</div>
      {MODES.filter((m) => m.row === "3D").map((mode) => (
        <button
          key={mode.id}
          className={
            "vms-cell" +
            (activeMode === mode.id ? " vms-active" : "") +
            (!mode.enabled ? " vms-disabled" : "")
          }
          disabled={!mode.enabled}
          title={
            mode.enabled ?
              `${mode.row} ${mode.col}`
            : `${mode.row} ${mode.col} (coming soon)`
          }
        >
          {mode.row}
        </button>
      ))}
    </div>
  );
}

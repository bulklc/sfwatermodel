import "./PopupStyles.css";
import { fmtNum } from "../../utils/fmt.js";

export default function OverflowPopup({ properties, results }) {
  const { name, elev } = properties;
  const shaftName = name + "_shaft";
  const shaftNode = results?.nodes?.[shaftName];
  const ovf = results?.overflow?.[name];
  const isActive = ovf?.active;

  return (
    <div className="popup-container">
      <div className="popup-header">Overflow Shaft</div>
      <div className="popup-row">
        <span className="popup-label">Weir Crest Elev (ft)</span>
        <span className="popup-value">{fmtNum(elev, 0)}</span>
      </div>
      {shaftNode && (
        <>
          <div className="popup-section-header">Hydraulic Results</div>
          <div className="popup-row">
            <span className="popup-label">Head (ft)</span>
            <span className="popup-value">{fmtNum(shaftNode.head)}</span>
          </div>
          <div className="popup-row">
            <span className="popup-label">Overflow Flow (MGD)</span>
            <span
              className="popup-value"
              style={{
                color: isActive ? "#c0392b" : "inherit",
                fontWeight: isActive ? 700 : "normal",
              }}
            >
              {fmtNum(ovf?.flow, 4)}
              {isActive ? " ⚠" : ""}
            </span>
          </div>
          <div className="popup-row">
            <span className="popup-label">Status</span>
            <span
              className="popup-value"
              style={{
                color: isActive ? "#c0392b" : "#27ae60",
                fontWeight: 700,
              }}
            >
              {isActive ? "OVERFLOW ACTIVE" : "No Overflow"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

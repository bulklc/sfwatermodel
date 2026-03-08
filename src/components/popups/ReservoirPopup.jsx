import "./PopupStyles.css";
import { fmtNum } from "../../utils/fmt.js";

export default function ReservoirPopup({ properties, results }) {
  const { name, elev } = properties;
  const r = results?.nodes?.[name];

  return (
    <div className="popup-container">
      <div className="popup-header">{name}</div>
      <div className="popup-row">
        <span className="popup-label">Elevation (ft)</span>
        <span className="popup-value">{fmtNum(elev, 0)}</span>
      </div>
      {r && (
        <>
          <div className="popup-section-header">Hydraulic Results</div>
          <div className="popup-row">
            <span className="popup-label">Head (ft)</span>
            <span className="popup-value">{fmtNum(r.head)}</span>
          </div>
          <div className="popup-row">
            <span className="popup-label">Net Flow (MGD)</span>
            <span className="popup-value">{fmtNum(r.demand)}</span>
          </div>
        </>
      )}
    </div>
  );
}

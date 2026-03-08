import "./PopupStyles.css";
import { fmtNum } from "../../utils/fmt.js";

export default function NodePopup({ properties, results }) {
  const { name, elev } = properties;
  const r = results?.nodes?.[name];

  return `
    <div class="popup-container">
      <div class="popup-header">${name}</div>
      <div class="popup-row">
        <span class="popup-label">Elevation (ft)</span>
        <span class="popup-value">${fmtNum(elev, 0)}</span>
      </div>
      ${
        r ?
          `
      <div class="popup-section-header">Hydraulic Results</div>
      <div class="popup-row">
        <span class="popup-label">Pressure (psi)</span>
        <span class="popup-value">${fmtNum(r.pressure)}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Head (ft)</span>
        <span class="popup-value">${fmtNum(r.head)}</span>
      </div>
      `
        : ""
      }
    </div>
  `;
}

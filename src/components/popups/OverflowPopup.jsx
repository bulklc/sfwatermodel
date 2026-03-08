import "./PopupStyles.css";
import { fmtNum } from "../../utils/fmt.js";

export default function OverflowPopup({ properties, results }) {
  const { name, elev } = properties;
  const shaftName = name + "_shaft";
  const shaftNode = results?.nodes?.[shaftName];
  const ovf = results?.overflow?.[name];
  const isActive = ovf?.active;

  return `
    <div class="popup-container">
      <div class="popup-header">Overflow Shaft</div>
      <div class="popup-row">
        <span class="popup-label">Weir Crest Elev (ft)</span>
        <span class="popup-value">${fmtNum(elev, 0)}</span>
      </div>
      ${
        shaftNode ?
          `
      <div class="popup-section-header">Hydraulic Results</div>
      <div class="popup-row">
        <span class="popup-label">Head (ft)</span>
        <span class="popup-value">${fmtNum(shaftNode.head)}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Overflow Flow (MGD)</span>
        <span class="popup-value" style="color: ${isActive ? "#c0392b" : "inherit"}; font-weight: ${isActive ? "700" : "normal"}">
          ${fmtNum(ovf?.flow, 4)}${isActive ? " ⚠" : ""}
        </span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Status</span>
        <span class="popup-value" style="color: ${isActive ? "#c0392b" : "#27ae60"}; font-weight: 700">
          ${isActive ? "OVERFLOW ACTIVE" : "No Overflow"}
        </span>
      </div>
      `
        : ""
      }
    </div>
  `;
}

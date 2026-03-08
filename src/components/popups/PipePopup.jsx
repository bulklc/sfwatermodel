import "./PopupStyles.css";
import { fmtNum } from "../../utils/fmt.js";

function capitalize(str) {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function PipePopup({ properties, results }) {
  const { name, size, type, length, us_node, ds_node } = properties;
  const r = results?.pipes?.[name];

  return `
    <div class="popup-container">
      <div class="popup-header">${name}</div>
      <div class="popup-row">
        <span class="popup-label">Size (in)</span>
        <span class="popup-value">${size ?? "—"}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Type</span>
        <span class="popup-value">${capitalize(type)}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Length (ft)</span>
        <span class="popup-value">${fmtNum(length, 0)}</span>
      </div>
      ${
        r ?
          `
      <div class="popup-section-header">Hydraulic Results</div>
      <div class="popup-row">
        <span class="popup-label">Flow (MGD)</span>
        <span class="popup-value">${fmtNum(r.flow)}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Velocity (ft/s)</span>
        <span class="popup-value">${fmtNum(r.velocity)}</span>
      </div>
      <div class="popup-row">
        <span class="popup-label">Headloss (ft)</span>
        <span class="popup-value">${fmtNum(r.headloss)}</span>
      </div>
      `
        : ""
      }
    </div>
  `;
}

import { useState, useEffect, useRef } from "react";
import "./PopupStyles.css";
import { fmtNum } from "../../utils/fmt.js";

function capitalize(str) {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Butterfly valve "mode" derived from overrides:
 *   "open"      – fully open, no throttle loss
 *   "throttled" – open with user-tuned loss/flow setting
 *   "closed"    – valve shut
 */
function deriveMode(overrides, srcStatus) {
  if (overrides?.mode) return overrides.mode;
  // Legacy / initial: map source data status
  const isOpen =
    overrides?.status === "open" ||
    (!overrides?.status && String(srcStatus) === "1");
  if (!isOpen) return "closed";
  // If a non-zero setting was previously configured, treat as throttled
  if ((overrides?.setting ?? 0) !== 0) return "throttled";
  return "open";
}

export default function ValvePopup({
  properties,
  results,
  overrides,
  onOverrideChange,
}) {
  const { name, size, type, setting, status, elev } = properties;

  const isButterfly = type === "butterfly";
  const isGate = type === "gate";
  const isSluice = type === "sluice";
  const isControllable = isButterfly || isGate || isSluice;

  /* ── Effective values: override wins over source data ─────────── */
  const butterflyMode = isButterfly ? deriveMode(overrides, status) : null;
  const effectiveCalcType = overrides?.calcType ?? "TCV";
  const effectiveSetting = overrides?.setting ?? setting ?? 0;
  const effectiveStatus =
    overrides?.status ?? (String(status) === "1" ? "open" : "closed");
  const isOpen =
    isButterfly ? butterflyMode !== "closed" : effectiveStatus === "open";

  /* ── Slider local state (visual feedback during drag) ────────── */
  const [localSetting, setLocalSetting] = useState(effectiveSetting);
  const settingRef = useRef(effectiveSetting);

  useEffect(() => {
    setLocalSetting(effectiveSetting);
    settingRef.current = effectiveSetting;
  }, [effectiveSetting]);

  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setLocalSetting(val);
    settingRef.current = val;
  };

  const commitSetting = () => {
    onOverrideChange?.({
      ...(overrides || {}),
      calcType: effectiveCalcType,
      setting: settingRef.current,
      mode: butterflyMode,
      status: "open",
    });
  };

  /* ── Butterfly three-way mode handler ────────────────────────── */
  const handleModeChange = (newMode) => {
    const next = { ...(overrides || {}), mode: newMode };
    if (newMode === "open") {
      next.status = "open";
      next.calcType = "TCV";
      next.setting = 0;
    } else if (newMode === "throttled") {
      next.status = "open";
      next.calcType = next.calcType || "TCV";
      next.setting = next.setting ?? 0;
    } else {
      next.status = "closed";
    }
    onOverrideChange?.(next);
  };

  /* ── Calc-type handler (butterfly throttled only) ────────────── */
  const handleCalcTypeChange = (newType) => {
    onOverrideChange?.({
      ...(overrides || {}),
      calcType: newType,
      setting: 0,
      status: "open",
      mode: "throttled",
    });
  };

  /* ── Gate open/closed handler ────────────────────────────────── */
  const handleStatusChange = (newStatus) => {
    onOverrideChange?.({
      ...(overrides || {}),
      calcType: effectiveCalcType,
      setting: effectiveSetting,
      status: newStatus,
    });
  };

  /* ── Hydraulic results ───────────────────────────────────────── */
  const r = results?.valves?.[name];

  /* ── Slider config ───────────────────────────────────────────── */
  const sliderMax = effectiveCalcType === "TCV" ? 500 : 1000;
  const sliderStep = effectiveCalcType === "TCV" ? 0.5 : 1;
  const sliderLabel =
    effectiveCalcType === "TCV" ? "Loss Coeff. (K)" : "Target Flow (MGD)";

  /* ── Three-way switch position index ─────────────────────────── */
  const triModes = ["open", "throttled", "closed"];
  const triLabels = ["Full Open", "Throttled", "Closed"];
  const triIndex = triModes.indexOf(butterflyMode ?? "open");
  const triColors = {
    open: "#1f78b4",
    throttled: "#e6a817",
    closed: "#c0392b",
  };
  const thumbColor = triColors[butterflyMode ?? "open"];

  return (
    <div className="popup-container">
      <div className="popup-header">{name}</div>

      <div className="popup-row">
        <span className="popup-label">Type</span>
        <span className="popup-value">{capitalize(type)}</span>
      </div>
      <div className="popup-row">
        <span className="popup-label">Size (in)</span>
        <span className="popup-value">{size ?? "—"}</span>
      </div>
      <div className="popup-row">
        <span className="popup-label">Elevation (ft)</span>
        <span className="popup-value">{fmtNum(elev, 0)}</span>
      </div>

      {/* ── Butterfly: three-way slide switch ── */}
      {isButterfly && (
        <>
          <div className="popup-section-header">Controls</div>

          <div className="valve-control-group">
            <div className="valve-control-label">Valve Position</div>
            <div className="tri-switch">
              <div
                className="tri-switch-track"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  if (pct < 0.333) handleModeChange("open");
                  else if (pct < 0.667) handleModeChange("throttled");
                  else handleModeChange("closed");
                }}
              >
                <div
                  className="tri-switch-thumb"
                  style={{
                    left: `calc(${triIndex} * 33.333% + 1px)`,
                    background: thumbColor,
                  }}
                />
              </div>
              <div className="tri-switch-labels">
                {triModes.map((m, i) => (
                  <span
                    key={m}
                    className={`tri-switch-label${m === butterflyMode ? " tri-switch-label--active" : ""}`}
                    style={
                      m === butterflyMode ? { color: triColors[m] } : undefined
                    }
                    onClick={() => handleModeChange(m)}
                  >
                    {triLabels[i]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Throttled sub-controls – always rendered for stable height,
              hidden via visibility when not in throttled mode */}
          <div
            style={{
              visibility: butterflyMode === "throttled" ? "visible" : "hidden",
            }}
          >
            <div className="valve-control-group">
              <div className="valve-toggle">
                <button
                  className={`valve-toggle-btn${effectiveCalcType === "TCV" ? " valve-toggle-btn--active" : ""}`}
                  onClick={() => handleCalcTypeChange("TCV")}
                >
                  Loss Coeff. (K)
                </button>
                <button
                  className={`valve-toggle-btn${effectiveCalcType === "FCV" ? " valve-toggle-btn--active" : ""}`}
                  onClick={() => handleCalcTypeChange("FCV")}
                >
                  Flow (MGD)
                </button>
              </div>
            </div>

            <div className="valve-control-group">
              <div className="valve-slider-row">
                <button
                  className="valve-step-btn"
                  onClick={() => {
                    const next = Math.max(0, localSetting - sliderStep);
                    setLocalSetting(next);
                    settingRef.current = next;
                    onOverrideChange?.({
                      ...(overrides || {}),
                      calcType: effectiveCalcType,
                      setting: next,
                      mode: "throttled",
                      status: "open",
                    });
                  }}
                >
                  −
                </button>
                <input
                  type="range"
                  className="valve-slider"
                  min="0"
                  max={sliderMax}
                  step={sliderStep}
                  value={localSetting}
                  onChange={handleSliderChange}
                  onPointerUp={commitSetting}
                  onTouchEnd={commitSetting}
                />
                <button
                  className="valve-step-btn"
                  onClick={() => {
                    const next = Math.min(sliderMax, localSetting + sliderStep);
                    setLocalSetting(next);
                    settingRef.current = next;
                    onOverrideChange?.({
                      ...(overrides || {}),
                      calcType: effectiveCalcType,
                      setting: next,
                      mode: "throttled",
                      status: "open",
                    });
                  }}
                >
                  +
                </button>
                <span className="valve-slider-value">
                  {fmtNum(localSetting, 1)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Gate / Sluice: two-way slide switch ── */}
      {(isGate || isSluice) && (
        <>
          <div className="popup-section-header">Controls</div>
          <div className="valve-control-group">
            <div className="valve-control-label">Status</div>
            <div className="tri-switch">
              <div
                className="tri-switch-track tri-switch-track--two"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  handleStatusChange(pct < 0.5 ? "open" : "closed");
                }}
              >
                <div
                  className="tri-switch-thumb tri-switch-thumb--two"
                  style={{
                    left: isOpen ? "1px" : "calc(50% + 1px)",
                    background: isOpen ? "#1f78b4" : "#c0392b",
                  }}
                />
              </div>
              <div className="tri-switch-labels">
                <span
                  className={`tri-switch-label${isOpen ? " tri-switch-label--active" : ""}`}
                  style={isOpen ? { color: "#1f78b4" } : undefined}
                  onClick={() => handleStatusChange("open")}
                >
                  Open
                </span>
                <span
                  className={`tri-switch-label${!isOpen ? " tri-switch-label--active" : ""}`}
                  style={!isOpen ? { color: "#c0392b" } : undefined}
                  onClick={() => handleStatusChange("closed")}
                >
                  Closed
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Non-controllable valves: static status display */}
      {!isControllable && (
        <div className="popup-row">
          <span className="popup-label">Status</span>
          <span className="popup-value">
            <span
              className={`popup-badge ${isOpen ? "popup-badge--open" : "popup-badge--closed"}`}
            >
              {isOpen ? "Open" : "Closed"}
            </span>
          </span>
        </div>
      )}

      {/* ── Hydraulic Results ── */}
      {r && (
        <>
          <div className="popup-section-header">Hydraulic Results</div>
          <div className="popup-row">
            <span className="popup-label">Flow (MGD)</span>
            <span className="popup-value">{fmtNum(r.flow)}</span>
          </div>
          <div className="popup-row">
            <span className="popup-label">Velocity (ft/s)</span>
            <span className="popup-value">{fmtNum(r.velocity)}</span>
          </div>
        </>
      )}
    </div>
  );
}

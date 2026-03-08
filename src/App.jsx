import { useState, useEffect, useCallback } from "react";
import MapPanel from "./components/MapPanel.jsx";
import ViewModeSwitch from "./components/ViewModeSwitch.jsx";
import { runHydraulicModel } from "./epanetModel.js";
import "./App.css";

export default function App() {
  const [results, setResults] = useState(null);
  const [modelError, setModelError] = useState(null);
  const [valveOverrides, setValveOverrides] = useState({
    mocc_ph_turbine_1_inlet: {
      mode: "throttled",
      calcType: "FCV",
      setting: 323,
      status: "open",
    },
    mocc_ph_turbine_2_inlet: {
      mode: "throttled",
      calcType: "FCV",
      setting: 323,
      status: "open",
    },
  });

  useEffect(() => {
    setModelError(null);
    runHydraulicModel(valveOverrides)
      .then(setResults)
      .catch((err) => {
        console.error("EPANET model error:", err);
        setModelError(err.message);
      });
  }, [valveOverrides]);

  const handleValveOverrideChange = useCallback((valveName, override) => {
    setValveOverrides((prev) => ({ ...prev, [valveName]: override }));
  }, []);

  return (
    <div className="app-container">
      <div className="main-panel">
        <div className="view-mode-switch-wrapper">
          <ViewModeSwitch activeMode="2d-geo" />
        </div>
        {results && (
          <MapPanel
            hydraulicResults={results}
            valveOverrides={valveOverrides}
            onValveOverrideChange={handleValveOverrideChange}
          />
        )}
        {modelError && (
          <div className="status-overlay status-error">
            Model error: {modelError}
          </div>
        )}
        {!results && !modelError && (
          <div className="status-overlay">Running hydraulic model…</div>
        )}
      </div>
    </div>
  );
}

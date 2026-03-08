import { useEffect, useRef } from "react";
import "./HelpModal.css";

/**
 * Help / About modal — describes how the app works.
 *
 * ⚠️  AGENT NOTE: Update this content whenever app functionality changes
 *     (new layers, popup fields, valve types, model inputs, etc.).
 */
export default function HelpModal({ open, onClose }) {
  const backdropRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="help-modal-backdrop"
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="help-modal">
        <button className="help-modal-close" onClick={onClose} title="Close">
          ✕
        </button>

        <section>
          <h3>Overview</h3>
          <p>
            This application provides an interactive steady-state hydraulic
            model of the San Francisco water transmission system between Priest
            Reservoir and Moccasin Powerhouse. You can visualize how water flows
            through tunnels, penstocks, and valves under different operating
            configurations and see computed pressures, heads, and flow rates at
            every point in the system.
          </p>
        </section>

        <section>
          <h3>Model Inputs &amp; Assumptions</h3>
          <p>
            All elevations are referenced to the{" "}
            <strong>North American Vertical Datum of 1988 (NAVD 88)</strong>.
          </p>
          <ul>
            <li>
              <strong>Reservoirs</strong> are modeled as fixed-head boundaries.
              Priest Reservoir (upstream, ~2,204 FT elevation) and Moccasin
              Reservoir (downstream, ~920 FT) set the hydraulic gradient that
              drives all flow.
            </li>
            <li>
              <strong>Pipes &amp; Tunnels</strong> are defined by diameter (IN),
              length (FT), and type (tunnel or welded-steel pipe). Head loss is
              computed using the Hazen-Williams formula with a roughness
              coefficient (C) of 130.
            </li>
            <li>
              <strong>Valves</strong> have a defined size, type (butterfly,
              gate, or sluice), and default open/closed status. Butterfly valves
              at Moccasin Powerhouse default to "throttled" mode with a target
              flow of 323 MGD.
            </li>
            <li>
              <strong>Overflow Shaft</strong> is modeled as a weir at 2,190 FT
              elevation. A check-valve pipe allows water to spill only when
              system head exceeds the weir crest.
            </li>
            <li>
              <strong>Nodes</strong> (junctions) have a fixed elevation and zero
              demand — they are all transit points, not consumption endpoints.
            </li>
          </ul>
        </section>

        <section>
          <h3>How the Model Calculates Results</h3>
          <p>
            The app uses the{" "}
            <a
              href="https://github.com/modelcreate/epanet-js"
              target="_blank"
              rel="noreferrer"
            >
              epanet-js
            </a>{" "}
            library (a WebAssembly port of the EPA's EPANET 2 engine) to solve a
            steady-state hydraulic analysis entirely in your browser. The model:
          </p>
          <ol>
            <li>
              Builds a network of junctions, reservoirs, pipes, and valves from
              the system data. Butterfly valves are represented as either
              flow-control valves (which cap flow at a target rate you set in
              MGD) or throttle-control valves (which impose a head-loss
              coefficient you specify).
            </li>
            <li>
              Applies any valve overrides you have configured
              (open/closed/throttled settings).
            </li>
            <li>
              Solves the mass-balance and energy equations simultaneously to
              find the head at every node and the flow in every link.
            </li>
            <li>
              Derives additional quantities: throughflow at each junction (sum
              of absolute connected pipe flows ÷ 2), pressure head, and overflow
              status.
            </li>
          </ol>
          <p>
            The model re-runs automatically each time you change a valve
            setting. All units are US customary: flow in million gallons per day
            (MGD), lengths and heads in feet (FT), pressure in pounds per square
            inch (PSI).
          </p>
        </section>

        <section>
          <h3>Map Display</h3>
          <ul>
            <li>
              <strong>Pipes</strong> are drawn as lines sized proportionally to
              pipe diameter. Blue animated ("marching ants") lines indicate
              active flow; gray lines indicate no flow. Animation speed is
              proportional to flow rate.
            </li>
            <li>
              <strong>Nodes</strong> appear as black circle markers. You can
              hover to highlight them and click to open a popup.
            </li>
            <li>
              <strong>Valves</strong> appear as colored circle markers: blue =
              open, yellow = throttled, red = closed.
            </li>
            <li>
              <strong>Reservoirs &amp; Overflow</strong> are shown as filled
              polygons. The overflow polygon turns red with a pulsing badge when
              overflow is active.
            </li>
            <li>
              You can use the <strong>layer control</strong> (top-right) to
              toggle visibility of each element type.
            </li>
          </ul>
        </section>

        <section>
          <h3>Element Popups</h3>
          <p>
            Clicking any element on the map opens a popup with its details. In
            every popup table, values displayed in{" "}
            <strong style={{ color: "#4A90D9" }}>blue</strong> are calculated by
            the model; values in black are input data.
          </p>
          <ul>
            <li>
              <strong>Node Popup</strong> — Displays elevation, pressure,
              pressure head, total head, and in/out flow. A stacked bar chart
              compares the elevation + pressure-head breakdown against total
              head. Hovering over a chart bar highlights the corresponding table
              row.
            </li>
            <li>
              <strong>Pipe Popup</strong> — Displays flow, velocity, and
              headloss, plus upstream and downstream elevation, pressure head,
              and total head. Two charts appear below the table: a{" "}
              <em>bar chart</em> with stacked elevation + pressure-head bars and
              total-head bars for each end (upstream on the right, downstream on
              the left); and an <em>Energy Profile</em> line chart whose Y-axis
              is auto-scaled to the data range, plotting elevation (green
              dashed), HGL (gold solid), and EGL (blue solid) from the upstream
              to downstream end. Head loss and hydraulic gradient are shown
              below the charts. Hovering over a bar highlights the corresponding
              table row.
            </li>
            <li>
              <strong>Valve Popup</strong> — Displays the type, size, and
              elevation as static data. A tabulated results section shows flow,
              velocity, headloss, elevation, upstream and downstream pressure,
              pressure head, and total head. Negative pressure values are shown
              in red text. Below the table, a four-bar chart visualises the
              hydraulic grade: DS total head, DS stacked (elevation + pressure
              head), a dashed divider, US stacked (elevation + pressure head),
              and US total head. When pressure head is negative the amber bar
              extends downward below the elevation bar instead of stacking on
              top of it. Interactive controls allow changing the valve state:
              <ul>
                <li>
                  <em>Butterfly valves</em>: a three-way switch (Open /
                  Throttled / Closed). In throttled mode, the user selects
                  either a target flow or a head-loss coefficient and adjusts
                  the value with a slider.
                </li>
                <li>
                  <em>Gate &amp; Sluice valves</em>: a two-way switch (Open /
                  Closed).
                </li>
              </ul>
            </li>
            <li>
              <strong>Reservoir Popup</strong> — Displays elevation, computed
              head, and net flow (demand).
            </li>
            <li>
              <strong>Overflow Popup</strong> — Displays weir crest elevation,
              head, overflow flow, and whether overflow is currently active.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

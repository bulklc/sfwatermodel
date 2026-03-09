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
              A <strong>layer control</strong> in the top-right corner lets you
              toggle visibility of each element type (Reservoirs, Overflow,
              Pipes, Nodes, Valves). This control is shared across all view
              modes and its layer order stays consistent. In 2D-GEO mode a
              <strong> Basemap</strong> toggle appears at the bottom of the
              list, letting you show or hide the satellite imagery.
            </li>
          </ul>
        </section>

        <section>
          <h3>View Modes</h3>
          <p>
            Use the <strong>2×2 switch</strong> in the lower-right corner to
            toggle between available view modes:
          </p>
          <ul>
            <li>
              <strong>2D GEO</strong> — Geographic view with satellite imagery
              showing elements at their real-world coordinates.
            </li>
            <li>
              <strong>2D SCH</strong> — Schematic view showing the network as a
              clean circuit-style diagram on a regular grid. Nodes are evenly
              spaced, pipes appear as straight or L-shaped lines, and reservoirs
              and overflow structures are shown as simple squares at the
              terminal points. No satellite imagery is shown.
            </li>
            <li>
              <strong>3D SCH</strong> — A three-dimensional isometric
              (orthographic) view of the schematic layout. Uses the same X/Y
              positions as 2D-SCH, but adds a Z-axis representing{" "}
              <em>elevation</em> and/or <em>total head</em>. Two overlapping
              overlays are shown:
              <ul>
                <li>
                  <strong>Elevation overlay</strong> (green) — elements
                  positioned vertically at their physical elevation.
                </li>
                <li>
                  <strong>Total Head overlay</strong> (blue) — elements
                  positioned at their hydraulic total head computed by the
                  model.
                </li>
              </ul>
              <strong>Reservoirs</strong> appear as translucent box prisms that
              float above their connected inlet infrastructure (nodes, valves,
              and pipes). Vertical riser lines extend from each connected
              element upward into the bottom of the reservoir solid, showing how
              water enters the system. <strong>Overflow</strong> appears as a
              smaller square-based prism whose top face sits just below the
              parent reservoir's top surface, visually representing the weir
              crest.
              <br />
              Hovering over any element highlights both its elevation and head
              representations simultaneously (provided both overlays have
              non-zero opacity), making the cross-layer association immediately
              clear. Two opacity sliders control the visibility of each overlay
              independently. The 3D view supports orbit controls (click &amp;
              drag to rotate, scroll to zoom, right-drag to pan). A{" "}
              <strong>ViewCube</strong> in the top-left corner displays the
              current camera orientation as a small 3D cube. Click any of its 26
              interactive regions — 6 faces, 12 edges, or 8 vertices — to snap
              the camera to a preset view: clicking a <em>face</em> gives a
              face-on 2D view along one axis; clicking an <em>edge</em> shows
              two dimensions equally; clicking a <em>vertex</em> provides an
              isometric view showing all three dimensions. When viewing a face
              head-on, two small <strong>↶ / ↷ rotate buttons</strong> appear
              below the ViewCube, allowing you to spin the 2D view in 90°
              increments clockwise or counter-clockwise. Pipes show animated
              dash-offset "marching ants" whose speed is proportional to flow
              rate, matching the 2D view. When model inputs change (valve
              settings, reservoir or overflow elevations), all 3D element
              positions transition smoothly to their new locations, making the
              hydraulic impact of each change visually clear. Clicking any
              element opens the same interactive popup as in 2D, including valve
              controls and elevation sliders.
            </li>
          </ul>
          <p>
            All views share the same hydraulic model results, popups, layer
            controls, and valve interactions. Only the coordinate system,
            perspective, and base map change.
          </p>
        </section>

        <section>
          <h3>Element Popups</h3>
          <p>
            Clicking any element on the map opens a popup with its details.
            Popups automatically adjust to stay within the visible area: in 2D
            views the map pans to fit the full popup, and in 3D the popup opens
            downward when the element is near the top of the screen. In every
            popup table, values displayed in{" "}
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
              and US total head. A transparent red bar centered on the dashed
              divider shows the headloss across the valve (spanning from the
              upstream total head down to the downstream total head); this bar
              is hidden when there is no headloss. When pressure head is
              negative the amber bar extends downward below the elevation bar
              instead of stacking on top of it. Interactive controls allow
              changing the valve state:
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
              <strong>Reservoir Popup</strong> — Displays elevation (FT, two
              decimal places) and net flow (demand). A slider with − / + buttons
              allows adjusting the elevation between 0 and 2,500 FT. The model
              re-calculates immediately when the elevation is changed.
            </li>
            <li>
              <strong>Overflow Popup</strong> — Displays weir crest elevation
              (FT, two decimal places), overflow flow, and whether overflow is
              currently active. A slider with − / + buttons allows adjusting the
              weir crest elevation between 0 and 2,500 FT. The model re-runs
              immediately with the updated value.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

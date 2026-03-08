import MapPanel from "./components/MapPanel.jsx";
import "./App.css";

export default function App() {
  return (
    <div className="app-container">
      <div className="top-half">
        <MapPanel />
      </div>
      <div className="bottom-half">
        <p>Bottom panel — coming soon</p>
      </div>
    </div>
  );
}

import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  Line,
  GizmoHelper,
  GizmoViewcube,
  useGizmoContext,
} from "@react-three/drei";
import * as THREE from "three";
import {
  nodesSch,
  pipesSch,
  valvesSch,
  reservoirsSch,
  overflowSch,
} from "../data.js";
import NodePopup from "./popups/NodePopup.jsx";
import PipePopup from "./popups/PipePopup.jsx";
import ValvePopup from "./popups/ValvePopup.jsx";
import ReservoirPopup from "./popups/ReservoirPopup.jsx";
import OverflowPopup from "./popups/OverflowPopup.jsx";
import { fmtNum } from "../utils/fmt.js";
import "./SchematicPanel3D.css";

/* ───────── constants ───────── */
const ELEV_MIN = 900;
const ELEV_MAX = 2250;
const Z_RANGE = 8; // visual Z units
const scaleZ = (val) => ((val - ELEV_MIN) / (ELEV_MAX - ELEV_MIN)) * Z_RANGE;

const ELEV_COLOR = "#95C13D";
const HEAD_COLOR = "#4A90D9";
const RESERVOIR_Z_BOOST = 0.5; // lift reservoir/overflow boxes above connected elements
const RESERVOIR_THICKNESS = 0.6; // Z-height of reservoir box
const OVERFLOW_SIDE = 0.6; // XY side length of overflow square prism
const LERP_SPEED = 8; // exponential lerp rate for smooth transitions

/* ───────── animated dashed pipe ───────── */
function AnimatedPipe({
  points,
  flow,
  maxFlow,
  pipeSize,
  opacity,
  onClick,
  onPointerOver,
  onPointerOut,
  highlighted,
}) {
  const lineRef = useRef();
  const [hovered, setHovered] = useState(false);
  const isHL = hovered || highlighted;
  const absFlow = Math.abs(flow);
  const hasFlow = absFlow > 0.001;

  // Animation: lerp line points toward target
  const lerpedPts = useRef(null);
  const targetPts = useRef(points);
  targetPts.current = points;

  // Determine direction: compare start vs end x-coordinate
  const sign = useMemo(() => {
    if (points.length < 2) return 1;
    return points[0][0] < points[points.length - 1][0] ? 1 : -1;
  }, [points]);

  const speed = hasFlow ? 0.3 + (absFlow / Math.max(maxFlow, 1)) * 2.0 : 0;
  const lineWidth = 1 + ((pipeSize - 48) / (120 - 48)) * 4;

  useFrame((_, dt) => {
    if (!lineRef.current) return;

    // Position lerping
    const target = targetPts.current;
    const n = target.length;
    if (!lerpedPts.current || lerpedPts.current.length !== n * 3) {
      lerpedPts.current = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        lerpedPts.current[i * 3] = target[i][0];
        lerpedPts.current[i * 3 + 1] = target[i][1];
        lerpedPts.current[i * 3 + 2] = target[i][2];
      }
    }
    const alpha = 1 - Math.exp(-LERP_SPEED * dt);
    const pts = lerpedPts.current;
    let posChanged = false;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) {
        const idx = i * 3 + j;
        const diff = target[i][j] - pts[idx];
        if (Math.abs(diff) > 0.0005) {
          pts[idx] += diff * alpha;
          posChanged = true;
        }
      }
    }
    if (posChanged && lineRef.current.geometry) {
      lineRef.current.geometry.setPositions(pts);
      lineRef.current.computeLineDistances();
    }

    // Dash animation
    if (hasFlow) {
      const mat = lineRef.current.material;
      if (mat) {
        mat.dashOffset += speed * sign * dt;
      }
    }
  });

  const baseColor = hasFlow ? "#1f78b4" : "#999";
  const color = isHL ? "#ffff00" : baseColor;
  const width = isHL ? lineWidth + 2 : lineWidth;

  const handleOver = useCallback(
    (e) => {
      e.stopPropagation();
      setHovered(true);
      onPointerOver?.(e);
    },
    [onPointerOver],
  );
  const handleOut = useCallback(
    (e) => {
      setHovered(false);
      onPointerOut?.(e);
    },
    [onPointerOut],
  );

  return (
    <Line
      ref={lineRef}
      points={points}
      color={color}
      lineWidth={width}
      dashed={hasFlow}
      dashSize={0.3}
      gapSize={0.15}
      opacity={opacity}
      transparent={opacity < 1}
      onClick={onClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    />
  );
}

/* ───────── node sphere ───────── */
function NodeSphere({
  position,
  color,
  radius,
  opacity,
  onClick,
  onPointerOver,
  onPointerOut,
  highlighted,
}) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const isHL = hovered || highlighted;

  // Animation: lerp position
  const currentPos = useRef(position.slice());
  const targetPos = useRef(position);
  targetPos.current = position;

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const alpha = 1 - Math.exp(-LERP_SPEED * dt);
    const c = currentPos.current;
    const t = targetPos.current;
    c[0] += (t[0] - c[0]) * alpha;
    c[1] += (t[1] - c[1]) * alpha;
    c[2] += (t[2] - c[2]) * alpha;
    meshRef.current.position.set(c[0], c[1], c[2]);
  });

  const handleOver = useCallback(
    (e) => {
      e.stopPropagation();
      setHovered(true);
      onPointerOver?.(e);
    },
    [onPointerOver],
  );
  const handleOut = useCallback(
    (e) => {
      setHovered(false);
      onPointerOut?.(e);
    },
    [onPointerOut],
  );
  return (
    <mesh
      ref={meshRef}
      onClick={onClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <sphereGeometry args={[isHL ? radius * 1.35 : radius, 16, 16]} />
      <meshStandardMaterial
        color={isHL ? "#ffff00" : color}
        opacity={opacity}
        transparent={opacity < 1}
        emissive={isHL ? "#ffff00" : "#000000"}
        emissiveIntensity={isHL ? 0.5 : 0}
      />
    </mesh>
  );
}

/* ───────── reservoir box ───────── */
function ReservoirBox({
  center,
  size,
  color,
  opacity,
  onClick,
  onPointerOver,
  onPointerOut,
  highlighted,
}) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const isHL = hovered || highlighted;

  // Animation: lerp center position
  const currentCenter = useRef(center.slice());
  const targetCenter = useRef(center);
  targetCenter.current = center;

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const alpha = 1 - Math.exp(-LERP_SPEED * dt);
    const c = currentCenter.current;
    const t = targetCenter.current;
    c[0] += (t[0] - c[0]) * alpha;
    c[1] += (t[1] - c[1]) * alpha;
    c[2] += (t[2] - c[2]) * alpha;
    meshRef.current.position.set(c[0], c[1], c[2]);
  });

  const handleOver = useCallback(
    (e) => {
      e.stopPropagation();
      setHovered(true);
      onPointerOver?.(e);
    },
    [onPointerOver],
  );
  const handleOut = useCallback(
    (e) => {
      setHovered(false);
      onPointerOut?.(e);
    },
    [onPointerOut],
  );
  return (
    <mesh
      ref={meshRef}
      onClick={onClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={isHL ? "#ffff00" : color}
        opacity={isHL ? Math.min(opacity * 0.5 + 0.3, 1) : opacity * 0.5}
        transparent
        emissive={isHL ? "#ffff00" : "#000000"}
        emissiveIntensity={isHL ? 0.4 : 0}
      />
    </mesh>
  );
}

/* ───────── animated riser line ───────── */
function AnimatedRiser({ x, y, z1, z2, color, lineWidth, opacity }) {
  const lineRef = useRef();
  const currentZ = useRef([z1, z2]);
  const targetZ = useRef([z1, z2]);
  targetZ.current = [z1, z2];

  const points = useMemo(
    () => [
      [x, y, z1],
      [x, y, z2],
    ],
    [x, y, z1, z2],
  );

  useFrame((_, dt) => {
    if (!lineRef.current?.geometry) return;
    const alpha = 1 - Math.exp(-LERP_SPEED * dt);
    const c = currentZ.current;
    const t = targetZ.current;
    let changed = false;
    for (let i = 0; i < 2; i++) {
      const diff = t[i] - c[i];
      if (Math.abs(diff) > 0.0005) {
        c[i] += diff * alpha;
        changed = true;
      }
    }
    if (changed) {
      const flat = new Float32Array([x, y, c[0], x, y, c[1]]);
      lineRef.current.geometry.setPositions(flat);
    }
  });

  return (
    <Line
      ref={lineRef}
      points={points}
      color={color}
      lineWidth={lineWidth}
      opacity={opacity}
      transparent
    />
  );
}

/* ───────── ground grid ───────── */
function GroundGrid() {
  return (
    <gridHelper
      args={[30, 30, "#cbd5e1", "#e2e8f0"]}
      position={[14, 0, -5]}
      rotation={[Math.PI / 2, 0, 0]}
    />
  );
}

/* ───────── camera auto-fit on mount ───────── */
function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(0, 0, 1); // Z is up
    camera.position.set(14, -18, 14);
    camera.lookAt(14, 5, 3);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

/* ───────── pointer cursor helper ───────── */
function usePointerCursor() {
  const { gl } = useThree();
  const onOver = useCallback(() => {
    gl.domElement.style.cursor = "pointer";
  }, [gl]);
  const onOut = useCallback(() => {
    gl.domElement.style.cursor = "auto";
  }, [gl]);
  return { onOver, onOut };
}

/* ───────── face-on detector + rotator ───────── */
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const FACE_THRESHOLD = 0.02; // how close to axis-aligned counts as face-on

/* Module-level rotation command — bypasses React/R3F boundary entirely */
let _rotatePending = null; // { angle: number } or null

/* Module-level viewcube navigation for top/bottom (bypasses GizmoHelper's
   degenerate lookAt when camera.up is parallel to view direction) */
let _viewcubeNav = null; // { direction: THREE.Vector3 } or null

/* Module-level animation state for smooth rotation */
let _rotateAnim = null; // { startQ, endQ, startUp, endUp, t, duration } or null
const ROTATE_DURATION = 0.3; // seconds
const VIEWCUBE_DURATION = 0.4; // seconds — slightly longer for viewcube nav

/* Custom viewcube wrapper — intercepts top/bottom clicks to avoid
   GizmoHelper's degenerate quaternion when looking along Z */
function CustomViewcube(props) {
  const { tweenCamera } = useGizmoContext();

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      // Determine the intended camera direction
      let direction;
      if (e.face && e.object.position.lengthSq() < 0.01) {
        // Face click (FaceCube mesh at origin)
        direction = e.face.normal.clone();
      } else {
        // Edge or corner click
        direction = e.object.position.clone().normalize();
      }

      // Intercept pure top/bottom face clicks (Z-axis dominant)
      if (
        Math.abs(direction.z) > 0.9 &&
        Math.abs(direction.x) < 0.1 &&
        Math.abs(direction.y) < 0.1
      ) {
        _viewcubeNav = { direction: direction.clone() };
      } else {
        tweenCamera(direction);
      }
    },
    [tweenCamera],
  );

  return (
    <group scale={0.867}>
      <GizmoViewcube {...props} onClick={handleClick} />
    </group>
  );
}

function FaceOnDetector({ controlsRef, onFaceOnChange }) {
  const { camera, invalidate } = useThree();
  const wasFaceOn = useRef(false);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;

    // 1a. Start viewcube navigation (top/bottom) if pending
    if (_viewcubeNav) {
      const { direction } = _viewcubeNav;
      _viewcubeNav = null;

      const target = controls.target;
      const radius = camera.position.distanceTo(target);
      const endPos = direction.clone().multiplyScalar(radius).add(target);
      // For top view (looking down -Z), up should be (0,1,0).
      // For bottom view (looking up +Z), up should be (0,1,0) as well.
      const endUp = new THREE.Vector3(0, 1, 0);

      const startQ = camera.quaternion.clone();
      const tempCam = camera.clone();
      tempCam.up.copy(endUp);
      tempCam.position.copy(endPos);
      tempCam.lookAt(target);
      tempCam.updateMatrixWorld(true);
      const endQ = tempCam.quaternion.clone();

      _rotateAnim = {
        startPos: camera.position.clone(),
        endPos,
        startUp: camera.up.clone(),
        endUp,
        startQ,
        endQ,
        t: 0,
        duration: VIEWCUBE_DURATION,
      };
    }

    // 1b. Start a new animated rotation if pending
    if (_rotatePending) {
      const { angle: angleDeg } = _rotatePending;
      _rotatePending = null;

      const target = controls.target;
      const dir = new THREE.Vector3()
        .subVectors(target, camera.position)
        .normalize();
      const angle = THREE.MathUtils.degToRad(angleDeg);
      const q = new THREE.Quaternion().setFromAxisAngle(dir, angle);

      // Compute target camera.up (snapped to axis)
      const targetUp = camera.up.clone().applyQuaternion(q).normalize();
      const ux = Math.abs(targetUp.x),
        uy = Math.abs(targetUp.y),
        uz = Math.abs(targetUp.z);
      if (ux >= uy && ux >= uz) targetUp.set(Math.sign(targetUp.x), 0, 0);
      else if (uy >= ux && uy >= uz) targetUp.set(0, Math.sign(targetUp.y), 0);
      else targetUp.set(0, 0, Math.sign(targetUp.z));

      // Compute target camera position
      const offset = new THREE.Vector3().subVectors(camera.position, target);
      const targetOffset = offset.clone().applyQuaternion(q);

      // Capture start quaternion from current camera orientation
      const startQ = camera.quaternion.clone();
      // Compute end quaternion by placing camera at target position
      const endPos = target.clone().add(targetOffset);
      const tempCam = camera.clone();
      tempCam.up.copy(targetUp);
      tempCam.position.copy(endPos);
      tempCam.lookAt(target);
      tempCam.updateMatrixWorld(true);
      const endQ = tempCam.quaternion.clone();

      _rotateAnim = {
        startPos: camera.position.clone(),
        endPos,
        startUp: camera.up.clone(),
        endUp: targetUp,
        startQ,
        endQ,
        t: 0,
        duration: ROTATE_DURATION,
      };
    }

    // 2. Animate rotation in progress
    if (_rotateAnim) {
      _rotateAnim.t += delta;
      const raw = Math.min(_rotateAnim.t / _rotateAnim.duration, 1);
      // Smooth ease-in-out
      const t = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;

      camera.position.lerpVectors(_rotateAnim.startPos, _rotateAnim.endPos, t);
      camera.up
        .lerpVectors(_rotateAnim.startUp, _rotateAnim.endUp, t)
        .normalize();
      camera.quaternion.slerpQuaternions(
        _rotateAnim.startQ,
        _rotateAnim.endQ,
        t,
      );
      camera.updateMatrixWorld(true);
      controls.update();
      invalidate();

      if (raw >= 1) {
        // Snap to exact final values
        camera.position.copy(_rotateAnim.endPos);
        camera.up.copy(_rotateAnim.endUp);
        camera.lookAt(controls.target);
        camera.updateMatrixWorld(true);
        controls.update();
        _rotateAnim = null;
      }
    }

    // 3. Fix degenerate camera.up when looking along Z-axis (top/bottom)
    //    GizmoHelper resets camera.up to (0,0,1) after animation, which is
    //    parallel to the view direction for top/bottom views → undefined roll.
    _dir.subVectors(controls.target, camera.position).normalize();
    const upDotView = Math.abs(camera.up.dot(_dir));
    if (upDotView > 0.99) {
      // Degenerate: camera.up is ~parallel to view direction.
      // Use (0,1,0) for top view so X→right, Y→up matching 2D schematic layout.
      if (_dir.z < 0)
        camera.up.set(0, 1, 0); // top view
      else camera.up.set(0, 1, 0); // bottom view
      controls.update();
      invalidate();
    }

    // 4. Detect face-on
    const ax = Math.abs(_dir.x),
      ay = Math.abs(_dir.y),
      az = Math.abs(_dir.z);
    const isFaceOn =
      (ax > 1 - FACE_THRESHOLD && ay < FACE_THRESHOLD && az < FACE_THRESHOLD) ||
      (ay > 1 - FACE_THRESHOLD && ax < FACE_THRESHOLD && az < FACE_THRESHOLD) ||
      (az > 1 - FACE_THRESHOLD && ax < FACE_THRESHOLD && ay < FACE_THRESHOLD);

    if (isFaceOn !== wasFaceOn.current) {
      wasFaceOn.current = isFaceOn;
      onFaceOnChange(isFaceOn);
    }
  });

  return null;
}

/* ═══════════════════════════════════════════════ */
/*  SCENE CONTENT – renders inside <Canvas>       */
/* ═══════════════════════════════════════════════ */
function SceneContent({
  hydraulicResults: r,
  valveOverrides,
  onValveOverrideChange,
  elevOverrides,
  onElevOverrideChange,
  elevOpacity,
  headOpacity,
  layerVis,
  onFaceOnChange,
}) {
  const [popup, setPopup] = useState(null);
  const [hoveredElement, setHoveredElement] = useState(null);
  const { camera, size, gl } = useThree();
  const hoverIn = useCallback(
    (id) => {
      setHoveredElement(id);
      gl.domElement.style.cursor = "pointer";
    },
    [gl],
  );
  const hoverOut = useCallback(() => {
    setHoveredElement(null);
    gl.domElement.style.cursor = "auto";
  }, [gl]);
  const popupRef = useRef(null);

  // Close popup on ESC key
  useEffect(() => {
    if (!popup) return;
    const handler = (e) => {
      if (e.key === "Escape") setPopup(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [popup]);

  // Close popup on mousedown outside the popup DOM element
  useEffect(() => {
    if (!popup) return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setPopup(null);
      }
    };
    // Use a short delay so the opening click doesn't immediately close it
    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", handler);
    };
  }, [popup]);

  // After popup renders, check if it overflows the viewport.
  // If so, pan the orbit controls target so the popup is fully visible.
  const controlsRef = useRef(null);
  useEffect(() => {
    if (!popup || !popupRef.current) return;
    // Wait for the DOM to lay out
    const timer = requestAnimationFrame(() => {
      const el = popupRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 10;
      let panX = 0,
        panY = 0;
      if (rect.top < pad) panY = rect.top - pad; // negative → need to pan scene down (screen up)
      if (rect.bottom > vh - pad) panY = rect.bottom - (vh - pad); // positive → pan scene up
      if (rect.left < pad) panX = rect.left - pad;
      if (rect.right > vw - pad) panX = rect.right - (vw - pad);

      if ((panX !== 0 || panY !== 0) && controlsRef.current) {
        // Convert pixel pan to world units using the camera
        const cam = camera;
        const dist = cam.position.distanceTo(controlsRef.current.target);
        const fovRad = THREE.MathUtils.degToRad(cam.fov || 50);
        const worldPerPx = (2 * dist * Math.tan(fovRad / 2)) / size.height;

        // Camera's right and up vectors in world space
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        cam.matrixWorld.extractBasis(right, up, new THREE.Vector3());

        const shift = new THREE.Vector3()
          .addScaledVector(right, panX * worldPerPx)
          .addScaledVector(up, -panY * worldPerPx); // screen Y is flipped

        controlsRef.current.target.add(shift);
        cam.position.add(shift);
        controlsRef.current.update();
      }
    });
    return () => cancelAnimationFrame(timer);
  }, [popup, camera, size]);

  // Max flow for animation speed scaling
  const maxFlow = useMemo(() => {
    if (!r?.pipes) return 1;
    let m = 1;
    for (const p of Object.values(r.pipes)) {
      const af = Math.abs(p.flow || 0);
      if (af > m) m = af;
    }
    return m;
  }, [r]);

  // Helper: get head/elev for a node-like element
  const getNodeHead = useCallback(
    (name) => r?.nodes?.[name]?.head ?? null,
    [r],
  );
  const getNodeElev = useCallback(
    (name, fallbackElev) => {
      // Check for elev override
      const ov = elevOverrides?.[name];
      if (ov != null) return ov;
      return fallbackElev;
    },
    [elevOverrides],
  );

  /* ── Build element arrays ── */
  const nodeElements = useMemo(() => {
    return nodesSch.features.map((f) => {
      const name = f.properties.name;
      const [x, y] = f.geometry.coordinates;
      const elev = getNodeElev(name, f.properties.elev);
      const head = getNodeHead(name);
      return { name, x, y, elev, head, properties: f.properties };
    });
  }, [getNodeElev, getNodeHead]);

  const valveElements = useMemo(() => {
    return valvesSch.features.map((f) => {
      const name = f.properties.name;
      const [x, y] = f.geometry.coordinates;
      const elev = f.properties.elev;
      // For valves, we can compute head from upstream/downstream
      const vRes = r?.valves?.[name];
      const head = vRes ? (vRes.us_head + vRes.ds_head) / 2 : null;
      return { name, x, y, elev, head, properties: f.properties, vRes };
    });
  }, [r]);

  // All node + valve positions for reservoir proximity expansion
  const allNodeValvePositions = useMemo(() => {
    const pts = [];
    for (const f of nodesSch.features) {
      const [x, y] = f.geometry.coordinates;
      pts.push({ x, y, elev: f.properties.elev });
    }
    for (const f of valvesSch.features) {
      const [x, y] = f.geometry.coordinates;
      pts.push({ x, y, elev: f.properties.elev });
    }
    return pts;
  }, []);

  const reservoirElements = useMemo(() => {
    return reservoirsSch.features.map((f) => {
      const name = f.properties.name;
      const resElev = f.properties.elev;
      const elev = getNodeElev(name, resElev);
      const head = getNodeHead(name);
      const ring = f.geometry.coordinates[0][0];
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const [px, py] of ring) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      // Expand bbox to cover nearby nodes/valves at similar elevation.
      // This positions the reservoir box "over" its inlet infrastructure.
      const origW = maxX - minX,
        origH = maxY - minY;
      const ctrX = (minX + maxX) / 2,
        ctrY = (minY + maxY) / 2;
      const maxDist = Math.max(Math.max(origW, origH) * 1.25, 2.5);
      const elevThresh = 150; // ft
      let eMinX = minX,
        eMaxX = maxX,
        eMinY = minY,
        eMaxY = maxY;
      for (const el of allNodeValvePositions) {
        const d = Math.hypot(el.x - ctrX, el.y - ctrY);
        if (d <= maxDist && Math.abs(el.elev - resElev) <= elevThresh) {
          eMinX = Math.min(eMinX, el.x);
          eMaxX = Math.max(eMaxX, el.x);
          eMinY = Math.min(eMinY, el.y);
          eMaxY = Math.max(eMaxY, el.y);
        }
      }
      return {
        name,
        elev,
        head,
        cx: (eMinX + eMaxX) / 2,
        cy: (eMinY + eMaxY) / 2,
        w: eMaxX - eMinX + 0.6, // pad so box visually encloses nodes
        h: eMaxY - eMinY + 0.6,
        eMinX: eMinX - 0.3, // padded bounds for riser detection
        eMaxX: eMaxX + 0.3,
        eMinY: eMinY - 0.3,
        eMaxY: eMaxY + 0.3,
        properties: f.properties,
      };
    });
  }, [getNodeElev, getNodeHead, allNodeValvePositions]);

  const overflowElements = useMemo(() => {
    return overflowSch.features.map((f) => {
      const name = f.properties.name;
      const elev = getNodeElev(name, f.properties.elev);
      const head = getNodeHead(name);
      const isActive = r?.overflow?.[name]?.active;

      // Find the nearest reservoir to position this overflow relative to it
      let nearestRes = null;
      let nearestDist = Infinity;
      const ovNode = nodesSch.features.find(
        (nf) => nf.properties.name === name,
      );
      const ovX = ovNode ? ovNode.geometry.coordinates[0] : 0;
      const ovY = ovNode ? ovNode.geometry.coordinates[1] : 0;
      for (const res of reservoirElements) {
        const d = Math.hypot(ovX - res.cx, ovY - res.cy);
        if (d < nearestDist) {
          nearestDist = d;
          nearestRes = res;
        }
      }

      // Small square prism, positioned at the overflow node's XY,
      // with top face just below the parent reservoir's top surface.
      const cx = ovX;
      const cy = ovY;

      return {
        name,
        elev,
        head,
        cx,
        cy,
        parentRes: nearestRes,
        isActive,
        properties: f.properties,
      };
    });
  }, [getNodeElev, getNodeHead, r, reservoirElements]);

  // Build a lookup of valve XY → displayed head Z so pipes can snap to them
  const valveHeadZByXY = useMemo(() => {
    const map = new Map();
    for (const v of valveElements) {
      if (v.head != null) {
        // Key by rounded XY to handle floating point
        const key = `${v.x.toFixed(4)},${v.y.toFixed(4)}`;
        map.set(key, scaleZ(v.head));
      }
    }
    return map;
  }, [valveElements]);

  const valveElevZByXY = useMemo(() => {
    const map = new Map();
    for (const v of valveElements) {
      const key = `${v.x.toFixed(4)},${v.y.toFixed(4)}`;
      map.set(key, scaleZ(v.elev));
    }
    return map;
  }, [valveElements]);

  const pipeElements = useMemo(() => {
    return pipesSch.features.map((f) => {
      const name = f.properties.name;
      const pRes = r?.pipes?.[name];
      const flow = pRes?.flow || 0;
      const usElev = pRes?.us_elev ?? 0;
      const dsElev = pRes?.ds_elev ?? 0;
      const usHead = pRes?.us_head ?? 0;
      const dsHead = pRes?.ds_head ?? 0;

      // Build 3D points from 2D schematic line
      const coords =
        f.geometry.type === "MultiLineString" ?
          f.geometry.coordinates[0]
        : f.geometry.coordinates;
      const n = coords.length;
      const elevPoints = coords.map(([x, y], i) => {
        const t = n > 1 ? i / (n - 1) : 0;
        let z = scaleZ(usElev + (dsElev - usElev) * t);
        // Snap endpoints to valve displayed elevation
        if (i === 0 || i === n - 1) {
          const key = `${x.toFixed(4)},${y.toFixed(4)}`;
          const vz = valveElevZByXY.get(key);
          if (vz != null) z = vz;
        }
        return [x, y, z];
      });
      const headPoints = coords.map(([x, y], i) => {
        const t = n > 1 ? i / (n - 1) : 0;
        let z = scaleZ(usHead + (dsHead - usHead) * t);
        // Snap endpoints to valve displayed head
        if (i === 0 || i === n - 1) {
          const key = `${x.toFixed(4)},${y.toFixed(4)}`;
          const vz = valveHeadZByXY.get(key);
          if (vz != null) z = vz;
        }
        return [x, y, z];
      });
      return {
        name,
        flow,
        size: f.properties.size || 48,
        elevPoints,
        headPoints,
        properties: f.properties,
      };
    });
  }, [r, valveHeadZByXY, valveElevZByXY]);

  // Vertical risers: for each pipe endpoint or valve that sits under a
  // reservoir's XY footprint, draw a vertical line from the element up to
  // the reservoir bottom.  We compute separate risers for elev and head.
  const reservoirRisers = useMemo(() => {
    const risers = { elev: [], head: [] };
    for (const res of reservoirElements) {
      const elevBotZ =
        scaleZ(res.elev) + RESERVOIR_Z_BOOST - RESERVOIR_THICKNESS / 2;
      const headBotZ =
        res.head != null ?
          scaleZ(res.head) + RESERVOIR_Z_BOOST - RESERVOIR_THICKNESS / 2
        : null;

      const isInside = (x, y) =>
        x >= res.eMinX && x <= res.eMaxX && y >= res.eMinY && y <= res.eMaxY;

      // Check valve positions
      for (const v of valveElements) {
        if (isInside(v.x, v.y)) {
          const vElevZ = scaleZ(v.elev);
          if (vElevZ < elevBotZ) {
            risers.elev.push({
              key: `riser-elev-v-${v.name}-${res.name}`,
              x: v.x,
              y: v.y,
              z1: vElevZ,
              z2: elevBotZ,
            });
          }
          if (v.head != null && headBotZ != null) {
            const vHeadZ = scaleZ(v.head);
            if (vHeadZ < headBotZ) {
              risers.head.push({
                key: `riser-head-v-${v.name}-${res.name}`,
                x: v.x,
                y: v.y,
                z1: vHeadZ,
                z2: headBotZ,
              });
            }
          }
        }
      }

      // Check pipe endpoints
      for (const p of pipeElements) {
        for (const overlay of ["elev", "head"]) {
          const pts = overlay === "elev" ? p.elevPoints : p.headPoints;
          const botZ = overlay === "elev" ? elevBotZ : headBotZ;
          if (botZ == null) continue;
          for (const endIdx of [0, pts.length - 1]) {
            const [px, py, pz] = pts[endIdx];
            if (isInside(px, py) && pz < botZ) {
              risers[overlay].push({
                key: `riser-${overlay}-p-${p.name}-${endIdx}-${res.name}`,
                x: px,
                y: py,
                z1: pz,
                z2: botZ,
              });
            }
          }
        }
      }
    }
    return risers;
  }, [reservoirElements, valveElements, pipeElements]);

  /* ── Render popup HTML overlay ── */
  const renderPopup = () => {
    if (!popup) return null;
    const { type, position, properties, name } = popup;
    let content;
    switch (type) {
      case "node":
        content = <NodePopup properties={properties} results={r} />;
        break;
      case "pipe":
        content = <PipePopup properties={properties} results={r} />;
        break;
      case "valve":
        content = (
          <ValvePopup
            properties={properties}
            results={r}
            overrides={valveOverrides?.[name]}
            onOverrideChange={(o) => onValveOverrideChange?.(name, o)}
          />
        );
        break;
      case "reservoir":
        content = (
          <ReservoirPopup
            properties={properties}
            results={r}
            elevOverride={elevOverrides?.[name]}
            onElevChange={(elev) => onElevOverrideChange?.(name, elev)}
          />
        );
        break;
      case "overflow":
        content = (
          <OverflowPopup
            properties={properties}
            results={r}
            elevOverride={elevOverrides?.[name]}
            onElevChange={(elev) => onElevOverrideChange?.(name, elev)}
          />
        );
        break;
      default:
        return null;
    }
    return (
      <Html
        position={position}
        zIndexRange={[1000, 0]}
        style={{
          transform:
            popup.openBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
          marginTop: popup.openBelow ? "12px" : "-12px",
          pointerEvents: "auto",
        }}
      >
        <div
          ref={popupRef}
          className="three-d-popup-wrapper"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <button
            className="three-d-popup-close"
            onClick={() => setPopup(null)}
          >
            ×
          </button>
          {content}
        </div>
      </Html>
    );
  };

  /* ── Click helpers ── */
  const openPopup = (type, name, properties, position) => (e) => {
    e.stopPropagation();
    // Project 3D position to screen Y to decide popup direction
    const vec = new THREE.Vector3(...position);
    vec.project(camera);
    const screenY = ((1 - vec.y) / 2) * size.height;
    const openBelow = screenY < size.height * 0.35;
    setPopup({ type, name, properties, position, openBelow });
  };

  /* ── Valve color logic (matches 2D) ── */
  const valveColor = useCallback(
    (v) => {
      const ov = valveOverrides?.[v.name];
      if (v.properties.type === "butterfly") {
        let mode = ov?.mode;
        if (!mode) {
          const isOpen =
            ov?.status === "open" ||
            (!ov?.status && String(v.properties.status) === "1");
          mode =
            !isOpen ? "closed"
            : (ov?.setting ?? 0) !== 0 ? "throttled"
            : "open";
        }
        if (mode === "throttled") return "#e6a817";
        if (mode === "closed") return "#c0392b";
        return "#1f78b4";
      }
      const isOpen =
        ov?.status === "open" ||
        (!ov?.status && String(v.properties.status) === "1");
      return isOpen ? "#1f78b4" : "#c0392b";
    },
    [valveOverrides],
  );

  return (
    <>
      <CameraSetup />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, -10, 15]} intensity={0.8} />
      <directionalLight position={[-5, 10, 10]} intensity={0.3} />

      <GroundGrid />

      {/* ═══ ELEVATION OVERLAY ═══ */}
      {elevOpacity > 0 && (
        <group>
          {/* Nodes */}
          {layerVis.nodes &&
            nodeElements.map((n) => (
              <NodeSphere
                key={`elev-n-${n.name}`}
                position={[n.x, n.y, scaleZ(n.elev)]}
                color="#333"
                radius={0.15}
                opacity={elevOpacity}
                onClick={openPopup("node", n.name, n.properties, [
                  n.x,
                  n.y,
                  scaleZ(n.elev),
                ])}
                onPointerOver={() => hoverIn("n:" + n.name)}
                onPointerOut={hoverOut}
                highlighted={hoveredElement === "n:" + n.name}
              />
            ))}

          {/* Valves */}
          {layerVis.valves &&
            valveElements.map((v) => (
              <NodeSphere
                key={`elev-v-${v.name}`}
                position={[v.x, v.y, scaleZ(v.elev)]}
                color={valveColor(v)}
                radius={0.2}
                opacity={elevOpacity}
                onClick={openPopup("valve", v.name, v.properties, [
                  v.x,
                  v.y,
                  scaleZ(v.elev),
                ])}
                onPointerOver={() => hoverIn("v:" + v.name)}
                onPointerOut={hoverOut}
                highlighted={hoveredElement === "v:" + v.name}
              />
            ))}

          {/* Reservoirs */}
          {layerVis.reservoirs &&
            reservoirElements.map((res) => {
              const z = scaleZ(res.elev) + RESERVOIR_Z_BOOST;
              return (
                <ReservoirBox
                  key={`elev-r-${res.name}`}
                  center={[res.cx, res.cy, z]}
                  size={[res.w, res.h, RESERVOIR_THICKNESS]}
                  color="#a6cde3"
                  opacity={elevOpacity}
                  onClick={openPopup("reservoir", res.name, res.properties, [
                    res.cx,
                    res.cy,
                    z,
                  ])}
                  onPointerOver={() => hoverIn("r:" + res.name)}
                  onPointerOut={hoverOut}
                  highlighted={hoveredElement === "r:" + res.name}
                />
              );
            })}

          {/* Overflow */}
          {layerVis.overflow &&
            overflowElements.map((ov) => {
              // Position overflow as small square prism with top just below
              // its parent reservoir's top surface
              const parentTopZ =
                ov.parentRes ?
                  scaleZ(ov.parentRes.elev) +
                  RESERVOIR_Z_BOOST +
                  RESERVOIR_THICKNESS / 2
                : scaleZ(ov.elev) + RESERVOIR_Z_BOOST;
              const ovThickness = RESERVOIR_THICKNESS * 0.5;
              const ovTopZ = parentTopZ - 0.05; // just below reservoir top
              const ovCenterZ = ovTopZ - ovThickness / 2;
              return (
                <ReservoirBox
                  key={`elev-o-${ov.name}`}
                  center={[ov.cx, ov.cy, ovCenterZ]}
                  size={[OVERFLOW_SIDE, OVERFLOW_SIDE, ovThickness]}
                  color={ov.isActive ? "#e74c3c" : "#a6cde3"}
                  opacity={elevOpacity}
                  onClick={openPopup("overflow", ov.name, ov.properties, [
                    ov.cx,
                    ov.cy,
                    ovCenterZ,
                  ])}
                  onPointerOver={() => hoverIn("o:" + ov.name)}
                  onPointerOut={hoverOut}
                  highlighted={hoveredElement === "o:" + ov.name}
                />
              );
            })}

          {/* Pipes */}
          {layerVis.pipes &&
            pipeElements.map((p) => (
              <AnimatedPipe
                key={`elev-p-${p.name}`}
                points={p.elevPoints}
                flow={p.flow}
                maxFlow={maxFlow}
                pipeSize={p.size}
                opacity={elevOpacity}
                onClick={openPopup("pipe", p.name, p.properties, [
                  p.elevPoints[0][0],
                  p.elevPoints[0][1],
                  p.elevPoints[0][2],
                ])}
                onPointerOver={() => hoverIn("p:" + p.name)}
                onPointerOut={hoverOut}
                highlighted={hoveredElement === "p:" + p.name}
              />
            ))}

          {/* Vertical risers — pipes/valves up to reservoir bottom */}
          {layerVis.reservoirs &&
            reservoirRisers.elev.map((ri) => (
              <AnimatedRiser
                key={ri.key}
                x={ri.x}
                y={ri.y}
                z1={ri.z1}
                z2={ri.z2}
                color="#1f78b4"
                lineWidth={2}
                opacity={elevOpacity * 0.7}
              />
            ))}
        </group>
      )}

      {/* ═══ HEAD OVERLAY ═══ */}
      {headOpacity > 0 && (
        <group>
          {/* Nodes */}
          {layerVis.nodes &&
            nodeElements
              .filter((n) => n.head != null)
              .map((n) => (
                <NodeSphere
                  key={`head-n-${n.name}`}
                  position={[n.x, n.y, scaleZ(n.head)]}
                  color={HEAD_COLOR}
                  radius={0.15}
                  opacity={headOpacity}
                  onClick={openPopup("node", n.name, n.properties, [
                    n.x,
                    n.y,
                    scaleZ(n.head),
                  ])}
                  onPointerOver={() => hoverIn("n:" + n.name)}
                  onPointerOut={hoverOut}
                  highlighted={hoveredElement === "n:" + n.name}
                />
              ))}

          {/* Valves */}
          {layerVis.valves &&
            valveElements
              .filter((v) => v.head != null)
              .map((v) => (
                <NodeSphere
                  key={`head-v-${v.name}`}
                  position={[v.x, v.y, scaleZ(v.head)]}
                  color={valveColor(v)}
                  radius={0.2}
                  opacity={headOpacity}
                  onClick={openPopup("valve", v.name, v.properties, [
                    v.x,
                    v.y,
                    scaleZ(v.head),
                  ])}
                  onPointerOver={() => hoverIn("v:" + v.name)}
                  onPointerOut={hoverOut}
                  highlighted={hoveredElement === "v:" + v.name}
                />
              ))}

          {/* Reservoirs */}
          {layerVis.reservoirs &&
            reservoirElements
              .filter((res) => res.head != null)
              .map((res) => {
                const z = scaleZ(res.head) + RESERVOIR_Z_BOOST;
                return (
                  <ReservoirBox
                    key={`head-r-${res.name}`}
                    center={[res.cx, res.cy, z]}
                    size={[res.w, res.h, RESERVOIR_THICKNESS]}
                    color={HEAD_COLOR}
                    opacity={headOpacity}
                    onClick={openPopup("reservoir", res.name, res.properties, [
                      res.cx,
                      res.cy,
                      z,
                    ])}
                    onPointerOver={() => hoverIn("r:" + res.name)}
                    onPointerOut={hoverOut}
                    highlighted={hoveredElement === "r:" + res.name}
                  />
                );
              })}

          {/* Overflow */}
          {layerVis.overflow &&
            overflowElements
              .filter((ov) => ov.head != null)
              .map((ov) => {
                const parentTopZ =
                  ov.parentRes?.head != null ?
                    scaleZ(ov.parentRes.head) +
                    RESERVOIR_Z_BOOST +
                    RESERVOIR_THICKNESS / 2
                  : scaleZ(ov.head) + RESERVOIR_Z_BOOST;
                const ovThickness = RESERVOIR_THICKNESS * 0.5;
                const ovTopZ = parentTopZ - 0.05;
                const ovCenterZ = ovTopZ - ovThickness / 2;
                return (
                  <ReservoirBox
                    key={`head-o-${ov.name}`}
                    center={[ov.cx, ov.cy, ovCenterZ]}
                    size={[OVERFLOW_SIDE, OVERFLOW_SIDE, ovThickness]}
                    color={ov.isActive ? "#e74c3c" : HEAD_COLOR}
                    opacity={headOpacity}
                    onClick={openPopup("overflow", ov.name, ov.properties, [
                      ov.cx,
                      ov.cy,
                      ovCenterZ,
                    ])}
                    onPointerOver={() => hoverIn("o:" + ov.name)}
                    onPointerOut={hoverOut}
                    highlighted={hoveredElement === "o:" + ov.name}
                  />
                );
              })}

          {/* Pipes */}
          {layerVis.pipes &&
            pipeElements.map((p) => (
              <AnimatedPipe
                key={`head-p-${p.name}`}
                points={p.headPoints}
                flow={p.flow}
                maxFlow={maxFlow}
                pipeSize={p.size}
                opacity={headOpacity}
                onClick={openPopup("pipe", p.name, p.properties, [
                  p.headPoints[0][0],
                  p.headPoints[0][1],
                  p.headPoints[0][2],
                ])}
                onPointerOver={() => hoverIn("p:" + p.name)}
                onPointerOut={hoverOut}
                highlighted={hoveredElement === "p:" + p.name}
              />
            ))}

          {/* Vertical risers — pipes/valves up to reservoir bottom */}
          {layerVis.reservoirs &&
            reservoirRisers.head.map((ri) => (
              <AnimatedRiser
                key={ri.key}
                x={ri.x}
                y={ri.y}
                z1={ri.z1}
                z2={ri.z2}
                color={HEAD_COLOR}
                lineWidth={2}
                opacity={headOpacity * 0.7}
              />
            ))}
        </group>
      )}

      {/* Popup overlay */}
      {renderPopup()}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[14, 5, 3]}
        enableDamping
        dampingFactor={0.25}
        rotateSpeed={1.4}
        panSpeed={0.8}
        zoomSpeed={1.2}
        zoomToCursor
        minZoom={10}
        maxZoom={150}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />

      <GizmoHelper alignment="top-left" margin={[48, 48]}>
        <CustomViewcube
          faces={["Right", "Left", "Back", "Front", "Top", "Bottom"]}
          color="white"
          strokeColor="#94a3b8"
          textColor="#334155"
          hoverColor="#93c5fd"
          opacity={0.95}
        />
      </GizmoHelper>

      <FaceOnDetector
        controlsRef={controlsRef}
        onFaceOnChange={onFaceOnChange}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════ */
/*  MAIN EXPORTED COMPONENT                       */
/* ═══════════════════════════════════════════════ */
export default function SchematicPanel3D({
  hydraulicResults,
  valveOverrides,
  onValveOverrideChange,
  elevOverrides,
  onElevOverrideChange,
  layerVis,
}) {
  const [isFaceOn, setIsFaceOn] = useState(false);
  const [elevOpacity, setElevOpacity] = useState(1);
  const [headOpacity, setHeadOpacity] = useState(0.6);

  return (
    <div className="three-d-container">
      <Canvas
        orthographic
        camera={{ zoom: 38, near: -200, far: 400, position: [14, -18, 14] }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#f0f2f5");
        }}
      >
        <SceneContent
          hydraulicResults={hydraulicResults}
          valveOverrides={valveOverrides}
          onValveOverrideChange={onValveOverrideChange}
          elevOverrides={elevOverrides}
          onElevOverrideChange={onElevOverrideChange}
          elevOpacity={elevOpacity}
          headOpacity={headOpacity}
          layerVis={layerVis}
          onFaceOnChange={setIsFaceOn}
        />
      </Canvas>

      {/* CW / CCW rotate buttons — always visible below viewcube,
          disabled when not in face-on mode */}
      <div className="face-rotate-controls">
        <button
          className="face-rotate-btn"
          title="Rotate view 90° counter-clockwise"
          disabled={!isFaceOn}
          onClick={() => {
            _rotatePending = { angle: 90 };
          }}
        >
          ↶
        </button>
        <button
          className="face-rotate-btn"
          title="Rotate view 90° clockwise"
          disabled={!isFaceOn}
          onClick={() => {
            _rotatePending = { angle: -90 };
          }}
        >
          ↷
        </button>
      </div>

      {/* Overlay opacity controls — positioned left of the 2×2 switch */}
      <div className="overlay-controls">
        <div className="overlay-section-label">Total Head</div>
        <div className="overlay-slider-row">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(headOpacity * 100)}
            onChange={(e) => setHeadOpacity(e.target.value / 100)}
          />
          <span className="overlay-slider-pct">
            {Math.round(headOpacity * 100)}%
          </span>
        </div>
        <div className="overlay-section-label" style={{ marginTop: 12 }}>
          Elevation
        </div>
        <div className="overlay-slider-row">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(elevOpacity * 100)}
            onChange={(e) => setElevOpacity(e.target.value / 100)}
          />
          <span className="overlay-slider-pct">
            {Math.round(elevOpacity * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

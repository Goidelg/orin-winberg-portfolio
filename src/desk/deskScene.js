// Pixel-sampled Three.js Interactive 3D Storyteller's Desk for Orin Winberg
import * as THREE from "three";
import { assetUrl } from "../utils/assetUrl.js";

function makeWoodTexture(base = "#9c6841", grain = "#744929") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 95; i++) {
    ctx.strokeStyle = i % 3 === 0 ? "#b8825533" : grain + "44";
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    const y = Math.random() * 256;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + (Math.random() - 0.5) * 14, 340, y + (Math.random() - 0.5) * 14, 512, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeBlotterTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5c7564";
  ctx.fillRect(0, 0, 512, 256);
  // Subtle leather grain
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#4d645422" : "#718b7822";
    ctx.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
  }
  // Stitched border
  ctx.strokeStyle = "#b9c5a9aa";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(14, 14, 484, 228);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabelTexture(bg, fg, title, subtitle = "", accent = null) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 192);
  if (accent) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 236, 172);
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.font = '700 30px "Bricolage Grotesque", Georgia, sans-serif';
  ctx.fillText(title, 128, subtitle ? 92 : 108, 224);
  if (subtitle) {
    ctx.font = '500 18px "IBM Plex Mono", monospace';
    ctx.fillText(subtitle, 128, 128, 220);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeOscilloscopeTexture(phase = 0) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1d2b28";
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = "#365047";
  ctx.lineWidth = 1;
  for (let x = 24; x < 256; x += 28) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 160); ctx.stroke();
  }
  for (let y = 20; y < 160; y += 28) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }
  ctx.strokeStyle = "#d9ef9f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 0; x <= 256; x += 4) {
    const y = 80 + Math.sin(x * 0.055 + phase) * 34 * Math.sin(x * 0.012);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  return c;
}

export function mountDeskScene({
  container,
  canvas,
  prints,
  onSelectObject,
  onHoverObject,
  onLampToggle,
  onDrawerToggle,
  getPerformanceMode,
}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "default" });
  } catch {
    return null;
  }

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const dayBg = new THREE.Color(0xc7bc9e);
  const nightBg = new THREE.Color(0x282738);
  scene.background = dayBg.clone();

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  const baseCamPos = new THREE.Vector3(0, 2.72, 4.95);
  const baseLookAt = new THREE.Vector3(0, 0.88, -0.35);

  // Lighting (Day + Toggleable Evening Banker's Lamp)
  const hemi = new THREE.HemisphereLight(0xf5f1e6, 0xb89c88, 1.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffebd2, 2.05);
  sun.position.set(-4.5, 7.5, 4.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -5.5;
  sun.shadow.camera.right = 5.5;
  sun.shadow.camera.top = 4.5;
  sun.shadow.camera.bottom = -4.5;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xcce2ef, 0.65);
  fill.position.set(5.2, 5.5, -5);
  scene.add(fill);

  const lampBulb = new THREE.PointLight(0xffcb80, 0, 7.5, 1.8);
  lampBulb.position.set(2.05, 1.38, -0.15);
  scene.add(lampBulb);

  const lampSpot = new THREE.SpotLight(0xffd28f, 0, 8, 0.85, 0.65, 1.4);
  lampSpot.position.set(2.05, 1.48, -0.15);
  lampSpot.target.position.set(0.65, 0.05, 0.25);
  scene.add(lampSpot, lampSpot.target);

  // Materials
  const woodTex = makeWoodTexture("#9e6940", "#6f4526");
  const woodDarkTex = makeWoodTexture("#7d4f2e", "#56331a");
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.78 });
  const woodDarkMat = new THREE.MeshStandardMaterial({ map: woodDarkTex, roughness: 0.82 });
  const blotterMat = new THREE.MeshStandardMaterial({ map: makeBlotterTexture(), roughness: 0.92 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xddd4c2, roughness: 0.95 });
  const backPanelMat = new THREE.MeshStandardMaterial({ color: 0x5c6858, roughness: 0.95 });
  const creamPaperMat = new THREE.MeshStandardMaterial({ color: 0xfff8ea, roughness: 0.88 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a962, roughness: 0.35, metalness: 0.65 });

  // Study Back Wall & Desk Floor
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), wallMat);
  backWall.position.set(0, 2.6, -1.72);
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Desk Main Surface
  const deskGroup = new THREE.Group();
  scene.add(deskGroup);

  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.16, 2.95), woodMat);
  deskTop.position.set(0, -0.08, 0.05);
  deskTop.receiveShadow = true;
  deskTop.castShadow = true;
  deskGroup.add(deskTop);

  // Desk Apron & Legs
  const apron = new THREE.Mesh(new THREE.BoxGeometry(5.85, 0.56, 2.55), woodDarkMat);
  apron.position.set(0, -0.44, -0.02);
  deskGroup.add(apron);

  // Stitched Sage Green Leather Blotter
  const blotter = new THREE.Mesh(new THREE.BoxGeometry(4.45, 0.028, 1.72), blotterMat);
  blotter.position.set(-0.08, 0.015, 0.36);
  blotter.receiveShadow = true;
  deskGroup.add(blotter);

  // Upper Wooden Hutch
  const hutchBack = new THREE.Mesh(new THREE.BoxGeometry(5.55, 2.2, 0.08), backPanelMat);
  hutchBack.position.set(0, 1.15, -1.32);
  hutchBack.receiveShadow = true;
  deskGroup.add(hutchBack);

  const hutchTop = new THREE.Mesh(new THREE.BoxGeometry(5.78, 0.13, 0.85), woodMat);
  hutchTop.position.set(0, 2.26, -0.95);
  hutchTop.castShadow = true;
  hutchTop.receiveShadow = true;
  deskGroup.add(hutchTop);

  const hutchMid = new THREE.Mesh(new THREE.BoxGeometry(5.68, 0.11, 0.8), woodMat);
  hutchMid.position.set(0, 1.06, -0.95);
  hutchMid.castShadow = true;
  hutchMid.receiveShadow = true;
  deskGroup.add(hutchMid);

  for (const sx of [-2.78, 2.78]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.34, 0.85), woodDarkMat);
    side.position.set(sx, 1.15, -0.95);
    side.castShadow = true;
    deskGroup.add(side);
  }

  const divider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.16, 0.72), woodDarkMat);
  divider.position.set(0.15, 1.66, -0.96);
  deskGroup.add(divider);

  // Interactive Raycast Registry
  const interactives = [];
  function registerInteractive(object3d, meta) {
    object3d.userData.interactive = meta;
    object3d.traverse((child) => {
      if (child.isMesh) {
        child.userData.interactive = meta;
        child.userData.rootGroup = object3d;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    interactives.push(object3d);
  }

  const texLoader = new THREE.TextureLoader();
  function loadCoverTex(url) {
    const t = texLoader.load(assetUrl(url));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 1. PULL-OUT DESK DRAWER (Keepsake Postcard inside!)
  const drawerGroup = new THREE.Group();
  drawerGroup.position.set(0, -0.44, 1.24);
  const drawerFront = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.36, 0.14), woodMat);
  drawerGroup.add(drawerFront);
  const drawerTray = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.2), woodDarkMat);
  drawerTray.position.set(0, -0.14, -0.6);
  drawerGroup.add(drawerTray);
  // Brass handle
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 8, 18, Math.PI), brassMat);
  handle.rotation.z = Math.PI;
  handle.position.set(0, 0.02, 0.1);
  drawerGroup.add(handle);
  // Postcard nestled inside drawer
  const postcardTex = loadCoverTex("assets/prints/postcard-front.jpg");
  const drawerCard = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.02, 0.52),
    new THREE.MeshStandardMaterial({ map: postcardTex, roughness: 0.8 })
  );
  drawerCard.position.set(0, -0.08, -0.35);
  drawerCard.rotation.y = 0.08;
  drawerGroup.add(drawerCard);
  deskGroup.add(drawerGroup);
  registerInteractive(drawerGroup, { id: "drawer", action: "drawer" });

  // 2. CORK PINBOARD WITH 6 REAL FEATURED PRINTS
  const pinboardFrame = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.82, 0.06), woodMat);
  pinboardFrame.position.set(0.05, 0.54, -1.24);
  deskGroup.add(pinboardFrame);

  const corkMat = new THREE.MeshStandardMaterial({ color: 0xc29368, roughness: 0.95 });
  const corkBoard = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.7, 0.07), corkMat);
  corkBoard.position.set(0.05, 0.54, -1.23);
  deskGroup.add(corkBoard);

  prints.filter((p) => p.id !== "milly").slice(0, 6).forEach((pr, i) => {
    const pGroup = new THREE.Group();
    const x = -0.86 + i * 0.365;
    const y = 0.54 + (i % 2 === 0 ? 0.02 : -0.02);
    pGroup.position.set(x, y, -1.185);
    pGroup.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.045;

    const cardBack = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.44, 0.012), creamPaperMat);
    pGroup.add(cardBack);

    const artPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.27, 0.34),
      new THREE.MeshStandardMaterial({ map: loadCoverTex(pr.image), roughness: 0.85 })
    );
    artPlane.position.set(0, 0.02, 0.008);
    pGroup.add(artPlane);

    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), brassMat);
    pin.position.set(0, 0.19, 0.016);
    pGroup.add(pin);

    deskGroup.add(pGroup);
    registerInteractive(pGroup, { id: "pinboard", action: "print", printId: pr.id });
  });

  // 3. UPPER HUTCH HARDCOVER BOOKS + MILLY'S FRAMED DRAWING SITTING ON THE SHELF
  // High Voltage (Left Hero Book)
  const hvBook = new THREE.Group();
  hvBook.position.set(-1.02, 1.62, -0.84);
  hvBook.rotation.y = 0.08;
  const hvCoverMat = new THREE.MeshStandardMaterial({ map: loadCoverTex("assets/prints/high-voltage.jpg"), roughness: 0.72 });
  const hvSpineMat = new THREE.MeshStandardMaterial({ color: 0x2b4b8c, roughness: 0.75 });
  const hvMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.96, 0.14), [
    creamPaperMat, hvSpineMat, creamPaperMat, creamPaperMat, hvCoverMat, hvSpineMat,
  ]);
  hvBook.add(hvMesh);
  deskGroup.add(hvBook);
  registerInteractive(hvBook, { id: "high-voltage", action: "print", printId: "high-voltage" });

  // Companion upright books left of High Voltage
  const compBooks = [
    { x: -1.66, h: 0.78, c: 0x2f5349 },
    { x: -1.50, h: 0.72, c: 0x6c283e },
  ];
  compBooks.forEach((b) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, b.h, 0.56),
      new THREE.MeshStandardMaterial({ color: b.c, roughness: 0.8 })
    );
    m.position.set(b.x, 1.12 + b.h / 2, -0.92);
    m.castShadow = true;
    deskGroup.add(m);
  });

  // Kishon Salt Marsh (Edited Book standing beside High Voltage)
  const kishonBook = new THREE.Group();
  kishonBook.position.set(-0.28, 1.54, -0.85);
  kishonBook.rotation.y = 0.04;
  const kishonCoverMat = new THREE.MeshStandardMaterial({ map: loadCoverTex("assets/prints/kishon.jpg"), roughness: 0.78 });
  const kishonSideMat = new THREE.MeshStandardMaterial({ color: 0x5c7c58, roughness: 0.8 });
  const kishonMesh = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.80, 0.10), [
    creamPaperMat, kishonSideMat, creamPaperMat, creamPaperMat, kishonCoverMat, kishonSideMat,
  ]);
  kishonBook.add(kishonMesh);
  deskGroup.add(kishonBook);
  registerInteractive(kishonBook, { id: "kishon", action: "print", printId: "kishon" });

  // Miloolita (Right Shelf Book)
  const milBook = new THREE.Group();
  milBook.position.set(0.66, 1.55, -0.85);
  milBook.rotation.y = -0.04;
  const milCoverMat = new THREE.MeshStandardMaterial({ map: loadCoverTex("assets/prints/miloolita.jpg"), roughness: 0.76 });
  const milSideMat = new THREE.MeshStandardMaterial({ color: 0xdca960, roughness: 0.78 });
  const milMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.82, 0.10), [
    creamPaperMat, milSideMat, creamPaperMat, creamPaperMat, milCoverMat, milSideMat,
  ]);
  milBook.add(milMesh);
  deskGroup.add(milBook);
  registerInteractive(milBook, { id: "miloolita", action: "print", printId: "miloolita" });

  // We Have a Dream (Deep Green Cloth Hardcover)
  const dreamBook = new THREE.Group();
  dreamBook.position.set(1.40, 1.51, -0.86);
  dreamBook.rotation.y = -0.09;
  const dreamCoverMat = new THREE.MeshStandardMaterial({ map: loadCoverTex("assets/prints/we-have-a-dream.jpg"), roughness: 0.88 });
  const dreamSpineMat = new THREE.MeshStandardMaterial({ color: 0x3f614d, roughness: 0.9 });
  const dreamMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.74, 0.11), [
    creamPaperMat, dreamSpineMat, creamPaperMat, creamPaperMat, dreamCoverMat, dreamSpineMat,
  ]);
  dreamBook.add(dreamMesh);
  deskGroup.add(dreamBook);
  registerInteractive(dreamBook, { id: "we-have-a-dream", action: "print", printId: "we-have-a-dream" });

  // MILLY'S FRAMED DRAWING SITTING ON THE SHELF ("My best creation yet")
  const millyFrameGroup = new THREE.Group();
  millyFrameGroup.position.set(2.16, 1.51, -0.82);
  millyFrameGroup.rotation.y = -0.22;
  millyFrameGroup.rotation.x = -0.07;
  const frameOuter = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.78, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x6b4228, roughness: 0.65 })
  );
  millyFrameGroup.add(frameOuter);
  const frameMat = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.68),
    creamPaperMat
  );
  frameMat.position.set(0, 0, 0.032);
  millyFrameGroup.add(frameMat);
  const millyArt = new THREE.Mesh(
    new THREE.PlaneGeometry(0.50, 0.58),
    new THREE.MeshStandardMaterial({ map: loadCoverTex("assets/prints/milly.jpg"), roughness: 0.85 })
  );
  millyArt.position.set(0, 0.01, 0.035);
  millyFrameGroup.add(millyArt);
  const easelStand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.04), woodDarkMat);
  easelStand.position.set(0, -0.1, -0.14);
  easelStand.rotation.x = 0.45;
  millyFrameGroup.add(easelStand);
  deskGroup.add(millyFrameGroup);
  registerInteractive(millyFrameGroup, { id: "milly", action: "print", printId: "milly" });

  // Potted Plant on Left Shelf + Trailing Ivy
  const potMat = new THREE.MeshStandardMaterial({ color: 0xb85e3e, roughness: 0.85 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4b7444, roughness: 0.82 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.24, 12), potMat);
  pot.position.set(-2.22, 1.24, -0.88);
  deskGroup.add(pot);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), leafMat);
    leaf.position.set(-2.22 + Math.cos(a) * 0.14, 1.41 + (i % 2) * 0.06, -0.88 + Math.sin(a) * 0.14);
    deskGroup.add(leaf);
  }
  // Trailing top ivy
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), leafMat);
    leaf.position.set(-2.78 - Math.sin(i * 0.7) * 0.12, 2.24 - i * 0.18, -0.58 + i * 0.03);
    deskGroup.add(leaf);
  }

  // Tiny Glowing Firefly Figurine on Shelf Center
  const fireflyGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe291, emissive: 0xffb84d, emissiveIntensity: 0.65 })
  );
  fireflyGlow.position.set(-0.22, 1.2, -0.84);
  deskGroup.add(fireflyGlow);

  // 4. VINTAGE STUDIO AUDIO RADIO / OSCILLOSCOPE (Back Left on Desk -> Workbench)
  const radioGroup = new THREE.Group();
  radioGroup.position.set(-1.72, 0.34, -0.48);
  radioGroup.rotation.y = 0.24;
  const radioBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.64, 0.54),
    new THREE.MeshStandardMaterial({ color: 0x62827f, roughness: 0.68 })
  );
  radioGroup.add(radioBody);

  const radioFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.54, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xe6dcc8, roughness: 0.75 })
  );
  radioFace.position.set(0, 0.01, 0.27);
  radioGroup.add(radioFace);

  let oscCanvas = makeOscilloscopeTexture(0);
  const oscTex = new THREE.CanvasTexture(oscCanvas);
  oscTex.colorSpace = THREE.SRGBColorSpace;
  const oscScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.34),
    new THREE.MeshBasicMaterial({ map: oscTex })
  );
  oscScreen.position.set(-0.12, 0.04, 0.295);
  radioGroup.add(oscScreen);

  // Knobs
  for (const [kx, ky] of [[0.27, 0.12], [0.27, -0.06]]) {
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.06, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: 0x352b30, roughness: 0.5 })
    );
    knob.rotation.x = Math.PI / 2;
    knob.position.set(kx, ky, 0.3);
    radioGroup.add(knob);
  }
  deskGroup.add(radioGroup);
  registerInteractive(radioGroup, { id: "radio", action: "room", room: "workbench" });

  // 5. CENTERPIECE VINTAGE TYPEWRITER (Center of Blotter -> Workbench)
  const typeGroup = new THREE.Group();
  typeGroup.position.set(-0.24, 0.03, 0.22);
  typeGroup.rotation.y = 0.08;

  const twBaseMat = new THREE.MeshStandardMaterial({ color: 0x7a394e, roughness: 0.55, metalness: 0.15 });
  const twBase = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.18, 0.78), twBaseMat);
  twBase.position.set(0, 0.09, 0);
  typeGroup.add(twBase);

  const twBack = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.28, 0.32), twBaseMat);
  twBack.position.set(0, 0.24, -0.2);
  typeGroup.add(twBack);

  const roller = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 1.06, 14),
    new THREE.MeshStandardMaterial({ color: 0x2d262b, roughness: 0.5 })
  );
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, 0.4, -0.22);
  typeGroup.add(roller);

  // Typed manuscript sheet sticking out of roller
  const sheetTex = makeLabelTexture("#fffaf0", "#422c41", "ORIN WINBERG", "STORY · AI · BOOKS");
  const sheetMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.52, 0.012),
    new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.9 })
  );
  sheetMesh.position.set(0, 0.62, -0.26);
  sheetMesh.rotation.x = -0.22;
  typeGroup.add(sheetMesh);

  // Key rows
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xf7ecd7, roughness: 0.6 });
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 7; k++) {
      const key = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8), keyMat);
      key.position.set(-0.33 + k * 0.11, 0.2 - r * 0.025, 0.08 + r * 0.1);
      typeGroup.add(key);
    }
  }
  deskGroup.add(typeGroup);
  registerInteractive(typeGroup, { id: "typewriter", action: "room", room: "workbench" });

  // 6. MANILA PROJECT FILES DOSSIER (Left of Blotter -> Archive)
  const filesGroup = new THREE.Group();
  filesGroup.position.set(-1.55, 0.04, 0.46);
  filesGroup.rotation.y = 0.18;
  const folderTex = makeLabelTexture("#e6d1b0", "#4a3327", "Project files", "21 WORKS");
  const folderBottom = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.04, 0.74),
    new THREE.MeshStandardMaterial({ color: 0xd9bf97, roughness: 0.88 })
  );
  filesGroup.add(folderBottom);
  const folderPages = new THREE.Mesh(new THREE.BoxGeometry(0.91, 0.04, 0.7), creamPaperMat);
  folderPages.position.set(0.01, 0.035, 0);
  filesGroup.add(folderPages);
  const folderTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.025, 0.74),
    new THREE.MeshStandardMaterial({ map: folderTex, roughness: 0.86 })
  );
  folderTop.position.set(0, 0.068, 0.01);
  folderTop.rotation.y = -0.04;
  filesGroup.add(folderTop);
  deskGroup.add(filesGroup);
  registerInteractive(filesGroup, { id: "files", action: "room", room: "archive" });

  // 7. PLUM LINEN NOTEBOOK (Mid-Right -> My Notebook)
  const nbGroup = new THREE.Group();
  nbGroup.position.set(0.92, 0.07, 0.18);
  nbGroup.rotation.y = -0.14;
  const nbCoverTex = makeLabelTexture("#733b55", "#f6e7d8", "My notebook", "ABOUT ORIN", "#a26a82");
  const nbMat = new THREE.MeshStandardMaterial({ map: nbCoverTex, roughness: 0.85 });
  const nbBody = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.1, 0.96), [
    creamPaperMat,
    new THREE.MeshStandardMaterial({ color: 0x5c2c43, roughness: 0.85 }),
    nbMat,
    new THREE.MeshStandardMaterial({ color: 0x5c2c43, roughness: 0.85 }),
    creamPaperMat,
    creamPaperMat,
  ]);
  nbGroup.add(nbBody);
  // Ribbon bookmark
  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.01, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xd97d8e, roughness: 0.7 })
  );
  ribbon.position.set(0.18, -0.02, 0.56);
  nbGroup.add(ribbon);
  deskGroup.add(nbGroup);
  registerInteractive(nbGroup, { id: "notebook", action: "room", room: "notebook" });

  // 8. WAX-SEALED LETTERS (Front-Right -> Letters & Links)
  const lettersGroup = new THREE.Group();
  lettersGroup.position.set(1.06, 0.045, 0.96);
  lettersGroup.rotation.y = -0.22;
  const envTex = makeLabelTexture("#fbf2e3", "#493542", "", "Letters · TEL AVIV");
  const env1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.035, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xefe2cc, roughness: 0.9 })
  );
  lettersGroup.add(env1);
  const env2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.025, 0.52),
    new THREE.MeshStandardMaterial({ map: envTex, roughness: 0.9 })
  );
  env2.position.set(0.02, 0.03, -0.01);
  env2.rotation.y = 0.09;
  lettersGroup.add(env2);
  const seal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.076, 0.02, 14),
    new THREE.MeshStandardMaterial({ color: 0xa13b4c, roughness: 0.48 })
  );
  seal.position.set(0.02, 0.052, -0.06);
  lettersGroup.add(seal);
  deskGroup.add(lettersGroup);
  registerInteractive(lettersGroup, { id: "letters", action: "room", room: "letters" });

  // 9. SCRATCH PAPER & PENCILS (Front Center -> Scratch Pad)
  const scratchGroup = new THREE.Group();
  scratchGroup.position.set(-0.28, 0.036, 0.98);
  scratchGroup.rotation.y = 0.04;
  const ruledCanvas = document.createElement("canvas");
  ruledCanvas.width = 256;
  ruledCanvas.height = 192;
  const rctx = ruledCanvas.getContext("2d");
  rctx.fillStyle = "#fff9ed";
  rctx.fillRect(0, 0, 256, 192);
  rctx.strokeStyle = "#cfc5b6";
  rctx.lineWidth = 2;
  for (let y = 26; y < 180; y += 22) {
    rctx.beginPath(); rctx.moveTo(16, y); rctx.lineTo(240, y); rctx.stroke();
  }
  const ruledTex = new THREE.CanvasTexture(ruledCanvas);
  ruledTex.colorSpace = THREE.SRGBColorSpace;
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.02, 0.54),
    new THREE.MeshStandardMaterial({ map: ruledTex, roughness: 0.92 })
  );
  scratchGroup.add(pad);
  deskGroup.add(scratchGroup);
  registerInteractive(scratchGroup, { id: "scratch", action: "scratch" });

  // Two resting pencils beside notebook
  for (const [px, col, rot] of [[1.56, 0xc97b8e, 0.25], [1.72, 0xe0b565, 0.22]]) {
    const pencil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.85, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })
    );
    pencil.rotation.x = Math.PI / 2;
    pencil.rotation.z = rot;
    pencil.position.set(px, 0.05, 0.32);
    deskGroup.add(pencil);
  }

  // 10. ARTICULATED GREEN BANKER'S DESK LAMP (Far Right -> Toggle Day / Night!)
  const lampGroup = new THREE.Group();
  lampGroup.position.set(2.32, 0.02, 0.06);
  const lampGreen = new THREE.MeshStandardMaterial({ color: 0x3b6e57, roughness: 0.45 });
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 16), lampGreen);
  lampBase.position.set(0, 0.04, 0);
  lampGroup.add(lampBase);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.72, 8), brassMat);
  arm1.position.set(0.08, 0.4, -0.05);
  arm1.rotation.z = -0.22;
  lampGroup.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.65, 8), brassMat);
  arm2.position.set(-0.04, 0.94, -0.06);
  arm2.rotation.z = 0.42;
  lampGroup.add(arm2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.32, 16, 1, true), lampGreen);
  shade.position.set(-0.22, 1.16, -0.02);
  shade.rotation.z = 0.38;
  shade.material.side = THREE.DoubleSide;
  lampGroup.add(shade);
  const bulbMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff3d1, emissive: 0xffc873, emissiveIntensity: 0.15 })
  );
  bulbMesh.position.set(-0.22, 1.07, -0.02);
  lampGroup.add(bulbMesh);
  deskGroup.add(lampGroup);
  registerInteractive(lampGroup, { id: "lamp", action: "lamp" });

  // Ceramic Pencil Cup + Upright Colored Pencils
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.12, 0.32, 14),
    new THREE.MeshStandardMaterial({ color: 0x628c8d, roughness: 0.55 })
  );
  cup.position.set(2.58, 0.18, 0.45);
  deskGroup.add(cup);
  for (const [dx, dz, rz, col] of [[-0.04, 0.02, 0.18, 0xd46a7e], [0.03, -0.03, -0.14, 0xe8b95a], [0.01, 0.04, 0.06, 0x5c8566]]) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.48, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.68 })
    );
    p.position.set(2.58 + dx, 0.34, 0.45 + dz);
    p.rotation.z = rz;
    deskGroup.add(p);
  }

  // State & Controls
  let nightMode = false;
  let drawerOpen = false;
  let drawerProgress = 0;
  let hoveredRoot = null;
  let pointerNdc = new THREE.Vector2(99, 99);
  let parallaxTarget = { x: 0, y: 0 };
  let parallaxCurr = { x: 0, y: 0 };
  const raycaster = new THREE.Raycaster();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function applyLighting(tNight) {
    scene.background.copy(dayBg).lerp(nightBg, tNight);
    hemi.intensity = THREE.MathUtils.lerp(1.55, 0.34, tNight);
    sun.intensity = THREE.MathUtils.lerp(2.05, 0.18, tNight);
    fill.intensity = THREE.MathUtils.lerp(0.65, 0.28, tNight);
    lampBulb.intensity = THREE.MathUtils.lerp(0, 6.2, tNight);
    lampSpot.intensity = THREE.MathUtils.lerp(0, 9.5, tNight);
    bulbMesh.material.emissiveIntensity = THREE.MathUtils.lerp(0.15, 2.8, tNight);
  }

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const perf = getPerformanceMode();
    const isPortrait = h > w * 1.05;
    camera.aspect = w / Math.max(1, h);
    camera.fov = isPortrait ? 56 : 42;
    baseCamPos.set(0, isPortrait ? 3.25 : 2.74, isPortrait ? 6.1 : 5.26);
    baseLookAt.set(0, isPortrait ? 0.65 : 0.72, -0.2);
    camera.updateProjectionMatrix();

    // Intentional crisp pixelation ratio matching itsdavis.com
    const targetScale = perf ? 0.42 : 0.68;
    const maxPx = perf ? 320000 : 880000;
    const limit = Math.sqrt(maxPx / Math.max(1, w * h));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, targetScale, limit));
    renderer.setSize(w, h, false);
  }

  function updatePointer(ev) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    parallaxTarget.x = pointerNdc.x * 0.22;
    parallaxTarget.y = pointerNdc.y * 0.1;

    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(interactives, true);
    const hitMeta = hits[0]?.object?.userData?.interactive || null;
    const hitRoot = hits[0]?.object?.userData?.rootGroup || null;

    if (hitRoot !== hoveredRoot) {
      hoveredRoot = hitRoot;
    }
    if (hitMeta) {
      container.dataset.aim = "object";
      onHoverObject?.(hitMeta, ev.clientX - rect.left, ev.clientY - rect.top);
    } else {
      delete container.dataset.aim;
      onHoverObject?.(null, 0, 0);
    }
  }

  function handleClick(ev) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(interactives, true);
    const meta = hits[0]?.object?.userData?.interactive;
    if (!meta) return;

    if (meta.action === "lamp") {
      nightMode = !nightMode;
      onLampToggle?.(nightMode);
      return;
    }
    if (meta.action === "drawer") {
      if (!drawerOpen) {
        drawerOpen = true;
        onDrawerToggle?.(true);
      } else {
        onSelectObject?.({ action: "postcard" });
      }
      return;
    }
    onSelectObject?.(meta);
  }

  canvas.addEventListener("pointermove", updatePointer);
  canvas.addEventListener("pointerleave", () => {
    hoveredRoot = null;
    delete container.dataset.aim;
    onHoverObject?.(null, 0, 0);
  });
  canvas.addEventListener("click", handleClick);
  window.addEventListener("resize", resize);

  resize();

  let rafId = 0;
  let nightBlend = 0;
  let clockT = 0;
  let prevNow = performance.now();
  let lastOscDraw = 0;
  let paused = false;

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    if (paused) return;

    const dt = Math.min(0.15, Math.max(0.016, (now - prevNow) * 0.001));
    prevNow = now;
    clockT = now * 0.001;

    // Smooth delta-timed day/night transition
    const targetNight = nightMode ? 1 : 0;
    if (Math.abs(nightBlend - targetNight) > 0.003) {
      nightBlend += (targetNight - nightBlend) * Math.min(1, dt * 6.5);
      applyLighting(nightBlend);
    }

    // Smooth drawer slide
    const targetDrawer = drawerOpen ? 1 : 0;
    if (Math.abs(drawerProgress - targetDrawer) > 0.004) {
      drawerProgress += (targetDrawer - drawerProgress) * Math.min(1, dt * 7);
      drawerGroup.position.z = 1.24 + drawerProgress * 0.68;
    }

    // Gentle firefly bob
    fireflyGlow.position.y = 1.2 + Math.sin(clockT * 2.2) * 0.035;

    // Animate vintage audio scope wave every ~120ms
    if (now - lastOscDraw > (getPerformanceMode() ? 240 : 110)) {
      lastOscDraw = now;
      const nextCanvas = makeOscilloscopeTexture(clockT * 3.1);
      oscTex.image = nextCanvas;
      oscTex.needsUpdate = true;
    }

    // Subtle camera parallax
    if (!reducedMotion.matches) {
      parallaxCurr.x += (parallaxTarget.x - parallaxCurr.x) * 0.07;
      parallaxCurr.y += (parallaxTarget.y - parallaxCurr.y) * 0.07;
    }
    camera.position.set(
      baseCamPos.x + parallaxCurr.x,
      baseCamPos.y + parallaxCurr.y,
      baseCamPos.z
    );
    camera.lookAt(baseLookAt);

    renderer.render(scene, camera);
  }

  // First render immediately and mark stage rendered
  applyLighting(0);
  camera.position.copy(baseCamPos);
  camera.lookAt(baseLookAt);
  renderer.render(scene, camera);
  container.classList.add("is-rendered");
  rafId = requestAnimationFrame(tick);

  return {
    resize,
    setNightMode(on) {
      nightMode = Boolean(on);
    },
    getNightMode() {
      return nightMode;
    },
    closeDrawer() {
      drawerOpen = false;
    },
    setPaused(p) {
      paused = Boolean(p);
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      renderer.dispose();
    },
  };
}

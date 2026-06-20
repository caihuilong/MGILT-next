import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// console.log('MGILT Editor: Script loaded');
// console.log('THREE imported:', !!THREE);
// console.log('OrbitControls imported:', !!OrbitControls);

const MODULES = [
  { id:0, name:'踏面', code:'M-V4-PT-0-S', height:50,  type:'step',    desc:'50mm高度 / 边长490mm', price:699, color:'#5B8C5A' },
  { id:1, name:'低坐凳', code:'M-V4-BN-2-S', height:280, type:'seat',   desc:'280mm高度 / 边长490mm', price:1499, color:'#7A9E7E' },
  { id:2, name:'低种植', code:'M-V4-PL-3-S', height:380, type:'planter', desc:'380mm高度 / 边长490mm', price:1699, color:'#BFA27A' },
  { id:3, name:'高坐凳', code:'M-V4-BN-4-S', height:480, type:'seat',    desc:'480mm高度 / 边长490mm', price:1899, color:'#8B7EB8' },
  { id:4, name:'高种植', code:'M-V4-PL-5-S', height:580, type:'planter', desc:'580mm高度 / 边长490mm', price:2099, color:'#A0887A' },
  { id:5, name:'桌台', code:'M-V4-TB-7-S', height:780, type:'table',   desc:'780mm高度 / 边长490mm', price:2399, color:'#5A7A8B' },
];

const FRAME_COLOR = 0x3D3530;
const WOOD_SIDE  = 0xC8A060;
const WOOD_SIDE2 = 0xB89050;
const WOOD_TOP   = 0xD4B078;
const SOIL_TOP   = 0x7BA832;
const STEP_COLOR = 0xB8B8B0;
const FRAME_T = 0.03;
const HEX_SIDE = 490;
const GRID_RADIUS = 10;
const SCALE = 0.002;
const HEX_R = HEX_SIDE * SCALE;
const GAP = 0.04;

let placed = {};
let selectedModule = 0;
let hoverKey = null;
let meshes = {};
let ghostMesh = null;
let sceneElementGhost = null; // 场景元素预览
let gridCells = {};
let undoStack = [];
let eraserMode = false;
let symmetryMode = false;
let fillBucketMode = false;
let moduleSelectionActive = false; // 用户是否主动选择了模块（显示预览）

let scene, camera, renderer, controls;
let ambLight, hemiLight, dirLight;
let gridGroup, ground;

// 场地边界相关变量（用户输入的用地范围）
let siteLength = 0; // 场地长度（米）
let siteWidth = 0; // 场地宽度（米）
let boundaryCells = {}; // 边界内的六边形格子 key -> {q, r}
let boundaryBox = null; // 边界可视化框
let siteWarningElement = null; // 场地超出提示元素

function initEditor3D() {
  const wrap = document.getElementById('editorCanvas');
  if (!wrap || !document.getElementById('page-editor')?.classList.contains('active')) return;
  if (wrap.querySelector('canvas')) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xF5F0E6);
  scene.fog = new THREE.FogExp2(0xF5F0E6, 0.035);

  camera = new THREE.PerspectiveCamera(40, wrap.clientWidth / wrap.clientHeight, 0.1, 200);
  camera.position.set(8, 10, 8);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  wrap.prepend(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minPolarAngle = Math.PI * 0.05;
  controls.minDistance = 4;
  controls.maxDistance = 30;
  controls.target.set(0, 0, 0);

  // 鼠标按键映射：中键旋转，右键平移，禁用左键旋转（保留给编辑器交互）
  controls.mouseButtons = {
    LEFT: null,  // 禁用左键旋转
    MIDDLE: THREE.MOUSE.ROTATE, // 中键旋转
    RIGHT: THREE.MOUSE.PAN     // 右键平移
  };

  ambLight = new THREE.AmbientLight(0xfff5e6, 0.6);
  scene.add(ambLight);
  hemiLight = new THREE.HemisphereLight(0xC5E8FF, 0x8B7D5A, 0.5);
  scene.add(hemiLight);

  dirLight = new THREE.DirectionalLight(0xFFF8EE, 1.4);
  dirLight.position.set(6, 12, 4);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -15; dirLight.shadow.camera.right = 15;
  dirLight.shadow.camera.top = 15; dirLight.shadow.camera.bottom = -15;
  dirLight.shadow.camera.near = 1; dirLight.shadow.camera.far = 40;
  dirLight.shadow.bias = -0.001;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);

  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = 512; groundCanvas.height = 512;
  const gctx = groundCanvas.getContext('2d');
  gctx.fillStyle = '#E8E0D0';
  gctx.fillRect(0, 0, 512, 512);
  gctx.strokeStyle = 'rgba(200,190,170,0.4)';
  gctx.lineWidth = 1.5;
  for (let r = 20; r < 360; r += 12) {
    gctx.beginPath();
    gctx.arc(256, 256, r, 0, Math.PI * 2);
    gctx.stroke();
  }
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const a = 0.03 + Math.random() * 0.06;
    gctx.fillStyle = `rgba(${Math.random() > 0.5 ? '160,150,130' : '220,215,200'},${a})`;
    gctx.fillRect(x, y, 1.5, 1.5);
  }
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  const groundGeo = new THREE.CircleGeometry(20, 64);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 });
  ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  gridGroup = new THREE.Group();
  scene.add(gridGroup);
  buildGrid();
  
  animate();
  window.addEventListener('resize', onResize);
}

function createHexShape(radius) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  shape.closePath();
  return shape;
}

function hexToWorld(q, r) {
  const x = HEX_R * Math.sqrt(3) * (q + r / 2);
  const z = HEX_R * 1.5 * r;
  return { x, z };
}

function hexKey(q, r) { return `${q},${r}`; }

function isInGrid(q, r) {
  const s = -q - r;
  return Math.abs(q) <= GRID_RADIUS && Math.abs(r) <= GRID_RADIUS && Math.abs(s) <= GRID_RADIUS;
}

function buildGrid() {
  const cellShape = createHexShape(HEX_R - GAP);
  const cellGeo = new THREE.ShapeGeometry(cellShape);
  const cellMat = new THREE.MeshStandardMaterial({
    color: 0xD4CCB8, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.35
  });

  const edgeGeo = new THREE.EdgesGeometry(new THREE.ShapeGeometry(createHexShape(HEX_R - GAP * 0.5)));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xC4B8A2, transparent: true, opacity: 0.5 });

  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (!isInGrid(q, r)) continue;
      const { x, z } = hexToWorld(q, r);
      const key = hexKey(q, r);

      const cell = new THREE.Mesh(cellGeo, cellMat.clone());
      cell.rotation.x = -Math.PI / 2;
      cell.position.set(x, 0, z);
      cell.userData = { q, r, key, type: 'cell' };
      gridGroup.add(cell);
      gridCells[key] = { mesh: cell, q, r };

      const edge = new THREE.LineSegments(edgeGeo, edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.002, z);
      gridGroup.add(edge);
    }
  }
}

// ============================================================
// 场地边界功能：用户输入用地尺寸，限制模块和元素放置范围
// ============================================================

// 设置场地尺寸（供 HTML 调用）
// length: 场地长度（米）, width: 场地宽度（米）
function setSiteSizeFromUI() {
  const lengthInput = document.getElementById('siteLength');
  const widthInput = document.getElementById('siteWidth');
  if (!lengthInput || !widthInput) return;

  const length = parseFloat(lengthInput.value) || 0;
  const width = parseFloat(widthInput.value) || 0;

  setSiteSize(length, width);
}

function setSiteSize(length, width) {
  siteLength = length;
  siteWidth = width;

  // 计算边界内的六边形格子
  calculateBoundaryCells();

  // 渲染边界可视化
  renderBoundary();

  // 更新统计
  updateStats();

  // 显示当前场地范围提示
  if (siteLength > 0 && siteWidth > 0) {
    showToast(`场地范围已设置：${siteLength}m × ${siteWidth}m`);
  }
}

// 计算哪些六边形格子在场地边界内（矩形居中对齐）
function calculateBoundaryCells() {
  boundaryCells = {};

  if (siteLength <= 0 || siteWidth <= 0) {
    return;
  }

  // 将场地尺寸转换为世界坐标（与六边形同一坐标系）
  const halfL = siteLength / 2;
  const halfW = siteWidth / 2;

  // 遍历所有现有的 gridCells，计算哪些在边界内
  // 六边形中心点如果在场地矩形内，就算在边界内
  for (const key in gridCells) {
    const cell = gridCells[key];
    const { x, z } = hexToWorld(cell.q, cell.r);

    // 检查中心点是否在矩形范围内
    if (Math.abs(x) <= halfL && Math.abs(z) <= halfW) {
      boundaryCells[key] = cell;
    }
  }
}

// 渲染场地边界可视化（半透明矩形框）
function renderBoundary() {
  // 清除之前的边界可视化
  if (boundaryBox) {
    scene.remove(boundaryBox);
    boundaryBox = null;
  }

  // 没有设置场地范围时，不渲染边界
  if (siteLength <= 0 || siteWidth <= 0) {
    return;
  }

  // 创建边界矩形框（用线框表示）
  const halfL = siteLength / 2;
  const halfW = siteWidth / 2;
  const height = 0.05; // 边界框高度

  // 创建矩形的 4 个顶点
  const points = [
    new THREE.Vector3(-halfL, 0, -halfW),
    new THREE.Vector3(halfL, 0, -halfW),
    new THREE.Vector3(halfL, 0, halfW),
    new THREE.Vector3(-halfL, 0, halfW),
    new THREE.Vector3(-halfL, 0, -halfW), // 闭合
  ];

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x7A9E7E, // sage 绿色
    linewidth: 2
  });

  boundaryBox = new THREE.Line(geometry, material);
  boundaryBox.position.y = 0.01; // 略高于地面
  scene.add(boundaryBox);

  // 添加四个角的标记
  const cornerGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const cornerMat = new THREE.MeshBasicMaterial({ color: 0x7A9E7E });

  const corners = [
    [-halfL, -halfW], [halfL, -halfW],
    [halfL, halfW], [-halfL, halfW]
  ];

  corners.forEach(([x, z]) => {
    const corner = new THREE.Mesh(cornerGeo, cornerMat);
    corner.position.set(x, 0.01, z);
    boundaryBox.add(corner);
  });
}

// 检查某个六边形坐标是否在场地边界内
function isInBoundary(q, r) {
  // 如果没有设置场地范围，默认所有格子都在范围内
  if (siteLength <= 0 || siteWidth <= 0) {
    return true;
  }

  const key = hexKey(q, r);
  return boundaryCells.hasOwnProperty(key);
}

// 检查世界坐标是否在场地矩形边界内
function isPointInBoundary(x, z) {
  // 如果没有设置场地范围，默认所有点都在范围内
  if (siteLength <= 0 || siteWidth <= 0) {
    return true;
  }

  const halfL = siteLength / 2;
  const halfW = siteWidth / 2;

  return Math.abs(x) <= halfL && Math.abs(z) <= halfW;
}

// 显示场地超出警告
function showSiteWarning(message) {
  // 创建临时 toast 提示（如果页面有 toast 函数则调用，否则用 alert）
  if (typeof showToast === 'function') {
    showToast(message);
  } else if (typeof Toast === 'function') {
    Toast(message);
  } else {
    // 备用：创建一个简单的提示元素
    const existing = document.getElementById('siteWarningToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'siteWarningToast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#CC5544;color:white;padding:12px 24px;border-radius:8px;font-size:14px;z-index:10000;animation:fadeInOut 2s forwards';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }
}

// ============================================================
// 模块放置部分
// ============================================================

const frameMat = new THREE.MeshStandardMaterial({ color: FRAME_COLOR, roughness: 0.5, metalness: 0.35 });
const frameMatGhost = new THREE.MeshStandardMaterial({ color: FRAME_COLOR, roughness: 0.5, metalness: 0.35, transparent: true, opacity: 0.35 });

function getHexCorners(radius) {
  const c = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    c.push({ x: radius * Math.cos(a), z: radius * Math.sin(a) });
  }
  return c;
}

function addSteelFrame(group, R, h, ghost) {
  const mat = ghost ? frameMatGhost : frameMat;
  const corners = getHexCorners(R);
  const ft = FRAME_T;

  corners.forEach(c => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(ft, h, ft), mat);
    bar.position.set(c.x, h / 2, c.z);
    bar.castShadow = !ghost;
    group.add(bar);
  });

  for (let i = 0; i < 6; i++) {
    const c1 = corners[i], c2 = corners[(i + 1) % 6];
    const dx = c2.x - c1.x, dz = c2.z - c1.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    const mx = (c1.x + c2.x) / 2, mz = (c1.z + c2.z) / 2;
    const angle = Math.atan2(dx, dz);
    const hGeo = new THREE.BoxGeometry(ft, ft, len + ft);

    [ft / 2, h - ft / 2].forEach(y => {
      const bar = new THREE.Mesh(hGeo, mat);
      bar.position.set(mx, y, mz);
      bar.rotation.y = angle;
      bar.castShadow = !ghost;
      group.add(bar);
    });
  }
}

function addWoodPlanks(group, R, h, ghost) {
  const corners = getHexCorners(R);
  const ft = FRAME_T;
  const plankH = 0.15;
  const numPlanks = Math.max(1, Math.round((h - ft * 2) / plankH));
  const actualPlankH = (h - ft * 2) / numPlanks;

  const woodMat = new THREE.MeshStandardMaterial({
    color: WOOD_SIDE, roughness: 0.72, metalness: 0,
    transparent: ghost, opacity: ghost ? 0.35 : 1
  });
  const woodMatDark = new THREE.MeshStandardMaterial({
    color: WOOD_SIDE2, roughness: 0.72, metalness: 0,
    transparent: ghost, opacity: ghost ? 0.35 : 1
  });

  for (let i = 0; i < 6; i++) {
    const c1 = corners[i], c2 = corners[(i + 1) % 6];
    const dx = c2.x - c1.x, dz = c2.z - c1.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    const mx = (c1.x + c2.x) / 2, mz = (c1.z + c2.z) / 2;
    const angle = Math.atan2(dx, dz);
    const nx = -dz / len, nz = dx / len;

    for (let p = 0; p < numPlanks; p++) {
      const py = ft + p * actualPlankH + actualPlankH / 2;
      const pW = len - ft * 2.5;
      const geo = new THREE.BoxGeometry(ft * 0.4, actualPlankH - 0.006, pW);
      const mat = (p % 2 === 0) ? woodMat : woodMatDark;
      const plank = new THREE.Mesh(geo, mat);
      const faceDist = R * Math.sqrt(3) / 2;
      plank.position.set(nx * faceDist, py, nz * faceDist);
      plank.rotation.y = angle;
      plank.castShadow = !ghost;
      plank.receiveShadow = !ghost;
      group.add(plank);
    }
  }
}

function addTopFace(group, R, h, moduleType, ghost) {
  const inset = FRAME_T * 1.2;
  const topShape = createHexShape(R - inset);
  const topGeo = new THREE.ShapeGeometry(topShape);
  const isPlanter = moduleType === 'planter';
  const color = isPlanter ? SOIL_TOP : WOOD_TOP;
  const topMat = new THREE.MeshStandardMaterial({
    color, roughness: isPlanter ? 0.95 : 0.65, metalness: 0,
    transparent: ghost, opacity: ghost ? 0.35 : 1
  });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.rotation.x = -Math.PI / 2;
  topMesh.position.y = h + 0.002;
  topMesh.receiveShadow = true;
  group.add(topMesh);

  if (isPlanter && !ghost) {
    addPlants(group, R - inset, h);
  }
}

function addPlants(group, topR, h) {
  const greenPalette = [0x2D5A1E, 0x3A6B2A, 0x4A7A3A, 0x1E4A15, 0x557744, 0x6B8E4A];
  const flowerColors = [0xE86090, 0xD4508A, 0xB860C0, 0x9977BB, 0xE8A8B8, 0xF0C860, 0xE87040];

  function makeGrassClump(px, pz, baseY, clumpH) {
    const g = new THREE.Group();
    const bladeCount = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < bladeCount; i++) {
      const bh = clumpH * (0.6 + Math.random() * 0.4);
      const bw = 0.012 + Math.random() * 0.01;
      const bladeGeo = new THREE.ConeGeometry(bw, bh, 3, 1);
      const gc = greenPalette[Math.floor(Math.random() * greenPalette.length)];
      const bladeMat = new THREE.MeshStandardMaterial({ color: gc, roughness: 0.9, metalness: 0 });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      const spread = 0.08 + Math.random() * 0.06;
      blade.position.set((Math.random() - 0.5) * spread, bh / 2, (Math.random() - 0.5) * spread);
      blade.rotation.z = (Math.random() - 0.5) * 0.4;
      blade.rotation.x = (Math.random() - 0.5) * 0.4;
      blade.castShadow = true;
      g.add(blade);
    }
    g.position.set(px, baseY, pz);
    g.userData.isPlant = true;
    g.userData.swayOffset = Math.random() * Math.PI * 2;
    g.userData.swaySpeed = 1.2 + Math.random() * 0.8;
    g.userData.swayAmt = 0.025 + Math.random() * 0.03;
    g.userData.baseX = px;
    g.userData.baseZ = pz;
    return g;
  }

  function makeFlower(px, pz, baseY, flowerH, petalColor) {
    const g = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.01, 0.014, flowerH * 0.75, 5);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3A5528, roughness: 0.9 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(0, flowerH * 0.375, 0);
    g.add(stem);

    for (let li = 0; li < 2; li++) {
      const leafH = flowerH * 0.18;
      const leafGeo = new THREE.ConeGeometry(0.024, leafH, 3, 1);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x4A7A3A, roughness: 0.85 });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const ly = flowerH * (0.2 + li * 0.2);
      const la = li * Math.PI;
      leaf.position.set(Math.cos(la) * 0.024, ly, Math.sin(la) * 0.024);
      leaf.rotation.z = (la > Math.PI / 2 ? 1 : -1) * 0.5;
      g.add(leaf);
    }

    const centerGeo = new THREE.SphereGeometry(0.024, 6, 5);
    const centerMat = new THREE.MeshStandardMaterial({ color: 0xE8D060, roughness: 0.7 });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.position.set(0, flowerH * 0.85, 0);
    g.add(center);

    const petalCount = 5 + Math.floor(Math.random() * 2);
    for (let i = 0; i < petalCount; i++) {
      const pa = (i / petalCount) * Math.PI * 2 + Math.random() * 0.2;
      const petalGeo = new THREE.SphereGeometry(0.024, 5, 4);
      const petalMat = new THREE.MeshStandardMaterial({ color: petalColor, roughness: 0.6, metalness: 0 });
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set(Math.cos(pa) * 0.036, flowerH * 0.85, Math.sin(pa) * 0.036);
      petal.scale.set(1.2, 0.35, 1.2);
      g.add(petal);
    }
    g.position.set(px, baseY, pz);
    g.userData.isPlant = true;
    g.userData.swayOffset = Math.random() * Math.PI * 2;
    g.userData.swaySpeed = 0.9 + Math.random() * 0.5;
    g.userData.swayAmt = 0.03 + Math.random() * 0.035;
    g.userData.baseX = px;
    g.userData.baseZ = pz;
    return g;
  }

  const isLow = h < 1.0;
  const count = 18;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = topR * (0.08 + Math.random() * 0.7);
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;
    const roll = Math.random();

    if (roll < 0.25) {
      group.add(makeGrassClump(px, pz, h, 0.4 + Math.random() * 0.4));
    } else if (roll < 0.75) {
      const fh = 0.6 + Math.random() * 0.6;
      const fc = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      group.add(makeFlower(px, pz, h, fh, fc));
    }
  }
  const centerH = 0.8 + Math.random() * 0.3;
  const centerColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
  group.add(makeFlower(0, 0, h, centerH, centerColor));
}

function createPrismMesh(moduleId, opacity) {
  const m = MODULES[moduleId];
  const h = m.height * SCALE;
  const group = new THREE.Group();
  const R = HEX_R;
  const ghost = opacity < 1;
  const isStep = m.type === 'step';

  if (isStep) {
    const shape = createHexShape(R);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    const mat = new THREE.MeshStandardMaterial({
      color: STEP_COLOR, roughness: 0.85, metalness: 0,
      transparent: ghost, opacity
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.005;
    mesh.castShadow = !ghost;
    mesh.receiveShadow = true;
    group.add(mesh);

    const borderMat = new THREE.MeshStandardMaterial({
      color: 0x1A1A1A, roughness: 0.6, metalness: 0.1,
      transparent: ghost, opacity: ghost ? 0.35 : 1
    });
    const corners = getHexCorners(R);
    const borderW = 0.025;
    const borderH = h + 0.008;

    for (let i = 0; i < 6; i++) {
      const c1 = corners[i], c2 = corners[(i + 1) % 6];
      const dx = c2.x - c1.x, dz = c2.z - c1.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const mx = (c1.x + c2.x) / 2, mz = (c1.z + c2.z) / 2;
      const angle = Math.atan2(dx, dz);
      const nx = -dz / len, nz = dx / len;
      const sGeo = new THREE.BoxGeometry(borderW, borderH, len + borderW);
      const side = new THREE.Mesh(sGeo, borderMat);
      const faceDist = R * Math.sqrt(3) / 2;
      side.position.set(mx + nx * borderW * 0.1, borderH / 2 + 0.005, mz + nz * borderW * 0.1);
      side.rotation.y = angle;
      side.castShadow = !ghost;
      group.add(side);
    }

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x1A1A1A, roughness: 0.6, metalness: 0.1,
      transparent: ghost, opacity: ghost ? 0.35 : 1
    });
    for (let i = 0; i < 6; i++) {
      const c1 = corners[i], c2 = corners[(i + 1) % 6];
      const dx = c2.x - c1.x, dz = c2.z - c1.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const mx = (c1.x + c2.x) / 2, mz = (c1.z + c2.z) / 2;
      const angle = Math.atan2(dx, dz);
      const rGeo = new THREE.BoxGeometry(borderW * 1.2, 0.006, len + borderW);
      const ring = new THREE.Mesh(rGeo, ringMat);
      ring.position.set(mx, h + 0.01, mz);
      ring.rotation.y = angle;
      group.add(ring);
    }
  } else {
    const bodyShape = createHexShape(R - FRAME_T * 0.8);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: h - FRAME_T, bevelEnabled: false });
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x8B6B40, roughness: 0.8, metalness: 0,
      transparent: ghost, opacity
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.rotation.x = -Math.PI / 2;
    bodyMesh.position.y = FRAME_T * 0.5;
    bodyMesh.castShadow = !ghost;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    addSteelFrame(group, R, h, ghost);
    addWoodPlanks(group, R, h, ghost);
    addTopFace(group, R, h, m.type, ghost);
  }

  return group;
}

function placeModule(q, r, moduleId) {
  // 检查是否在场地边界内
  if (!isInBoundary(q, r)) {
    // 显示红色警告
    flashCellWarning(q, r);
    showSiteWarning('超出场地范围，无法放置模块！');
    return;
  }

  const key = hexKey(q, r);
  removeModuleRaw(key);
  const { x, z } = hexToWorld(q, r);
  const group = createPrismMesh(moduleId, 1.0);
  group.position.set(x, 0, z);
  group.userData = { q, r, key, moduleId };
  scene.add(group);
  meshes[key] = group;
  placed[key] = moduleId;

  group.scale.set(0.01, 0.01, 0.01);
  animateScale(group, 1.0);

  updateStats();
  updatePaletteBadges();
}

function removeModuleRaw(key) {
  if (meshes[key]) {
    const g = meshes[key];
    animateScale(g, 0, () => { scene.remove(g); });
    delete meshes[key];
  }
  delete placed[key];
}

// 场地边界外点击时闪烁红色警告
function flashCellWarning(q, r) {
  const key = hexKey(q, r);
  const cell = gridCells[key];
  if (!cell) return;

  const originalColor = cell.mesh.material.color.getHex();
  const originalOpacity = cell.mesh.material.opacity;

  // 闪烁红色 3 次
  let count = 0;
  const flash = () => {
    if (count % 2 === 0) {
      cell.mesh.material.color.set(0xCC5544);
      cell.mesh.material.opacity = 0.7;
    } else {
      cell.mesh.material.color.set(originalColor);
      cell.mesh.material.opacity = originalOpacity;
    }
    count++;
    if (count < 6) {
      setTimeout(flash, 100);
    }
  };
  flash();
}

// 场景元素超出边界时闪烁红色警告（在放置位置显示一个红色标记）
let sceneElementWarningMarker = null;
function flashSceneElementWarning(x, z) {
  // 移除之前的警告标记
  if (sceneElementWarningMarker) {
    scene.remove(sceneElementWarningMarker);
    sceneElementWarningMarker = null;
  }

  // 创建红色警告标记（一个红色圆柱体）
  const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xCC5544, transparent: true, opacity: 0.7 });
  sceneElementWarningMarker = new THREE.Mesh(geo, mat);
  sceneElementWarningMarker.position.set(x, 0.25, z);
  scene.add(sceneElementWarningMarker);

  // 闪烁并自动移除
  let count = 0;
  const flash = () => {
    count++;
    sceneElementWarningMarker.material.opacity = count % 2 === 0 ? 0.7 : 0.2;
    if (count < 6) {
      setTimeout(flash, 100);
    } else {
      if (sceneElementWarningMarker) {
        scene.remove(sceneElementWarningMarker);
        sceneElementWarningMarker = null;
      }
    }
  };
  flash();
}

function animateScale(obj, target, onDone) {
  const start = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };
  const startTime = performance.now();
  const dur = 280;
  function tick() {
    const t = Math.min(1, (performance.now() - startTime) / dur);
    const ease = 1 - Math.pow(1 - t, 3);
    const v = start.x + (target - start.x) * ease;
    obj.scale.set(v, v, v);
    if (t < 1) requestAnimationFrame(tick);
    else if (onDone) onDone();
  }
  tick();
}

function pushUndo(action) {
  undoStack.push(action);
  if (undoStack.length > 50) undoStack.shift();
  const btn = document.getElementById('editorUndoBtn');
  if (btn) {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

window.editorUndo = function() {
  if (undoStack.length === 0) return;
  const action = undoStack.pop();
  if (action.type === 'place') {
    if (meshes[action.key]) {
      scene.remove(meshes[action.key]);
      delete meshes[action.key];
    }
    delete placed[action.key];
  } else if (action.type === 'remove') {
    placeModuleNoUndo(action.q, action.r, action.moduleId);
  } else if (action.type === 'replace') {
    if (meshes[action.key]) {
      scene.remove(meshes[action.key]);
      delete meshes[action.key];
    }
    delete placed[action.key];
    placeModuleNoUndo(action.q, action.r, action.prevModuleId);
  }
  updateStats();
  updatePaletteBadges();
  if (undoStack.length === 0) {
    const btn = document.getElementById('editorUndoBtn');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '.4';
    }
  }
};

function placeModuleNoUndo(q, r, moduleId) {
  const key = hexKey(q, r);
  const { x, z } = hexToWorld(q, r);
  const group = createPrismMesh(moduleId, 1.0);
  group.position.set(x, 0, z);
  group.userData = { q, r, key, moduleId };
  scene.add(group);
  meshes[key] = group;
  placed[key] = moduleId;
  group.scale.set(0.01, 0.01, 0.01);
  animateScale(group, 1.0);
}

function updatePaletteBadges() {
  const counts = new Array(6).fill(0);
  Object.values(placed).forEach(id => { counts[id]++; });
  MODULES.forEach((m, i) => {
    const badge = document.getElementById(`badge-${i}`);
    if (badge) {
      if (counts[i] > 0) {
        badge.textContent = counts[i];
        badge.classList.add('show');
      } else {
        badge.classList.remove('show');
      }
    }
  });
}

function updateGhost(q, r) {
  if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
  if (q === null) return;
  const key = hexKey(q, r);
  if (placed[key] !== undefined) return;
  const { x, z } = hexToWorld(q, r);
  ghostMesh = createPrismMesh(selectedModule, 0.35);
  ghostMesh.position.set(x, 0, z);
  scene.add(ghostMesh);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let mouseDown = false;
let mouseMoved = false;

function onPointerMove(e) {
  if (!renderer) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  if (mouseDown) mouseMoved = true;

  // 拖拽场景元素模式
  if (elementDragging && selectedElement) {
    raycaster.setFromCamera(mouse, camera);
    // 射线与地面相交
    const groundHits = raycaster.intersectObject(ground);
    if (groundHits.length > 0) {
      const point = groundHits[0].point;
      const { y: targetY } = getHeightAtPosition(point.x, point.z);
      // 移动到新位置，保持底座在目标高度
      selectedElement.position.x = point.x;
      selectedElement.position.z = point.z;
      selectedElement.position.y = targetY + selectedElement.userData.baseY;
    }
    return;
  }

  // 场景元素放置模式：显示元素预览
  if (sceneElementMode && currentSceneElementModel) {
    raycaster.setFromCamera(mouse, camera);
    const groundHits = raycaster.intersectObject(ground);
    if (groundHits.length > 0) {
      const point = groundHits[0].point;
      const { y: targetY } = getHeightAtPosition(point.x, point.z);
      // 移除旧预览
      if (sceneElementGhost) {
        scene.remove(sceneElementGhost);
      }
      // 创建新预览（半透明）
      sceneElementGhost = currentSceneElementModel.clone();
      sceneElementGhost.position.set(point.x, targetY + umbrellaBaseOffset, point.z);
      sceneElementGhost.visible = true;
      // 设置半透明
      sceneElementGhost.traverse(child => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0.5;
        }
      });
      scene.add(sceneElementGhost);
    } else {
      // 移除外面的预览
      if (sceneElementGhost) {
        scene.remove(sceneElementGhost);
        sceneElementGhost = null;
      }
    }
    // 不再显示模块预览
    return;
  } else {
    // 非场景元素模式时清除预览
    if (sceneElementGhost) {
      scene.remove(sceneElementGhost);
      sceneElementGhost = null;
    }
  }

  // 选择模式下（有场景元素存在时）的 hover 效果
  if (sceneElements.length > 0 && !sceneElementMode) {
    // 选择模式下鼠标悬停在场景元素上时高亮该元素
    if (selectedElement) {
      // 有选中元素，只显示选中元素的高亮，清除 hover 状态
      if (hoverKey && gridCells[hoverKey]) {
        gridCells[hoverKey].mesh.material.color.set(0xD4CCB8);
        gridCells[hoverKey].mesh.material.opacity = 0.35;
      }
      hoverKey = null;
      updateGhost(null, null);
    }
    // 选择模式下不显示模块 hover 效果
    return;
  }

  // 非选择模式（正常编辑模式）
  raycaster.setFromCamera(mouse, camera);
  const targets = Object.values(gridCells).map(c => c.mesh);
  const hits = raycaster.intersectObjects(targets);

  if (hoverKey && gridCells[hoverKey]) {
    gridCells[hoverKey].mesh.material.color.set(0xD4CCB8);
    gridCells[hoverKey].mesh.material.opacity = 0.35;
  }

  if (hits.length > 0) {
    const cell = hits[0].object;
    const key = cell.userData.key;
    hoverKey = key;
    if (placed[key] === undefined) {
      cell.material.color.set(eraserMode ? 0x999999 : fillBucketMode ? 0x4A9ADB : 0x7BA05B);
      cell.material.opacity = 0.4;
    } else {
      cell.material.color.set(0xCC5544);
      cell.material.opacity = 0.4;
    }
    // 只有在模块选择激活时才显示预览
    if (moduleSelectionActive) {
      updateGhost(cell.userData.q, cell.userData.r);
    }
  } else {
    hoverKey = null;
    if (moduleSelectionActive) {
      updateGhost(null, null);
    }
  }
}

function onPointerDown(e) {
  mouseDown = true;
  mouseMoved = false;

  // 检测是否点击在选中的场景元素上，如果是则开始拖拽
  if (e.button === 0 && selectedElement && sceneElements.length > 0) {
    raycaster.setFromCamera(mouse, camera);
    const elementTargets = sceneElements.flatMap(el => el.children.length > 0 ? el.children : [el]);
    const hits = raycaster.intersectObjects(elementTargets, true);
    if (hits.length > 0) {
      let hitObject = hits[0].object;
      while (hitObject.parent && !sceneElements.includes(hitObject)) {
        hitObject = hitObject.parent;
      }
      if (sceneElements.includes(hitObject) && hitObject === selectedElement) {
        elementDragging = true;
      }
    }
  }
}

function onPointerUp(e) {
  const wasDrag = mouseMoved;
  mouseDown = false;
  mouseMoved = false;

  // 结束拖拽
  if (elementDragging) {
    elementDragging = false;
    // 拖拽结束后如果之前在移动则不触发选择
    return;
  }

  if (wasDrag) return;

  // 场景元素交互（有场景元素时，且不在放置模式下）
  if (sceneElements.length > 0 && !sceneElementMode) {
    raycaster.setFromCamera(mouse, camera);
    const elementTargets = sceneElements.flatMap(el => el.children.length > 0 ? el.children : [el]);
    const hits = raycaster.intersectObjects(elementTargets, true);

    // 右键点击场景元素 → 删除
    if (e.button === 2) {
      if (hits.length > 0) {
        let hitObject = hits[0].object;
        while (hitObject.parent && !sceneElements.includes(hitObject)) {
          hitObject = hitObject.parent;
        }
        if (sceneElements.includes(hitObject)) {
          removeSceneElement(hitObject);
          return;
        }
      }
      return;
    }

    // 左键点击场景元素 → 选中
    if (e.button === 0) {
      if (hits.length > 0) {
        let hitObject = hits[0].object;
        while (hitObject.parent && !sceneElements.includes(hitObject)) {
          hitObject = hitObject.parent;
        }
        if (sceneElements.includes(hitObject)) {
          selectSceneElement(hitObject);
          return;
        }
      }
      // 点击空白处取消选中
      selectSceneElement(null);
      return;
    }
  }

  // 场景元素放置模式：点击地面或模块表面放置元素
  if (sceneElementMode && currentSceneElementModel) {
    raycaster.setFromCamera(mouse, camera);
    const targets = [ground];
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      const point = hits[0].point;
      const { y: surfaceHeight } = getHeightAtPosition(point.x, point.z);
      window.placeSceneElementAt(point.x, point.z, 0, surfaceHeight);
      // 放置后更新预览位置
      if (sceneElementGhost) {
        scene.remove(sceneElementGhost);
        sceneElementGhost = null;
      }
      return;
    }
  }

  if (!hoverKey) return;
  const cell = gridCells[hoverKey];
  if (!cell) return;
  const key = hoverKey;

  if (e.button === 2 || eraserMode) {
    if (placed[key] !== undefined) {
      const prevId = placed[key];
      pushUndo({ type: 'remove', key, q: cell.q, r: cell.r, moduleId: prevId });
      removeModuleRaw(key);
      updateStats();
      updatePaletteBadges();
    }
    if (e.button === 2) return;
    if (eraserMode) { updateGhost(cell.q, cell.r); return; }
  }

  if (fillBucketMode && placed[key] === undefined) {
    const count = floodFill(cell.q, cell.r, selectedModule);
    updateGhost(cell.q, cell.r);
    return;
  }

  if (placed[key] !== undefined) {
    if (placed[key] === selectedModule) {
      const prevId = placed[key];
      pushUndo({ type: 'remove', key, q: cell.q, r: cell.r, moduleId: prevId });
      removeModuleRaw(key);
    } else {
      const prevId = placed[key];
      pushUndo({ type: 'replace', key, q: cell.q, r: cell.r, moduleId: selectedModule, prevModuleId: prevId });
      removeModuleRaw(key);
      placeModule(cell.q, cell.r, selectedModule);
    }
  } else {
    pushUndo({ type: 'place', key, q: cell.q, r: cell.r, moduleId: selectedModule });
    placeModule(cell.q, cell.r, selectedModule);

    if (symmetryMode) {
      const syms = getSymmetricKeys(cell.q, cell.r);
      syms.forEach(s => {
        const sk = hexKey(s.q, s.r);
        if (placed[sk] === undefined && gridCells[sk]) {
          pushUndo({ type: 'place', key: sk, q: s.q, r: s.r, moduleId: selectedModule });
          placeModule(s.q, s.r, selectedModule);
        }
      });
    }
  }
  updateGhost(cell.q, cell.r);
  updateStats();
}

function onContextMenu(e) {
  e.preventDefault();
}

function onKeyDown(e) {
  // ESC 键：退出当前选中状态和预览
  if (e.key === 'Escape') {
    // 清除场景元素选中
    if (selectedElement) {
      selectSceneElement(null);
    }
    // 退出场景元素放置模式
    if (sceneElementMode) {
      sceneElementMode = false;
      // 清除场景元素预览
      if (sceneElementGhost) {
        scene.remove(sceneElementGhost);
        sceneElementGhost = null;
      }
      // 清除左侧面板选中状态
      document.querySelectorAll('.scene-element-item').forEach(item => item.classList.remove('selected'));
    }
    // 清除模块选择激活状态
    moduleSelectionActive = false;
    // 清除模块面板选中高亮
    document.querySelectorAll('.palette-item').forEach(p => p.classList.remove('selected'));
    // 清除预览
    updateGhost(null, null);
    // 清除 hover 状态
    if (hoverKey && gridCells[hoverKey]) {
      gridCells[hoverKey].mesh.material.color.set(0xD4CCB8);
      gridCells[hoverKey].mesh.material.opacity = 0.35;
    }
    hoverKey = null;
    return;
  }

  const n = parseInt(e.key);
  if (n >= 1 && n <= 6) {
    selectedModule = n - 1;
    moduleSelectionActive = true; // 激活模块预览
    document.querySelectorAll('.palette-item').forEach((el, j) => el.classList.toggle('selected', j === n - 1));
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    window.editorUndo();
  }
  // R 键旋转选中的场景元素
  if (e.key === 'r' || e.key === 'R') {
    window.rotateSelectedSceneElement();
  }
}

function updateStats() {
  const counts = new Array(6).fill(0);
  let total = 0;
  let totalPrice = 0;
  Object.values(placed).forEach(id => { 
    counts[id]++; 
    total++; 
    totalPrice += MODULES[id]?.price || 0;
  });
  
  const totalEl = document.getElementById('statTotal');
  const areaEl = document.getElementById('statArea');
  const priceEl = document.getElementById('statPrice');
  const countsEl = document.getElementById('moduleCounts');
  
  if (totalEl) totalEl.textContent = total;
  // 六边形面积 = (3√3/2) × 边长²，边长 490mm = 0.49m
  const HEX_AREA = (3 * Math.sqrt(3) / 2) * 0.49 * 0.49; // ≈ 0.6237 m²
  if (areaEl) areaEl.textContent = `${(total * HEX_AREA).toFixed(2)} m²`;
  if (priceEl) priceEl.textContent = `¥ ${totalPrice.toLocaleString()}`;
  
  if (countsEl) {
    countsEl.innerHTML = MODULES.map(m => {
      const count = counts[m.id] || 0;
      return `<div class="mod-count-row">
        <div class="mod-count-dot" style="background:${m.color}"></div>
        <span>${m.name}</span>
        <strong style="margin-left:auto">× ${count}</strong>
      </div>`;
    }).join('');
  }
}

window.editorAction = function(action) {
  if (action === 'clear') {
    Object.keys(meshes).forEach(key => { scene.remove(meshes[key]); delete meshes[key]; });
    Object.keys(placed).forEach(key => delete placed[key]);
    // 清空场景元素
    sceneElements.forEach(el => scene.remove(el));
    sceneElements = [];
    undoStack = [];
    const btn = document.getElementById('editorUndoBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '.4'; }
    const updateBtn = document.getElementById('updateBtn');
    if (updateBtn) { updateBtn.style.display = 'none'; }
    window.pendingDesignLoad = null;
    updateStats();
    updatePaletteBadges();
  } else if (action === 'undo') {
    window.editorUndo();
  } else if (action === 'save') {
    // console.log('editorAction save called');
    try {
      window.showSaveModal();
      // console.log('showSaveModal called successfully');
    } catch (e) {
      console.error('Error in showSaveModal:', e);
    }
  } else if (action === 'share') {
    alert('分享链接已复制！（演示功能）');
  } else if (action === 'screenshot') {
    window.takeScreenshot();
  }
};

// 截图功能：截取3D编辑器画面
window.takeScreenshot = function() {
  if (!renderer || !scene || !camera) {
    alert('截图失败：编辑器未初始化');
    return;
  }
  // 渲染一帧确保最新内容
  renderer.render(scene, camera);
  // 获取canvas并转换为图片
  const canvas = renderer.domElement;
  try {
    const dataURL = canvas.toDataURL('image/png');
    // 生成文件名
    const now = new Date();
    const timestamp = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
    const filename = 'MGILT设计_' + timestamp + '.png';
    // 创建下载链接
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch(e) {
    console.error('截图失败:', e);
    alert('截图失败，请重试');
  }
};

// 导出Excel报表
window.exportDesignExcel = function() {
  if (!renderer || !scene || !camera) {
    alert('导出失败：编辑器未初始化');
    return;
  }

  // 1. 统计模块数量
  const counts = new Array(6).fill(0);
  Object.values(placed).forEach(id => { if (id >= 0 && id < 6) counts[id]++; });

  // 2. 创建Excel工作簿
  const wb = XLSX.utils.book_new();

  // 工作表1: 模块统计 - 使用公式计算合计
  // SheetJS 公式格式: { f: "公式" }
  const wsData = [
    ['模块编号', '模块名称', '数量', '单价(元)', '小计(元)']  // 表头 (第1行)
  ];

  // 添加数据行 (第2-7行)
  MODULES.forEach((m, i) => {
    const rowNum = i + 2;
    wsData.push([
      m.code,
      m.name,
      counts[i],
      m.price,
      { f: 'C' + rowNum + '*D' + rowNum }  // 公式: 数量*单价
    ]);
  });

  // 合计行 (第8行)
  wsData.push([
    '',
    '合计',
    { f: 'SUM(C2:C7)' },  // 数量合计公式
    '',
    { f: 'SUM(E2:E7)' }   // 小计合计公式
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(wsData);
  ws1['!cols'] = [
    { wch: 15 },  // 模块编号
    { wch: 10 },  // 模块名称
    { wch: 8 },   // 数量
    { wch: 12 },  // 单价
    { wch: 12 }   // 小计
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '模块统计');

  // 4. 下载Excel文件
  const now = new Date();
  const timestamp = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
  const excelFilename = 'MGILT模块统计_' + timestamp + '.xlsx';
  XLSX.writeFile(wb, excelFilename);

  // 5. 生成并下载俯视截图（隐藏场景元素）
  const originalCameraPos = camera.position.clone();
  const originalCameraTarget = controls.target.clone();
  const originalAspect = camera.aspect;

  // 临时隐藏场景元素
  const sceneElementsVisible = sceneElements.map(el => el.visible);
  sceneElements.forEach(el => el.visible = false);

  // 计算模块边界，调整相机高度使所有内容可见
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  Object.keys(meshes).forEach(key => {
    const mesh = meshes[key];
    if (mesh) {
      const pos = mesh.position;
      minX = Math.min(minX, pos.x - 1);
      maxX = Math.max(maxX, pos.x + 1);
      minZ = Math.min(minZ, pos.z - 1);
      maxZ = Math.max(maxZ, pos.z + 1);
    }
  });

  // 如果没有模块，使用默认范围
  if (minX === Infinity) {
    minX = -10; maxX = 10; minZ = -10; maxZ = 10;
  }

  // 计算边界中心和范围
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const rangeX = maxX - minX;
  const rangeZ = maxZ - minZ;
  const maxRange = Math.max(rangeX, rangeZ) * 1.3; // 留一点边距

  // 调整相机
  const aspect = renderer.domElement.width / renderer.domElement.height;
  camera.aspect = aspect;
  const distance = maxRange / (2 * Math.tan(Math.PI / 8));  // 45度视角
  camera.position.set(centerX, Math.max(distance, 20), centerZ + distance * 0.5);
  camera.lookAt(centerX, 0, centerZ);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  // 创建截图下载
  const canvas = renderer.domElement;
  const screenshotDataURL = canvas.toDataURL('image/png', 1.0);

  // 恢复相机和场景元素
  camera.position.copy(originalCameraPos);
  controls.target.copy(originalCameraTarget);
  camera.aspect = originalAspect;
  camera.updateProjectionMatrix();
  sceneElements.forEach((el, i) => el.visible = sceneElementsVisible[i]);
  renderer.render(scene, camera);

  // 下载截图
  const link = document.createElement('a');
  link.download = 'MGILT总平面图_' + timestamp + '.png';
  link.href = screenshotDataURL;
  link.click();

  if (window.showToast) {
    window.showToast('success', '报表和截图已导出');
  }
};

window.toggleFillBucket = function() {
  fillBucketMode = !fillBucketMode;
  const fillBtn = document.getElementById('fillBtn');
  if (fillBtn) fillBtn.classList.toggle('active', fillBucketMode);
  updatePreviewHint();
};

window.toggleSymmetry = function() {
  symmetryMode = !symmetryMode;
  const symBtn = document.getElementById('symBtn');
  if (symBtn) symBtn.classList.toggle('active', symmetryMode);
  updatePreviewHint();
};

function updatePreviewHint() {
  const hint = document.getElementById('previewHint');
  if (!hint) return;
  if (fillBucketMode && symmetryMode) {
    const keys = Object.keys(gridCells).filter(k => placed[k] === undefined);
    const count = keys.length;
    hint.textContent = `预览：将放置 ${count} 个模块`;
    hint.style.display = 'inline-block';
  } else {
    hint.style.display = 'none';
  }
}

function getHexNeighbors(q, r) {
  return [
    { q: q+1, r: r }, { q: q-1, r: r },
    { q: q, r: r+1 }, { q: q, r: r-1 },
    { q: q+1, r: r-1 }, { q: q-1, r: r+1 },
  ];
}

function floodFill(startQ, startR, moduleId) {
  const visited = new Set();
  const queue = [{ q: startQ, r: startR }];
  const toFill = [];
  const maxFill = 30;

  while (queue.length > 0 && toFill.length < maxFill) {
    const { q, r } = queue.shift();
    const key = hexKey(q, r);
    if (visited.has(key)) continue;
    visited.add(key);
    if (!isInGrid(q, r)) continue;
    if (!gridCells[key]) continue;
    if (placed[key] !== undefined) continue;

    toFill.push({ q, r, key });
    const neighbors = getHexNeighbors(q, r);
    neighbors.forEach(n => {
      const nk = hexKey(n.q, n.r);
      if (!visited.has(nk)) queue.push(n);
    });
  }

  toFill.forEach(({ q, r, key }, idx) => {
    setTimeout(() => {
      if (placed[key] === undefined) {
        pushUndo({ type: 'place', key, q, r, moduleId });
        placeModule(q, r, moduleId);
      }
    }, idx * 50);
  });

  return toFill.length;
}

function getSymmetricKeys(q, r) {
  return [
    { q: -q - r, r: q },
    { q: r, r: -q - r },
    { q: -q, r: -r },
    { q: q + r, r: -q },
    { q: -r, r: q + r },
  ].filter(p => isInGrid(p.q, p.r));
}

function setCameraView(view) {
  const center = { x: 0, y: 0.5, z: 0 };
  switch(view) {
    case 'top':
      animateCamera({ x: 0, y: 18, z: 0.01 }, center);
      break;
    case 'front':
      animateCamera({ x: 0, y: 4, z: 16 }, center);
      break;
    case 'side':
      animateCamera({ x: 16, y: 4, z: 0 }, center);
      break;
  }
}

function animateCamera(targetPos, targetLookAt, dur) {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const endPos = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
  const endTarget = new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z);
  const startTime = performance.now();
  dur = dur || 600;

  function tick() {
    const t = Math.min(1, (performance.now() - startTime) / dur);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(startPos, endPos, ease);
    controls.target.lerpVectors(startTarget, endTarget, ease);
    controls.update();
    if (t < 1) requestAnimationFrame(tick);
  }
  tick();
}

let isNight = false;
window.toggleDayNight = function() {
  if (!scene) return;
  isNight = !isNight;
  const btn = document.getElementById('dayNightBtn');
  if (isNight) {
    scene.background.set(0x1A1E2E);
    scene.fog.color.set(0x1A1E2E);
    ambLight.intensity = 0.15;
    hemiLight.intensity = 0.1;
    dirLight.intensity = 0.3;
    dirLight.color.set(0x8899CC);
    dirLight.position.set(-4, 10, -3);
    if (btn) btn.textContent = '月光';
  } else {
    scene.background.set(0xF5F0E6);
    scene.fog.color.set(0xF5F0E6);
    ambLight.intensity = 0.6;
    hemiLight.intensity = 0.5;
    dirLight.intensity = 1.4;
    dirLight.color.set(0xFFF8EE);
    dirLight.position.set(6, 12, 4);
    if (btn) btn.textContent = '日光';
  }
};

function randomFill() {
  Object.keys(meshes).forEach(key => { scene.remove(meshes[key]); delete meshes[key]; });
  Object.keys(placed).forEach(key => delete placed[key]);
  undoStack = [];

  const keys = Object.keys(gridCells);
  const fillCount = Math.floor(keys.length * (0.3 + Math.random() * 0.3));
  const shuffled = keys.sort(() => Math.random() - 0.5).slice(0, fillCount);

  const weights = [3, 2, 3, 2, 3, 1];
  const totalW = weights.reduce((a, b) => a + b, 0);
  function pickModule() {
    let r = Math.random() * totalW;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return 0;
  }

  shuffled.forEach((key, idx) => {
    const cell = gridCells[key];
    const mid = pickModule();
    setTimeout(() => {
      placeModule(cell.q, cell.r, mid);
      updateStats();
      updatePaletteBadges();
    }, idx * 40);
  });

  setTimeout(() => {
    updateStats();
    updatePaletteBadges();
  }, shuffled.length * 40 + 100);
}

function initPalette() {
  const pal = document.getElementById('modulePalette');
  if (!pal || pal.children.length > 0) return;

  pal.innerHTML = MODULES.map((m, i) => {
    // 使用模块对应的颜色
    return `
    <div class="palette-item${i === 0 ? ' selected' : ''}" data-mod="${m.id}" onclick="selectModule3D(${m.id}, this)">
      <div class="module-thumbnail">
        <div class="module-hex" style="background:${m.color}"></div>
      </div>
      <div class="palette-info">
        <strong>${m.name}</strong>
        <span>${m.desc}</span>
      </div>
      <span class="pal-badge" id="badge-${i}"></span>
    </div>
  `}).join('');

  // 默认折叠
  const header = document.getElementById('modulePaletteHeader');
  const palette = document.getElementById('modulePalette');
  if (header) header.classList.add('collapsed');
  if (palette) palette.classList.add('collapsed');
}

window.toggleModulePalette = function() {
  const header = document.getElementById('modulePaletteHeader');
  const palette = document.getElementById('modulePalette');
  if (!header || !palette) return;
  header.classList.toggle('collapsed');
  palette.classList.toggle('collapsed');
};

// 场景元素类型定义
const SCENE_ELEMENT_TYPES = [
  { id: 'umbrella', name: '阳伞', icon: '<img src="images/太阳伞.png" style="width:32px;height:32px;object-fit:contain">' },
  { id: 'four_table_chair', name: '四人桌椅组合', icon: '<img src="images/桌椅组合.png" style="width:32px;height:32px;object-fit:contain">' },
  { id: 'single_chair', name: '单人高座椅组合', icon: '<img src="images/桌椅组合.png" style="width:32px;height:32px;object-fit:contain">' },
  { id: 'small_round_table', name: '小圆桌', icon: '<img src="images/桌椅组合.png" style="width:32px;height:32px;object-fit:contain">' },
  { id: 'business_person_01', name: '商务人01', icon: '<img src="images/商务人员.png" style="width:32px;height:32px;object-fit:contain">' },
  { id: 'business_person_02', name: '商务人02', icon: '<img src="images/商务人员.png" style="width:32px;height:32px;object-fit:contain">' },
  { id: 'business_person_03', name: '商务人03', icon: '<img src="images/商务人员.png" style="width:32px;height:32px;object-fit:contain">' },
  { id: 'school_blackboard', name: '学校白板', icon: '<img src="images/桌椅组合.png" style="width:32px;height:32px;object-fit:contain">' },
  { id: 'student_01', name: '学生01', icon: '<img src="images/商务人员.png" style="width:32px;height:32px;object-fit:contain">' },
  { id: 'student_02', name: '学生02', icon: '<img src="images/商务人员.png" style="width:32px;height:32px;object-fit:contain">' },
  { id: 'student_03', name: '学生03', icon: '<img src="images/商务人员.png" style="width:32px;height:32px;object-fit:contain">' }
];

// 初始化场景元素面板
function initSceneElementPalette() {
  const pal = document.getElementById('sceneElementPalette');
  if (!pal || pal.children.length > 0) return;

  pal.innerHTML = SCENE_ELEMENT_TYPES.map((el, i) => `
    <div class="scene-element-item" data-el="${el.id}" onclick="selectSceneElementType('${el.id}', this)">
      <div class="scene-element-icon">${el.icon}</div>
      <div class="palette-info">
        <strong>${el.name}</strong>
      </div>
    </div>
  `).join('');

  // 默认折叠
  const header = document.getElementById('sceneElementHeader');
  const palette = document.getElementById('sceneElementPalette');
  if (header) header.classList.add('collapsed');
  if (palette) palette.classList.add('collapsed');
}

// 切换场景元素面板
window.toggleSceneElementPalette = function() {
  const header = document.getElementById('sceneElementHeader');
  const palette = document.getElementById('sceneElementPalette');
  if (!header || !palette) return;
  header.classList.toggle('collapsed');
  palette.classList.toggle('collapsed');
};

// 选择场景元素类型
window.selectSceneElementType = function(elementId, el) {
  // 取消之前选中
  document.querySelectorAll('.scene-element-item').forEach(item => item.classList.remove('selected'));
  // 选中当前
  if (el) el.classList.add('selected');
  // 加载并切换到该元素
  window.toggleSceneElementMode(elementId);
};

window.selectModule3D = function(id, el) {
  selectedModule = id;
  moduleSelectionActive = true; // 激活模块选择，显示预览
  eraserMode = false;
  const eraserBtn = document.getElementById('eraserBtn');
  if (eraserBtn) { eraserBtn.style.background = ''; eraserBtn.style.color = ''; }
  document.querySelectorAll('.palette-item').forEach(p => p.classList.remove('selected'));
  if (el) el.classList.add('selected');
  if (hoverKey && gridCells[hoverKey]) updateGhost(gridCells[hoverKey].q, gridCells[hoverKey].r);
};

function onResize() {
  const wrap = document.getElementById('editorCanvas');
  if (!wrap || !camera || !renderer) return;
  camera.aspect = wrap.clientWidth / wrap.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
}

function updatePlantSway(time) {
  Object.values(meshes).forEach(group => {
    group.traverse(child => {
      if (child.userData && child.userData.isPlant) {
        const d = child.userData;
        child.position.x = d.baseX + Math.sin(time * d.swaySpeed + d.swayOffset) * d.swayAmt;
        child.position.z = d.baseZ + Math.cos(time * d.swaySpeed * 0.7 + d.swayOffset + 1) * d.swayAmt * 0.6;
      }
    });
  });
}

function animate() {
  if (!renderer) return;
  requestAnimationFrame(animate);
  const time = performance.now() * 0.001;
  controls.update();
  updatePlantSway(time);
  renderer.render(scene, camera);
}

window.initEditor = function() {
  // console.log('MGILT Editor: initEditor called');
  initPalette();
  initSceneElementPalette();
  // console.log('MGILT Editor: Palette initialized');
  setTimeout(() => {
    // console.log('MGILT Editor: Initializing 3D...');
    try {
      initEditor3D();
      // console.log('MGILT Editor: 3D initialized successfully');
    } catch (e) {
      console.error('MGILT Editor: 3D init error:', e);
      alert('3D编辑器初始化失败: ' + e.message);
    }
    const canvas = document.getElementById('editorCanvas');
    if (canvas) {
      // console.log('MGILT Editor: Canvas found, adding event listeners');
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerdown', (e) => { canvas.focus(); onPointerDown(e); });
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('contextmenu', onContextMenu);
      window.addEventListener('keydown', onKeyDown);
      window.editorReady = true;
      checkAndLoadPendingDesign();
    } else {
      console.error('MGILT Editor: Canvas not found!');
      alert('错误：找不到编辑器画布！');
    }
  }, 200);
  updateStats();
};

window.randomFillDesign = randomFill;
window.setCameraView = setCameraView;
window.loadDesignToEditor = loadDesignToEditor;
window.setSiteSize = setSiteSizeFromUI;

const RECOMMEND_PRESETS = {
  restaurant: {
    name: '餐厅外摆',
    modules: [
      { type: 'step', positions: [[-2,0],[-2,-1],[-3,1],[-1,-1],[-1,0],[-2,1],[-2,2],[-3,3],[-2,3],[-1,2],[-1,1],[0,0],[0,-1],[-1,-2],[0,-2]] },
      { type: 'seat-low', positions: [[-3,2]] },
      { type: 'planter-low', positions: [[-3,0],[0,1],[0,-3]] },
      { type: 'planter-high', positions: [[0,2]] },
      { type: 'seat-high', positions: [[-1,3],[1,-2]] },
      { type: 'table', positions: [[1,-3]] },
    ],
    sceneElements: [
      { elementType: 'small_round_table', x: -0.29186218975064904, y: 0.10000000003232559, z: 2.9309903023425203, rotationY: 0, surfaceHeight: 0.1 },
      { elementType: 'single_chair', x: -2.7995568112328977, y: 0.10000049697058558, z: -1.945437701085167, rotationY: 4.71238898038469, surfaceHeight: 0.1 },
      { elementType: 'umbrella', x: -1.6325704690330696, y: 0.0000012256766002138875, z: -5.774714143771643, rotationY: 4.71238898038469, surfaceHeight: 0 },
      { elementType: 'business_person_01', x: -1.5317981299597339, y: 0.0999999999611789, z: 1.2659561968676245, rotationY: 0, surfaceHeight: 0.1 },
      { elementType: 'business_person_02', x: -1.5109559704584008, y: 0.10000009295399802, z: 3.732931802875959, rotationY: 3.141592653589793, surfaceHeight: 0.1 }
    ]
  },
  office: {
    name: '办公交流',
    modules: [
      { type: 'step', positions: [[-1,3],[0,3],[0,2],[1,2],[-1,2],[0,1],[1,1],[2,0],[1,0],[0,0],[-1,0],[0,-1],[1,-1],[2,-1],[1,-2],[2,-2],[1,-3],[2,-3],[3,-3],[3,-4],[2,-4],[1,-4],[2,-5],[3,-5]] },
      { type: 'planter-high', positions: [[-1,1],[3,-2]] },
      { type: 'seat-low', positions: [[-2,2],[4,-5]] },
      { type: 'table', positions: [[-2,3],[4,-6]] },
      { type: 'planter-low', positions: [[3,-1],[0,-2],[3,-6]] },
    ],
    sceneElements: [
      { elementType: 'umbrella', x: 0.8913139709953803, y: 0.0000012256766002138875, z: -10.32163795413322, rotationY: 4.71238898038469, surfaceHeight: 0 },
      { elementType: 'four_table_chair', x: 0.7960096214266219, y: 0.09962464233736937, z: -0.6296060751853458, rotationY: 2.356194490192345, surfaceHeight: 0.1 },
      { elementType: 'single_chair', x: -0.6249059828162498, y: 0.10000049697058558, z: -6.108006687202047, rotationY: 4.71238898038469, surfaceHeight: 0.1 },
      { elementType: 'single_chair', x: 2.0087419546139884, y: 0.10000049697058558, z: 3.6701443468463846, rotationY: 7.853981633974483, surfaceHeight: 0.1 },
      { elementType: 'business_person_01', x: 1.369981947261934, y: 0.0999999999611789, z: -3.8628810673336704, rotationY: 0, surfaceHeight: 0.1 },
      { elementType: 'business_person_02', x: 2.597453658639205, y: 0.10000009295399802, z: 1.9190800369831829, rotationY: 0.7853981633974483, surfaceHeight: 0.1 },
      { elementType: 'business_person_03', x: -0.28301600226748747, y: 0.10000000004758688, z: -2.47515031963297, rotationY: 3.141592653589793, surfaceHeight: 0.1 }
    ]
  },
  school: {
    name: '学校庭院',
    modules: [
      { type: 'step', positions: [[1,-1],[0,0],[-1,0],[0,-1],[1,0],[1,-2],[2,-1],[2,-2],[2,0],[3,-1],[3,-2],[3,0],[2,-3],[0,-2],[-1,-1],[-1,-2],[0,-3],[-2,-1],[-2,1],[-1,1],[-2,2],[-1,2],[0,1],[0,2],[1,1],[2,1]] },
      { type: 'seat-low', positions: [[4,-1],[3,-3],[1,-3],[-1,-3]] },
      { type: 'table', positions: [[4,-2],[-2,0]] },
      { type: 'seat-high', positions: [[3,-4],[2,-4],[-2,-2]] },
      { type: 'planter-low', positions: [[-2,3],[-3,2],[1,2]] },
      { type: 'planter-high', positions: [[-3,3],[-3,1],[2,2]] },
    ],
    sceneElements: [
      { elementType: 'school_blackboard', x: 0.12820290418951297, y: 0.1000000969226299, z: 2.286350901142953, rotationY: 7.853981633974483, surfaceHeight: 0.1 },
      { elementType: 'student_01', x: -0.5974975107823308, y: 0.10000001739335448, z: -1.6679464601958767, rotationY: 0, surfaceHeight: 0.1 },
      { elementType: 'student_02', x: -1.1709150829951547, y: 0.10000173708067842, z: 0.4386522131950885, rotationY: 2.356194490192345, surfaceHeight: 0.1 },
      { elementType: 'business_person_01', x: 1.0189295790788702, y: 0.0999999999611789, z: -3.3537050657455096, rotationY: 0, surfaceHeight: 0.1 },
      { elementType: 'student_03', x: 2.599568368569747, y: 0.10000063191038358, z: -1.0241268978608458, rotationY: 5.497787143782138, surfaceHeight: 0.1 }
    ]
  }
};

function getModuleIdByType(type) {
  const map = { 'step': 0, 'seat-low': 1, 'planter-low': 2, 'seat-high': 3, 'planter-high': 4, 'table': 5 };
  return map[type] || 0;
}

function applyRecommend(type) {
  const preset = RECOMMEND_PRESETS[type];
  if (!preset) return;

  Object.keys(meshes).forEach(key => { scene.remove(meshes[key]); delete meshes[key]; });
  Object.keys(placed).forEach(key => delete placed[key]);
  // 清空场景元素
  sceneElements.forEach(el => scene.remove(el));
  sceneElements = [];
  undoStack = [];

  const btn = document.getElementById('editorUndoBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.4'; }

  let delay = 0;
  preset.modules.forEach(group => {
    const modId = getModuleIdByType(group.type);
    group.positions.forEach(([q, r]) => {
      const key = hexKey(q, r);
      if (isInGrid(q, r) && gridCells[key] && placed[key] === undefined) {
        setTimeout(() => {
          pushUndo({ type: 'place', key, q, r, moduleId: modId });
          placeModule(q, r, modId);
        }, delay);
        delay += 30;
      }
    });
  });

  setTimeout(() => {
    updateStats();
    updatePaletteBadges();
    // 加载预设的场景元素
    if (preset.sceneElements && preset.sceneElements.length > 0) {
      window.loadSceneElementsData(preset.sceneElements);
    }
  }, delay + 100);
  closeRecommendMenu();
}

window.toggleRecommendMenu = function() {
  const menu = document.getElementById('recommendMenu');
  if (menu) menu.classList.toggle('show');
};

window.closeRecommendMenu = function() {
  const menu = document.getElementById('recommendMenu');
  if (menu) menu.classList.remove('show');
};

window.applyRecommend = applyRecommend;

// 导出当前设计配置（供控制台调用）
window.exportDesignConfig = function() {
  const types = ['step', 'seat-low', 'planter-low', 'seat-high', 'planter-high', 'table'];
  const result = {};
  Object.keys(placed).forEach(key => {
    const [q, r] = key.split(',').map(Number);
    const modId = placed[key];
    const type = types[modId];
    if (!result[type]) result[type] = [];
    result[type].push([q, r]);
  });
  // console.log('模块配置数据：');
  // console.log(JSON.stringify(result, null, 2));
  return result;
};

function saveDesignToAccount(name) {
  const session = JSON.parse(localStorage.getItem('mgilt_session') || 'null');
  if (!session) {
    alert('请先登录后再保存设计');
    window.location.hash = 'login';
    return;
  }
  // Capture screenshot from renderer (smaller size for localStorage)
  let screenshot = null;
  if (renderer && renderer.domElement) {
    // Create smaller canvas for screenshot
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = 400;
    smallCanvas.height = 300;
    const ctx = smallCanvas.getContext('2d');
    ctx.drawImage(renderer.domElement, 0, 0, 400, 300);
    screenshot = smallCanvas.toDataURL('image/jpeg', 0.7);
  }
  const designData = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    name: name || ('设计方案 ' + new Date().toLocaleDateString('zh-CN')),
    modules: JSON.parse(JSON.stringify(placed)),
    sceneElements: exportSceneElementsData(),
    screenshot: screenshot
  };
  let savedDesigns = JSON.parse(localStorage.getItem('mgilt_designs') || '[]');
  savedDesigns.push(designData);
  localStorage.setItem('mgilt_designs', JSON.stringify(savedDesigns));
  if (window.showToast) {
    window.showToast('success', '设计已保存到您的账号！');
  } else {
    alert('设计已保存到您的账号！');
  }
}

// Called from save modal
window.saveDesignFromModal = function(name) {
  saveDesignToAccount(name);
};

// Update existing design
window.updateDesignToAccount = function(name) {
  const session = JSON.parse(localStorage.getItem('mgilt_session') || 'null');
  if (!session) {
    alert('请先登录后再保存设计');
    window.location.hash = 'login';
    return;
  }
  const design = window.pendingDesignLoad;
  if (!design) {
    alert('未找到要更新的方案');
    return;
  }
  // Capture screenshot from renderer (smaller size for localStorage)
  let screenshot = null;
  if (renderer && renderer.domElement) {
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = 400;
    smallCanvas.height = 300;
    const ctx = smallCanvas.getContext('2d');
    ctx.drawImage(renderer.domElement, 0, 0, 400, 300);
    screenshot = smallCanvas.toDataURL('image/jpeg', 0.7);
  }
  let savedDesigns = JSON.parse(localStorage.getItem('mgilt_designs') || '[]');
  const index = savedDesigns.findIndex(d => d.id === design.id);
  if (index !== -1) {
    savedDesigns[index] = {
      ...savedDesigns[index],
      name: name || savedDesigns[index].name,
      modules: JSON.parse(JSON.stringify(placed)),
      sceneElements: exportSceneElementsData(),
      screenshot: screenshot,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('mgilt_designs', JSON.stringify(savedDesigns));
    if (window.showToast) {
      window.showToast('success', '设计方案已更新！');
    } else {
      alert('设计方案已更新！');
    }
  }
};

window.editorReady = false;

function loadDesignToEditor(designId) {
  // console.log('loadDesignToEditor called with designId:', designId);
  const savedDesigns = JSON.parse(localStorage.getItem('mgilt_designs') || '[]');
  // console.log('savedDesigns:', savedDesigns);
  const design = savedDesigns.find(d => d.id === designId);
  if (!design) {
    alert('未找到该设计');
    return;
  }
  // console.log('Found design:', design);
  // Clear editor state before navigating
  if (scene) {
    // console.log('Clearing existing scene meshes');
    Object.keys(meshes).forEach(key => { scene.remove(meshes[key]); });
  }
  // Clear existing objects instead of reassigning to new objects
  Object.keys(meshes).forEach(key => delete meshes[key]);
  Object.keys(placed).forEach(key => delete placed[key]);
  undoStack = [];
  const btn = document.getElementById('editorUndoBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.4'; }

  window.pendingDesignLoad = design;
  window.editorReady = false;
  // console.log('Setting pendingDesignLoad, navigating to editor');
  window.navigateTo('editor');
  // console.log('After navigate, window.editorReady:', window.editorReady, 'scene:', !!scene);

  // Editor initialization is triggered by handleRoute (setTimeout 200ms)
  // If editor was already initialized, complete load immediately
  if (window.editorReady && scene) {
    // console.log('Editor already ready, loading design now');
    setTimeout(completeDesignLoad, 100);
  } else {
    // console.log('Editor not ready, will be loaded via handleRoute/initEditor');
  }
}

function completeDesignLoad() {
  // console.log('completeDesignLoad called');
  const design = window.pendingDesignLoad;
  if (!design) {
    // console.log('No design to load');
    return;
  }

  // Keep design ID for update functionality
  window.currentEditingDesignId = design.id;

  if (!scene || !meshes) {
    // console.log('Editor not ready: scene=', !!scene, 'meshes=', !!meshes);
    if (window.showToast) window.showToast('error', '编辑器未就绪');
    return;
  }

  // console.log('Loading design with modules:', design.modules);
  Object.keys(meshes).forEach(key => { scene.remove(meshes[key]); delete meshes[key]; });
  Object.keys(placed).forEach(key => delete placed[key]);
  // 清空场景元素
  sceneElements.forEach(el => scene.remove(el));
  sceneElements = [];
  undoStack = [];
  const btn = document.getElementById('editorUndoBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.4'; }

  // Show update button when editing existing design
  const updateBtn = document.getElementById('updateBtn');
  if (updateBtn) { updateBtn.style.display = 'inline-block'; }

  const modules = design.modules || {};
  Object.entries(modules).forEach(([key, modId]) => {
    const [q, r] = key.split(',').map(Number);
    if (!isNaN(q) && !isNaN(r) && isInGrid(q, r)) {
      placeModuleNoUndo(q, r, modId);
    }
  });
  updateStats();
  updatePaletteBadges();

  // 加载场景元素（如果有）
  if (design.sceneElements && design.sceneElements.length > 0) {
    setTimeout(() => {
      window.loadSceneElementsData(design.sceneElements);
    }, 500);
  }

  if (window.showToast) window.showToast('info', '已加载设计方案：' + design.name);
}

function checkAndLoadPendingDesign() {
  // console.log('checkAndLoadPendingDesign: pending=', !!window.pendingDesignLoad, 'ready=', window.editorReady);
  if (window.pendingDesignLoad && window.editorReady) {
    // console.log('Calling completeDesignLoad from checkAndLoadPendingDesign');
    completeDesignLoad();
  }
}

document.addEventListener('click', function(e) {
  const dropdown = document.querySelector('.toolbar-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    closeRecommendMenu();
  }
});

// ========== 场景元素测试 ==========
let sceneElements = [];
let selectedElement = null;
let sceneElementMode = false;
let elementSelectMode = false;
let elementDragging = false; // 是否在拖拽场景元素
let pendingSceneElements = []; // 待加载的场景元素队列（用于加载设计时）
let sceneElementsLoadedCount = 0; // 已加载的场景元素数量

const SCENE_ELEMENTS = {
  umbrella: { id: 'umbrella', name: '阳伞', path: 'models/阳伞2.glb', scale: 2 },
  four_table_chair: { id: 'four_table_chair', name: '四人桌椅组合', path: 'models/四人桌椅组合.glb', scale: 2 },
  single_chair: { id: 'single_chair', name: '单人高座椅组合', path: 'models/单人高座椅组合.glb', scale: 2 },
  small_round_table: { id: 'small_round_table', name: '小圆桌', path: 'models/小圆桌.glb', scale: 2 },
  business_person_01: { id: 'business_person_01', name: '商务人01', path: 'models/商务人01.glb', scale: 2 },
  business_person_02: { id: 'business_person_02', name: '商务人02', path: 'models/商务人02.glb', scale: 2 },
  business_person_03: { id: 'business_person_03', name: '商务人03', path: 'models/商务人03.glb', scale: 2 },
  school_blackboard: { id: 'school_blackboard', name: '学校白板', path: 'models/学校白板.glb', scale: 2 },
  student_01: { id: 'student_01', name: '学生01', path: 'models/学生01.glb', scale: 2 },
  student_02: { id: 'student_02', name: '学生02', path: 'models/学生02.glb', scale: 2 },
  student_03: { id: 'student_03', name: '学生03', path: 'models/学生03.glb', scale: 2 }
};

// 导出场景元素数据（用于保存设计）
function exportSceneElementsData() {
  return sceneElements.map(el => ({
    elementType: el.userData.elementType,
    x: el.position.x,
    y: el.position.y,
    z: el.position.z,
    rotationY: el.rotation.y,
    surfaceHeight: el.userData.surfaceHeight || 0
  }));
}
window.exportSceneElementsData = exportSceneElementsData;

// 加载场景元素数据（用于恢复设计）
window.loadSceneElementsData = function(elementsData) {
  if (!elementsData || !Array.isArray(elementsData) || elementsData.length === 0) return;

  pendingSceneElements = elementsData;
  sceneElementsLoadedCount = 0;

  // 逐个加载场景元素
  function loadNext() {
    if (sceneElementsLoadedCount >= pendingSceneElements.length) {
      pendingSceneElements = [];
      if (window.showToast) window.showToast('info', '场景元素已加载');
      return;
    }

    const data = pendingSceneElements[sceneElementsLoadedCount];
    const config = SCENE_ELEMENTS[data.elementType];
    if (!config) {
      sceneElementsLoadedCount++;
      loadNext();
      return;
    }

    // 设置当前元素配置并加载模型
    currentElementConfig = config;
    window.loadSceneElementModel(data.elementType);

    // 等待模型加载完成后放置
    const checkLoaded = setInterval(() => {
      if (currentSceneElementModel && currentSceneElementModel.userData.elementType === data.elementType) {
        clearInterval(checkLoaded);
        // 使用保存的位置和旋转创建实例
        const instance = currentSceneElementModel.clone();
        instance.position.set(data.x, data.y, data.z);
        instance.rotation.y = data.rotationY;
        instance.visible = true;
        instance.userData.isSceneElement = true;
        instance.userData.elementType = data.elementType;
        instance.userData.selected = false;
        instance.userData.baseY = data.y - (data.surfaceHeight || 0);
        instance.userData.surfaceHeight = data.surfaceHeight || 0;
        instance.userData.originalMaterials = [];
        instance.traverse(child => {
          if (child.isMesh && child.material) {
            instance.userData.originalMaterials.push({ mesh: child, material: child.material });
          }
        });
        scene.add(instance);
        sceneElements.push(instance);

        sceneElementsLoadedCount++;
        loadNext();
      }
    }, 100);
  }

  loadNext();
};

let umbrellaOriginalMaterials = []; // 保存原始材质用于恢复选中状态
let umbrellaBaseOffset = 0; // 阳伞底座偏移量
let currentSceneElementModel = null; // 当前场景元素模型
let currentElementConfig = null; // 当前元素配置

// 根据世界坐标获取"落地高度"（地面或模块顶面）
// 根据世界坐标获取"落地高度"（地面或模块顶面）
function getHeightAtPosition(x, z) {
  // 首先检查是否有模块在这个位置
  const hexR = HEX_R;
  const sqrt3 = Math.sqrt(3);

  // 遍历所有已放置的模块，检查是否在这个位置
  for (const key in meshes) {
    const group = meshes[key];
    const { q, r } = group.userData;
    // 计算这个格子中心的世界坐标
    const cellX = hexR * sqrt3 * (q + r / 2);
    const cellZ = hexR * 1.5 * r;

    // 计算到格子中心的距离
    const dx = x - cellX;
    const dz = z - cellZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // 如果在六边形范围内（稍微内缩一点）
    if (dist < hexR * 0.92) {
      // 获取这个模块的高度
      const modId = placed[key];
      if (modId !== undefined && MODULES[modId]) {
        const moduleHeight = MODULES[modId].height * SCALE;
        return { y: moduleHeight, onModule: true };
      }
    }
  }

  // 检查是否在网格范围内但没有模块（地面）
  // 将世界坐标转换为六边形网格坐标
  const qFloat = (sqrt3 / 3 * x - 1 / 3 * z) / hexR;
  const rFloat = (2 / 3 * z) / hexR;
  const q = Math.round(qFloat);
  const r = Math.round(rFloat);

  // 检查这个网格坐标是否在网格内
  if (isInGrid(q, r)) {
    return { y: 0, onModule: false, q, r };
  }

  // 默认在地面上
  return { y: 0, onModule: false };
}

window.loadSceneElementModel = function(elementId) {
  const config = SCENE_ELEMENTS[elementId];
  if (!config) return;

  // 如果没有模型路径，显示提示
  if (!config.path) {
    if (window.showToast) window.showToast('info', config.name + '模型待添加');
    return;
  }

  const loader = new GLTFLoader();
  loader.load(
    config.path,
    (gltf) => {
      // console.log('场景元素加载成功:', config.name);
      currentSceneElementModel = gltf.scene;
      currentSceneElementModel.scale.setScalar(config.scale);

      // 计算模型的包围盒，找到底座高度
      const box = new THREE.Box3().setFromObject(currentSceneElementModel);
      const minY = box.min.y;
      const maxY = box.max.y;
      // console.log('模型包围盒: minY=' + minY + ', maxY=' + maxY);

      // 底座偏移量 = -minY，这样底座会在 y=0 的位置
      umbrellaBaseOffset = -minY * config.scale;
      // console.log('底座偏移量:', umbrellaBaseOffset);

      // 模板模型不显示，只用于克隆
      currentSceneElementModel.visible = false;
      currentSceneElementModel.userData.isSceneElement = true;
      currentSceneElementModel.userData.elementType = elementId;
      currentSceneElementModel.userData.baseY = umbrellaBaseOffset;
      if (window.showToast) window.showToast('info', config.name + '已加载，点击场景放置');
    },
    (progress) => {
      if (progress.total > 0) {
        // console.log('加载进度:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
      }
    },
    (err) => {
      console.error('加载失败:', err);
      if (window.showToast) window.showToast('error', '模型加载失败');
    }
  );
};

window.toggleSceneElementMode = function(elementId) {
  const config = SCENE_ELEMENTS[elementId];
  if (!config) return;

  // 如果没有模型路径，提示并返回
  if (!config.path) {
    if (window.showToast) window.showToast('info', config.name + ' 模型待添加');
    return;
  }

  if (sceneElementMode) {
    // 关闭模式
    sceneElementMode = false;
    // console.log('场景元素模式: 关闭');
  } else {
    // 开启模式前先关闭选择模式
    if (elementSelectMode) {
      elementSelectMode = false;
      const selectBtn = document.getElementById('btn-select-element');
      if (selectBtn) selectBtn.classList.remove('active');
    }
    // 取消选中
    if (selectedElement) {
      selectSceneElement(null);
    }
    // 开启模式，清除模块选择激活状态
    moduleSelectionActive = false;
    sceneElementMode = true;
    currentElementConfig = config;
    if (!currentSceneElementModel || currentSceneElementModel.userData.elementType !== elementId) {
      window.loadSceneElementModel(elementId);
    }
    // console.log('场景元素模式: 开启', config.name);
  }
};

window.placeSceneElementAt = function(x, z, rotationY, baseHeight) {
  // 检查是否在场地边界内
  if (!isPointInBoundary(x, z)) {
    showSiteWarning('超出场地范围，无法放置场景元素！');
    flashSceneElementWarning(x, z);
    return;
  }

  if (!currentSceneElementModel) {
    console.warn('场景元素模型未加载');
    return;
  }
  const instance = currentSceneElementModel.clone();
  // 元素底部 = 模块表面高度 + 模型底座偏移
  const finalY = (baseHeight || 0) + umbrellaBaseOffset;
  instance.position.set(x, finalY, z);
  instance.rotation.y = rotationY || 0;
  instance.visible = true;
  instance.userData.isSceneElement = true;
  instance.userData.elementType = currentElementConfig.id;
  instance.userData.selected = false;
  instance.userData.baseY = umbrellaBaseOffset;
  instance.userData.surfaceHeight = baseHeight || 0;
  // 保存原始材质
  instance.userData.originalMaterials = [];
  instance.traverse(child => {
    if (child.isMesh && child.material) {
      instance.userData.originalMaterials.push({ mesh: child, material: child.material });
    }
  });
  scene.add(instance);
  sceneElements.push(instance);
  // console.log('已放置场景元素 at', x, z, 'finalY:', finalY, 'surfaceHeight:', baseHeight);
};

window.placeSceneElementAt = placeSceneElementAt;

// 选中场景元素（带高亮效果）
function selectSceneElement(element) {
  // 取消之前的选中，恢复原始颜色
  if (selectedElement) {
    selectedElement.userData.selected = false;
    // 恢复原始材质
    if (selectedElement.userData.originalMaterials) {
      selectedElement.userData.originalMaterials.forEach(({ mesh, material }) => {
        mesh.material = material;
      });
    }
  }

  selectedElement = element;
  // 选择场景元素后清除模块选择激活状态
  moduleSelectionActive = false;
  if (selectedElement) {
    selectedElement.userData.selected = true;
    // 添加高亮效果
    if (selectedElement.userData.originalMaterials) {
      selectedElement.userData.originalMaterials.forEach(({ mesh }) => {
        if (mesh.material) {
          mesh.material = mesh.material.clone();
          mesh.material.emissive = new THREE.Color(0x7A9E7E);
          mesh.material.emissiveIntensity = 0.3;
        }
      });
    }
    // console.log('选中场景元素');
  }
}

// 切换元素选择模式
window.toggleElementSelectMode = function() {
  const btn = document.getElementById('btn-select-element');

  if (elementSelectMode) {
    // 关闭选择模式
    elementSelectMode = false;
    if (btn) btn.classList.remove('active');
    // 取消选中
    if (selectedElement) {
      selectSceneElement(null);
    }
    // console.log('元素选择模式: 关闭');
  } else {
    // 开启选择模式前先关闭放置模式
    if (sceneElementMode) {
      sceneElementMode = false;
      const umbrellaBtn = document.getElementById('btn-umbrella');
      if (umbrellaBtn) umbrellaBtn.classList.remove('active');
    }
    // 开启选择模式
    elementSelectMode = true;
    if (btn) btn.classList.add('active');
    // console.log('元素选择模式: 开启');
  }
};

// 右击删除场景元素
function removeSceneElement(element) {
  scene.remove(element);
  const idx = sceneElements.indexOf(element);
  if (idx > -1) sceneElements.splice(idx, 1);
  if (selectedElement === element) {
    selectedElement = null;
  }
  // console.log('已删除场景元素');
}

// 清空所有场景元素
window.clearAllSceneElements = function() {
  sceneElements.forEach(el => scene.remove(el));
  sceneElements = [];
  selectedElement = null;
  // console.log('已清空所有场景元素');
};

// 旋转选中元素（每次旋转45度）
window.rotateSelectedSceneElement = function() {
  if (selectedElement) {
    selectedElement.rotation.y += Math.PI / 4;
    // console.log('旋转元素, 当前角度:', (selectedElement.rotation.y * 180 / Math.PI).toFixed(0), '度');
    if (window.showToast) window.showToast('info', '已旋转45°');
  } else {
    // console.log('没有选中的场景元素');
    if (window.showToast) window.showToast('info', '请先点击选择场景元素');
  }
};

// 测试：在控制台输入 window.toggleSceneElementMode('umbrella') 来加载阳伞

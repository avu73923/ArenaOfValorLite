// ===================== scene3d.js — Three.js render layer =====================
// Reads global state from game.js (entities, projectiles, particles, player, WORLD_W, WORLD_D, LANE_Z)
// and keeps a Three.js scene in sync with it. Game logic never touches THREE directly.

let scene, camera, renderer;
let dynamicGroup; // everything that gets created/destroyed as the game runs

const TEAM_COLOR = { ally: 0x4f8cff, enemy: 0xff5c5c };
const GOLD = 0xf2c14e;
const HEAD_COLOR = 0xd9cdb8;

function initScene() {
  const container = document.getElementById('three-container');
  const width = container.clientWidth, height = container.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d12);
  scene.fog = new THREE.Fog(0x0b0d12, 500, 1400);

  camera = new THREE.PerspectiveCamera(42, width / height, 1, 3000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0x8892b0, 0.55);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff2d6, 0.9);
  sun.position.set(-300, 500, 200);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x3355aa, 0.35);
  rim.position.set(300, 200, -400);
  scene.add(rim);

  buildGround();

  dynamicGroup = new THREE.Group();
  scene.add(dynamicGroup);

  window.addEventListener('resize', onResize);
}

function onResize() {
  const container = document.getElementById('three-container');
  const width = container.clientWidth, height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function worldX(x) { return x - WORLD_W / 2; }
function worldZ(z) { return z - WORLD_D / 2; }

function buildGround() {
  const groundGeo = new THREE.PlaneGeometry(WORLD_W + 400, WORLD_D + 400);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0e1016, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const laneGeo = new THREE.PlaneGeometry(WORLD_W, 92);
  const laneMat = new THREE.MeshStandardMaterial({ color: 0x161922, roughness: 0.9 });
  const lane = new THREE.Mesh(laneGeo, laneMat);
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.2, 0);
  scene.add(lane);

  const lineGeo = new THREE.BoxGeometry(WORLD_W, 0.6, 1.4);
  const lineMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.18 });
  const centerLine = new THREE.Mesh(lineGeo, lineMat);
  centerLine.position.set(0, 0.5, 0);
  scene.add(centerLine);
}

// ---------------------- Model factories ----------------------
function makeStandardMat(color, emissiveIntensity = 0.25) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity, roughness: 0.55, metalness: 0.15 });
}

function createHumanoid(team, isMinion) {
  const s = isMinion ? 0.62 : 1;
  const group = new THREE.Group();
  const bodyMat = makeStandardMat(TEAM_COLOR[team], isMinion ? 0.18 : 0.3);
  const headMat = new THREE.MeshStandardMaterial({ color: HEAD_COLOR, roughness: 0.7 });

  const legH = 16 * s;
  const legGeo = new THREE.CylinderGeometry(1.6 * s, 1.8 * s, legH, 8);
  const legL = new THREE.Mesh(legGeo, bodyMat); legL.position.set(-3.2 * s, legH / 2, 0);
  const legR = new THREE.Mesh(legGeo, bodyMat); legR.position.set(3.2 * s, legH / 2, 0);
  group.add(legL, legR);

  const torsoGeo = new THREE.BoxGeometry(9 * s, 16 * s, 5 * s);
  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.position.set(0, legH + 8 * s, 0);
  group.add(torso);

  const armGeo = new THREE.CylinderGeometry(1.4 * s, 1.6 * s, 15 * s, 8);
  const armL = new THREE.Mesh(armGeo, bodyMat); armL.position.set(-7 * s, legH + 8 * s, 0); armL.rotation.z = 0.12;
  const armR = new THREE.Mesh(armGeo, bodyMat); armR.position.set(7 * s, legH + 8 * s, 0); armR.rotation.z = -0.12;
  group.add(armL, armR);

  const headGeo = new THREE.SphereGeometry(5.2 * s, 12, 10);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, legH + 16 * s + 5.2 * s, 0);
  group.add(head);

  const noseGeo = new THREE.ConeGeometry(1.1 * s, 3.2 * s, 6);
  const nose = new THREE.Mesh(noseGeo, new THREE.MeshBasicMaterial({ color: GOLD }));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, legH + 16 * s + 5.2 * s, 5.2 * s);
  group.add(nose);

  group.userData.totalHeight = legH + 16 * s + 10.4 * s;
  return group;
}

function createTower(team) {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x20222b, roughness: 0.9 });
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.8 });
  const crystalMat = makeStandardMat(TEAM_COLOR[team], 0.55);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 10, 8), stoneMat);
  base.position.y = 5;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 50, 8), shaftMat);
  shaft.position.y = 5 + 25;
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(10, 0), crystalMat);
  crystal.position.y = 5 + 50 + 10;

  group.add(base, shaft, crystal);
  group.userData.totalHeight = 75;
  return group;
}

function createNexus(team) {
  const group = new THREE.Group();
  const mat = makeStandardMat(TEAM_COLOR[team], 0.6);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(24, 0), mat);
  crystal.position.y = 24;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(28, 30, 4, 8), new THREE.MeshStandardMaterial({ color: 0x20222b }));
  ring.position.y = 2;
  group.add(ring, crystal);
  group.userData.totalHeight = 48;
  return group;
}

function createHpBar() {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 3),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthTest: false })
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 3),
    new THREE.MeshBasicMaterial({ color: 0x4f8cff, depthTest: false })
  );
  fill.position.z = 0.1;
  bg.renderOrder = 10; fill.renderOrder = 11;
  group.add(bg, fill);
  group.userData.fill = fill;
  return group;
}

function createDamageSprite(text, color) {
  const cnv = document.createElement('canvas');
  cnv.width = 128; cnv.height = 64;
  const c = cnv.getContext('2d');
  c.font = '700 34px Rajdhani, sans-serif';
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(cnv);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(24, 12, 1);
  sprite.renderOrder = 20;
  return sprite;
}

// ---------------------- Sync entities -> meshes ----------------------
function syncEntity(e) {
  if (e.alive && !e.mesh3d) {
    let root;
    if (e.type === 'hero') root = createHumanoid(e.team, false);
    else if (e.type === 'minion') root = createHumanoid(e.team, true);
    else if (e.type === 'tower') root = createTower(e.team);
    else if (e.type === 'nexus') root = createNexus(e.team);
    dynamicGroup.add(root);

    let hpBar = null;
    if (e.type !== 'nexus') {
      hpBar = createHpBar();
      dynamicGroup.add(hpBar);
    }
    let shieldMesh = null;
    if (e.type === 'hero') {
      shieldMesh = new THREE.Mesh(
        new THREE.SphereGeometry(18, 12, 10),
        new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.22, wireframe: true })
      );
      shieldMesh.visible = false;
      dynamicGroup.add(shieldMesh);
    }
    e.mesh3d = { root, hpBar, shieldMesh };
  }

  if (!e.mesh3d) return;

  if (!e.alive) {
    dynamicGroup.remove(e.mesh3d.root);
    if (e.mesh3d.hpBar) dynamicGroup.remove(e.mesh3d.hpBar);
    if (e.mesh3d.shieldMesh) dynamicGroup.remove(e.mesh3d.shieldMesh);
    e.mesh3d = null;
    return;
  }

  const { root, hpBar, shieldMesh } = e.mesh3d;
  root.position.set(worldX(e.x), 0, worldZ(e.z));
  if (e.type === 'hero' || e.type === 'minion') {
    root.rotation.y = facingToRotationY(e.facingAngle);
  }

  const topHeight = root.userData.totalHeight || 20;
  if (hpBar) {
    hpBar.position.set(worldX(e.x), topHeight + 6, worldZ(e.z));
    hpBar.quaternion.copy(camera.quaternion);
    const frac = Math.max(0, e.hp / e.maxHp);
    hpBar.userData.fill.scale.x = frac;
    hpBar.userData.fill.position.x = -10 * (1 - frac);
    hpBar.userData.fill.material.color.set(e.team === 'ally' ? 0x4f8cff : 0xff5c5c);
  }
  if (shieldMesh) {
    shieldMesh.visible = e.shield > 0;
    shieldMesh.position.set(worldX(e.x), topHeight * 0.55, worldZ(e.z));
  }
}

function facingToRotationY(angle) {
  // Model built facing local +Z. World forward dir = (cos(angle), sin(angle)) in (x,z).
  return Math.atan2(Math.cos(angle), Math.sin(angle));
}

// ---------------------- Sync projectiles ----------------------
function syncProjectile(p) {
  if (p.life > 0 && !p.mesh3d) {
    const mat = new THREE.MeshBasicMaterial({ color: p.team === 'ally' ? TEAM_COLOR.ally : TEAM_COLOR.enemy });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 8, 8), mat);
    dynamicGroup.add(mesh);
    p.mesh3d = mesh;
  }
  if (!p.mesh3d) return;
  if (p.life <= 0) {
    dynamicGroup.remove(p.mesh3d);
    p.mesh3d = null;
    return;
  }
  const progress = 1 - p.life / p.maxLife;
  const arcH = 18 * Math.sin(progress * Math.PI);
  p.mesh3d.position.set(worldX(p.x), 20 + arcH, worldZ(p.z));
}

// ---------------------- Sync particles (damage text + tracers) ----------------------
function syncParticle(p) {
  if (p.life > 0 && !p.mesh3d) {
    if (p.tracer) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(worldX(p.x1), 14, worldZ(p.z1)),
        new THREE.Vector3(worldX(p.x2), 14, worldZ(p.z2)),
      ]);
      const mat = new THREE.LineBasicMaterial({ color: p.color, transparent: true, opacity: 0.8 });
      const line = new THREE.Line(geo, mat);
      dynamicGroup.add(line);
      p.mesh3d = line;
    } else if (p.txt) {
      const sprite = createDamageSprite(p.txt, p.color);
      sprite.position.set(worldX(p.x), p.y || 20, worldZ(p.z));
      dynamicGroup.add(sprite);
      p.mesh3d = sprite;
    }
  }
  if (!p.mesh3d) return;
  if (p.life <= 0) {
    dynamicGroup.remove(p.mesh3d);
    if (p.mesh3d.material?.map) p.mesh3d.material.map.dispose();
    p.mesh3d = null;
    return;
  }
  if (p.txt) {
    p.mesh3d.position.y += 14 * (1 / 60);
    p.mesh3d.material.opacity = clampNum(p.life / p.maxLife, 0, 1);
  }
}

function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---------------------- Camera ----------------------
const CAM_OFFSET = new THREE.Vector3(-90, 260, 230);
function updateCamera() {
  if (!player) return;
  const px = worldX(player.x), pz = worldZ(player.z);
  const targetPos = new THREE.Vector3(px + CAM_OFFSET.x, CAM_OFFSET.y, pz + CAM_OFFSET.z);
  camera.position.lerp(targetPos, 0.08);
  camera.lookAt(px, 12, pz);
}

// ---------------------- Public API used by game.js ----------------------
window.render3D = function render3D() {
  if (!scene) initScene();
  for (const e of entities) syncEntity(e);
  for (const p of projectiles) syncProjectile(p);
  for (const p of particles) syncParticle(p);
  updateCamera();
  renderer.render(scene, camera);
};

window.reset3D = function reset3D() {
  if (!dynamicGroup) return;
  for (let i = dynamicGroup.children.length - 1; i >= 0; i--) {
    dynamicGroup.remove(dynamicGroup.children[i]);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  initScene();
});

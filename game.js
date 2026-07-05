// ===================== Arena of Valor: Lite — 3D logic core =====================
// Ground plane uses x (lane direction) and z (perpendicular depth). y = height off the ground.
// This file owns all game STATE. Rendering is handled separately in scene3d.js.

const WORLD_W = 960;   // x range: 0 (ally base) -> WORLD_W (enemy base)
const WORLD_D = 540;   // z range
const LANE_Z = WORLD_D / 2;

let keys = {};
let running = false;
let lastTime = 0;
let elapsed = 0;
let entities = [];
let projectiles = [];
let particles = []; // floating damage text only, in 3D-space coords
let spawnTimer = 0;
const SPAWN_INTERVAL = 8;
let player = null;
let enemyHero = null;

function dist2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function nearestTarget(unit, opts = {}) {
  const range = opts.range ?? Infinity;
  let best = null, bestD = Infinity;
  for (const e of entities) {
    if (!e.alive || e.team === unit.team) continue;
    if (e.type === 'nexus' && !opts.allowNexus) continue;
    const d = dist2D(unit, e);
    if (d < bestD && d <= range) { bestD = d; best = e; }
  }
  return best;
}

function isNexusTargetable(team) {
  const tower = entities.find(e => e.type === 'tower' && e.team === team);
  return !tower || !tower.alive;
}

function makeUnit(cfg) {
  return Object.assign({
    alive: true, hp: cfg.maxHp, mp: cfg.maxMp || 0,
    atkTimer: 0, facingAngle: cfg.team === 'ally' ? 0 : Math.PI,
    cooldowns: { Q: 0, E: 0, R: 0 },
    shield: 0, shieldTimer: 0,
    mesh3d: null,
  }, cfg);
}

function spawnMinion(team) {
  const startX = team === 'ally' ? 90 : WORLD_W - 90;
  entities.push(makeUnit({
    type: 'minion', team,
    x: startX, z: LANE_Z + (Math.random() * 40 - 20),
    maxHp: 60, atk: 8, defense: 1, range: 26, speed: 55, radius: 9,
  }));
}

function initEntities() {
  entities = [];
  projectiles = [];
  particles = [];

  entities.push(makeUnit({ type: 'nexus', team: 'ally', x: 34, z: LANE_Z, maxHp: 1000, atk: 0, defense: 0, range: 0, speed: 0, radius: 26 }));
  entities.push(makeUnit({ type: 'nexus', team: 'enemy', x: WORLD_W - 34, z: LANE_Z, maxHp: 1000, atk: 0, defense: 0, range: 0, speed: 0, radius: 26 }));

  entities.push(makeUnit({ type: 'tower', team: 'ally', x: 230, z: LANE_Z, maxHp: 500, atk: 26, defense: 4, range: 110, speed: 0, radius: 18 }));
  entities.push(makeUnit({ type: 'tower', team: 'enemy', x: WORLD_W - 230, z: LANE_Z, maxHp: 500, atk: 26, defense: 4, range: 110, speed: 0, radius: 18 }));

  player = makeUnit({
    type: 'hero', team: 'ally', x: 150, z: LANE_Z - 60,
    maxHp: 420, maxMp: 100, atk: 24, defense: 6, range: 55, speed: 150, radius: 13,
  });
  entities.push(player);

  enemyHero = makeUnit({
    type: 'hero', team: 'enemy', x: WORLD_W - 150, z: LANE_Z + 60,
    maxHp: 380, maxMp: 100, atk: 22, defense: 5, range: 55, speed: 130, radius: 13,
  });
  entities.push(enemyHero);

  spawnTimer = 2;
  elapsed = 0;
}

// ---------------------- Combat ----------------------
function applyDamage(target, amount, sourceTeam) {
  if (!target.alive) return;
  let dmg = Math.max(1, amount - (target.defense || 0));
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dmg -= absorbed;
  }
  target.hp -= dmg;
  particles.push({
    x: target.x, z: target.z, y: (target.radius || 12) * 2.6,
    txt: `-${Math.round(dmg)}`, life: 0.7, maxLife: 0.7,
    color: sourceTeam === 'ally' ? '#ff5c5c' : '#4f8cff',
  });
  if (target.hp <= 0) { target.hp = 0; target.alive = false; }
}

function tryBasicAttack(unit, target) {
  if (unit.atkTimer > 0) return false;
  const atkSpeed = unit.type === 'tower' ? 1.1 : 0.8;
  if (dist2D(unit, target) <= unit.range) {
    applyDamage(target, unit.atk, unit.team);
    unit.atkTimer = atkSpeed;
    particles.push({ tracer: true, x1: unit.x, z1: unit.z, x2: target.x, z2: target.z, life: 0.12, maxLife: 0.12, color: unit.team === 'ally' ? '#4f8cff' : '#ff5c5c' });
    return true;
  }
  return false;
}

// ---------------------- Skills ----------------------
const SKILL_COST = { Q: 20, E: 30, R: 25 };
const SKILL_CD = { Q: 6, E: 5, R: 10 };

function useSkillFor(unit, key, oppositeNearest) {
  if (!unit.alive || unit.cooldowns[key] > 0 || unit.mp < SKILL_COST[key]) return;

  if (key === 'Q') {
    const dx = Math.cos(unit.facingAngle) * 120;
    const dz = Math.sin(unit.facingAngle) * 120;
    unit.x = clamp(unit.x + dx, 20, WORLD_W - 20);
    unit.z = clamp(unit.z + dz, 20, WORLD_D - 20);
  } else if (key === 'E') {
    const target = oppositeNearest;
    const angle = target ? Math.atan2(target.z - unit.z, target.x - unit.x) : unit.facingAngle;
    projectiles.push({
      x: unit.x, z: unit.z, angle, speed: 340, dmg: unit === player ? 55 : 48,
      team: unit.team, life: 1.2, maxLife: 1.2, radius: 6,
    });
  } else if (key === 'R') {
    unit.shield += unit === player ? 60 : 50;
    unit.shieldTimer = 3;
    unit.hp = Math.min(unit.maxHp, unit.hp + (unit === player ? 40 : 35));
  }
  unit.mp -= SKILL_COST[key];
  unit.cooldowns[key] = SKILL_CD[key];
}

// ---------------------- Update loop pieces ----------------------
function updatePlayer(dt) {
  if (!player.alive) return;
  let dx = 0, dz = 0;
  if (keys['w']) dz -= 1;
  if (keys['s']) dz += 1;
  if (keys['a']) dx -= 1;
  if (keys['d']) dx += 1;
  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;
    player.facingAngle = Math.atan2(dz, dx);
    player.x = clamp(player.x + dx * player.speed * dt, 15, WORLD_W - 15);
    player.z = clamp(player.z + dz * player.speed * dt, 15, WORLD_D - 15);
  }

  if (keys[' ']) {
    const target = nearestTarget(player, { range: player.range });
    if (target) tryBasicAttack(player, target);
  }
  if (keys['q']) { useSkillFor(player, 'Q'); keys['q'] = false; }
  if (keys['e']) { useSkillFor(player, 'E', nearestTarget(player, { range: 260 })); keys['e'] = false; }
  if (keys['r']) { useSkillFor(player, 'R'); keys['r'] = false; }

  player.mp = Math.min(player.maxMp, player.mp + 5 * dt);
}

function moveToward(unit, target, dt, speedMul = 1) {
  const d = dist2D(unit, target);
  if (d < 4) return;
  const angle = Math.atan2(target.z - unit.z, target.x - unit.x);
  unit.facingAngle = angle;
  unit.x = clamp(unit.x + Math.cos(angle) * unit.speed * speedMul * dt, 15, WORLD_W - 15);
  unit.z = clamp(unit.z + Math.sin(angle) * unit.speed * speedMul * dt, 15, WORLD_D - 15);
}

function updateEnemyHeroAI(dt) {
  if (!enemyHero.alive) return;
  if (enemyHero.hp < enemyHero.maxHp * 0.22) {
    const nexus = entities.find(e => e.type === 'nexus' && e.team === 'enemy');
    moveToward(enemyHero, nexus, dt);
    enemyHero.mp = Math.min(enemyHero.maxMp, enemyHero.mp + 6 * dt);
    return;
  }
  const target = nearestTarget(enemyHero, { range: 320 });
  if (target) {
    enemyHero.facingAngle = Math.atan2(target.z - enemyHero.z, target.x - enemyHero.x);
    if (dist2D(enemyHero, target) > enemyHero.range * 0.85) {
      moveToward(enemyHero, target, dt);
    } else {
      tryBasicAttack(enemyHero, target);
    }
    if (Math.random() < 0.02) useSkillFor(enemyHero, 'E', target);
    if (Math.random() < 0.01 && dist2D(enemyHero, target) > enemyHero.range) useSkillFor(enemyHero, 'Q');
    if (Math.random() < 0.008 && enemyHero.hp < enemyHero.maxHp * 0.6) useSkillFor(enemyHero, 'R');
  } else {
    const advanceTarget = { x: WORLD_W * 0.3, z: LANE_Z };
    moveToward(enemyHero, advanceTarget, dt, 0.6);
  }
  enemyHero.mp = Math.min(enemyHero.maxMp, enemyHero.mp + 5 * dt);
}

function updateMinion(m, dt) {
  const target = nearestTarget(m, { range: 200 });
  if (target && dist2D(m, target) <= 160) {
    if (dist2D(m, target) > m.range) moveToward(m, target, dt);
    else tryBasicAttack(m, target);
  } else {
    const goalX = m.team === 'ally' ? WORLD_W - 60 : 60;
    moveToward(m, { x: goalX, z: LANE_Z }, dt);
  }
}

function updateTower(t) {
  const target = nearestTarget(t, { range: t.range });
  if (target) tryBasicAttack(t, target);
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    if (p.life <= 0) continue;
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.z += Math.sin(p.angle) * p.speed * dt;
    p.life -= dt;
    for (const e of entities) {
      if (!e.alive || e.team === p.team) continue;
      if (e.type === 'nexus' && !isNexusTargetable(e.team)) continue;
      if (dist2D(p, e) <= e.radius + p.radius) {
        applyDamage(e, p.dmg, p.team);
        p.life = 0;
        break;
      }
    }
    if (p.x < -20 || p.x > WORLD_W + 20 || p.z < -20 || p.z > WORLD_D + 20) p.life = 0;
  }
}

function tickCooldowns(unit, dt) {
  for (const k in unit.cooldowns) unit.cooldowns[k] = Math.max(0, unit.cooldowns[k] - dt);
  if (unit.shieldTimer > 0) {
    unit.shieldTimer -= dt;
    if (unit.shieldTimer <= 0) unit.shield = 0;
  }
  if (unit.atkTimer > 0) unit.atkTimer -= dt;
}

function update(dt) {
  elapsed += dt;
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    for (let i = 0; i < 3; i++) { spawnMinion('ally'); spawnMinion('enemy'); }
    spawnTimer = SPAWN_INTERVAL;
  }

  updatePlayer(dt);
  updateEnemyHeroAI(dt);

  for (const e of entities) {
    if (!e.alive) continue;
    tickCooldowns(e, dt);
    if (e.type === 'minion') updateMinion(e, dt);
    else if (e.type === 'tower') updateTower(e);
  }

  updateProjectiles(dt);
  for (const p of particles) p.life -= dt;

  checkWinLose();
}

// Called once per frame AFTER rendering has had a chance to clean up meshes
// for anything that just died / expired.
function cleanupArrays() {
  projectiles = projectiles.filter(p => p.life > 0);
  particles = particles.filter(p => p.life > 0);
  entities = entities.filter(e => e.alive || e.type === 'hero');
}

function checkWinLose() {
  const allyNexus = entities.find(e => e.type === 'nexus' && e.team === 'ally');
  const enemyNexus = entities.find(e => e.type === 'nexus' && e.team === 'enemy');
  if (allyNexus && !allyNexus.alive) endGame(false);
  if (enemyNexus && !enemyNexus.alive) endGame(true);
}

// ---------------------- HUD ----------------------
function updateHUD() {
  const hpPct = clamp(player.hp / player.maxHp, 0, 1) * 100;
  const mpPct = clamp(player.mp / player.maxMp, 0, 1) * 100;
  document.getElementById('hpFill').style.width = hpPct + '%';
  document.getElementById('mpFill').style.width = mpPct + '%';
  document.getElementById('hpText').textContent = `${Math.round(player.hp)}/${player.maxHp}`;
  document.getElementById('mpText').textContent = `${Math.round(player.mp)}/${player.maxMp}`;

  ['Q', 'E', 'R'].forEach(k => {
    const el = document.getElementById('skill' + k);
    const frac = player.cooldowns[k] / SKILL_CD[k];
    el.querySelector('.cd-overlay').style.height = clamp(frac, 0, 1) * 100 + '%';
    el.classList.toggle('ready', player.cooldowns[k] <= 0);
  });

  const allyTowers = entities.filter(e => e.type === 'tower' && e.team === 'ally' && e.alive).length +
    (entities.find(e => e.type === 'nexus' && e.team === 'ally')?.alive ? 1 : 0);
  const enemyTowers = entities.filter(e => e.type === 'tower' && e.team === 'enemy' && e.alive).length +
    (entities.find(e => e.type === 'nexus' && e.team === 'enemy')?.alive ? 1 : 0);
  document.getElementById('allyTowers').textContent = allyTowers;
  document.getElementById('enemyTowers').textContent = enemyTowers;

  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
  document.getElementById('timer').textContent = `${m}:${s}`;

  drawMinimap();
}

function drawMinimap() {
  const canvas = document.getElementById('minimap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const mw = canvas.width, mh = canvas.height;
  ctx.clearRect(0, 0, mw, mh);
  ctx.fillStyle = 'rgba(10,11,16,.7)';
  ctx.fillRect(0, 0, mw, mh);
  ctx.strokeStyle = 'rgba(242,193,78,.25)';
  ctx.strokeRect(0.5, 0.5, mw - 1, mh - 1);

  const sx = mw / WORLD_W, sz = mh / WORLD_D;
  for (const e of entities) {
    if (!e.alive) continue;
    const x = e.x * sx, y = e.z * sz;
    ctx.fillStyle = e.team === 'ally' ? '#4f8cff' : '#ff5c5c';
    let r = 2;
    if (e.type === 'hero') r = 4;
    if (e.type === 'tower') r = 3;
    if (e.type === 'nexus') r = 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (e === player) {
      ctx.strokeStyle = '#f2c14e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ---------------------- Game flow ----------------------
function loop(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0);
  lastTime = ts;
  update(dt);
  if (window.render3D) window.render3D(dt);
  cleanupArrays();
  updateHUD();
  requestAnimationFrame(loop);
}

function startGame() {
  initEntities();
  if (window.reset3D) window.reset3D();
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('endScreen').classList.add('hidden');
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function endGame(win) {
  running = false;
  document.getElementById('endTitle').textContent = win ? 'CHIẾN THẮNG' : 'THẤT BẠI';
  document.getElementById('endSub').textContent = win
    ? 'Bạn đã phá hủy Nexus của địch.'
    : 'Nexus của bạn đã bị phá hủy.';
  document.getElementById('endScreen').classList.remove('hidden');
}

window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

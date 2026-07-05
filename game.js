// ===================== Arena of Valor: Lite =====================
// Minimalist 1v1 lane-pusher. Single hero, minions, towers, nexus.

const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const LANE_Y = H / 2;

const COLORS = {
  ally: '#4f8cff', allyDim: '#2a4a8c',
  enemy: '#ff5c5c', enemyDim: '#8c2f2f',
  gold: '#f2c14e', text: '#e7e9ee', muted: '#3a3d47', lane: '#161922'
};

let keys = {};
let running = false;
let lastTime = 0;
let elapsed = 0;
let entities = [];
let projectiles = [];
let particles = [];
let spawnTimer = 0;
const SPAWN_INTERVAL = 8; // seconds between minion waves
let player = null;
let enemyHero = null;

// ---------------------- Utility ----------------------
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function nearestTarget(unit, opts = {}) {
  const range = opts.range ?? Infinity;
  let best = null, bestD = Infinity;
  for (const e of entities) {
    if (!e.alive || e.team === unit.team) continue;
    if (e.type === 'nexus' && !opts.allowNexus) continue;
    const d = dist(unit, e);
    if (d < bestD && d <= range) { bestD = d; best = e; }
  }
  return best;
}

function isNexusTargetable(team) {
  // Nexus of `team` can only be hit once that team's tower is destroyed
  const tower = entities.find(e => e.type === 'tower' && e.team === team);
  return !tower || !tower.alive;
}

// ---------------------- Entity factory ----------------------
function makeUnit(cfg) {
  return Object.assign({
    alive: true, hp: cfg.maxHp, mp: cfg.maxMp || 0,
    atkTimer: 0, facing: cfg.team === 'ally' ? 1 : -1,
    cooldowns: { Q: 0, E: 0, R: 0 },
    shield: 0, shieldTimer: 0,
  }, cfg);
}

function spawnMinion(team) {
  const dir = team === 'ally' ? 1 : -1;
  const startX = team === 'ally' ? 90 : W - 90;
  entities.push(makeUnit({
    type: 'minion', team,
    x: startX, y: LANE_Y + (Math.random() * 40 - 20),
    maxHp: 60, atk: 8, defense: 1, range: 26, speed: 55, radius: 9,
  }));
}

function initEntities() {
  entities = [];
  projectiles = [];
  particles = [];

  entities.push(makeUnit({ type: 'nexus', team: 'ally', x: 34, y: LANE_Y, maxHp: 1000, atk: 0, defense: 0, range: 0, speed: 0, radius: 26 }));
  entities.push(makeUnit({ type: 'nexus', team: 'enemy', x: W - 34, y: LANE_Y, maxHp: 1000, atk: 0, defense: 0, range: 0, speed: 0, radius: 26 }));

  entities.push(makeUnit({ type: 'tower', team: 'ally', x: 230, y: LANE_Y, maxHp: 500, atk: 26, defense: 4, range: 110, speed: 0, radius: 18 }));
  entities.push(makeUnit({ type: 'tower', team: 'enemy', x: W - 230, y: LANE_Y, maxHp: 500, atk: 26, defense: 4, range: 110, speed: 0, radius: 18 }));

  player = makeUnit({
    type: 'hero', team: 'ally', x: 150, y: LANE_Y - 60,
    maxHp: 420, maxMp: 100, atk: 24, defense: 6, range: 55, speed: 150, radius: 13,
  });
  entities.push(player);

  enemyHero = makeUnit({
    type: 'hero', team: 'enemy', x: W - 150, y: LANE_Y + 60,
    maxHp: 380, maxMp: 100, atk: 22, defense: 5, range: 55, speed: 130, radius: 13,
  });
  entities.push(enemyHero);

  spawnTimer = 2; // first wave arrives quickly
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
  particles.push({ x: target.x, y: target.y - target.radius - 6, txt: `-${Math.round(dmg)}`, life: 0.6, color: sourceTeam === 'ally' ? COLORS.enemy : COLORS.ally });
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
  }
}

function tryBasicAttack(unit, target, dt) {
  if (unit.atkTimer > 0) return;
  const atkSpeed = unit.type === 'tower' ? 1.1 : 0.8; // seconds between attacks
  if (dist(unit, target) <= unit.range) {
    applyDamage(target, unit.atk, unit.team);
    unit.atkTimer = atkSpeed;
    particles.push({ line: { x1: unit.x, y1: unit.y, x2: target.x, y2: target.y }, life: 0.12, color: unit.team === 'ally' ? COLORS.ally : COLORS.enemy });
    return true;
  }
  return false;
}

// ---------------------- Skills (player) ----------------------
function useSkill(key) {
  if (!player.alive) return;
  if (player.cooldowns[key] > 0) return;
  const costs = { Q: 20, E: 30, R: 25 };
  const cds = { Q: 6, E: 5, R: 10 };
  if (player.mp < costs[key]) return;

  if (key === 'Q') { // Dash
    const dx = Math.cos(player.moveAngle ?? 0) * 120;
    const dy = Math.sin(player.moveAngle ?? 0) * 120;
    player.x = clamp(player.x + dx, 20, W - 20);
    player.y = clamp(player.y + dy, 20, H - 20);
  } else if (key === 'E') { // Fireball
    const target = nearestTarget(player, { range: 260 });
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : (player.moveAngle ?? 0);
    projectiles.push({
      x: player.x, y: player.y, angle, speed: 340, dmg: 55, team: 'ally', life: 1.2, radius: 6,
    });
  } else if (key === 'R') { // Shield + heal
    player.shield += 60;
    player.shieldTimer = 3;
    player.hp = Math.min(player.maxHp, player.hp + 40);
  }

  player.mp -= costs[key];
  player.cooldowns[key] = cds[key];
}

function useEnemySkill(key) {
  if (!enemyHero.alive || enemyHero.cooldowns[key] > 0) return;
  const costs = { Q: 20, E: 30, R: 25 };
  const cds = { Q: 6, E: 5, R: 10 };
  if (enemyHero.mp < costs[key]) return;

  if (key === 'Q') {
    const dx = Math.cos(enemyHero.moveAngle ?? Math.PI) * 120;
    const dy = Math.sin(enemyHero.moveAngle ?? Math.PI) * 120;
    enemyHero.x = clamp(enemyHero.x + dx, 20, W - 20);
    enemyHero.y = clamp(enemyHero.y + dy, 20, H - 20);
  } else if (key === 'E') {
    const target = nearestTarget(enemyHero, { range: 260 });
    const angle = target ? Math.atan2(target.y - enemyHero.y, target.x - enemyHero.x) : Math.PI;
    projectiles.push({ x: enemyHero.x, y: enemyHero.y, angle, speed: 320, dmg: 48, team: 'enemy', life: 1.2, radius: 6 });
  } else if (key === 'R') {
    enemyHero.shield += 50;
    enemyHero.shieldTimer = 3;
    enemyHero.hp = Math.min(enemyHero.maxHp, enemyHero.hp + 35);
  }
  enemyHero.mp -= costs[key];
  enemyHero.cooldowns[key] = cds[key];
}

// ---------------------- Update loop ----------------------
function updatePlayer(dt) {
  if (!player.alive) return;
  let dx = 0, dy = 0;
  if (keys['w']) dy -= 1;
  if (keys['s']) dy += 1;
  if (keys['a']) dx -= 1;
  if (keys['d']) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    player.moveAngle = Math.atan2(dy, dx);
    player.x = clamp(player.x + dx * player.speed * dt, 15, W - 15);
    player.y = clamp(player.y + dy * player.speed * dt, 15, H - 15);
  }

  if (keys[' ']) {
    const target = nearestTarget(player, { range: player.range });
    if (target) tryBasicAttack(player, target, dt);
  }
  if (keys['q']) { useSkill('Q'); keys['q'] = false; }
  if (keys['e']) { useSkill('E'); keys['e'] = false; }
  if (keys['r']) { useSkill('R'); keys['r'] = false; }

  player.mp = Math.min(player.maxMp, player.mp + 5 * dt);
}

function updateEnemyHeroAI(dt) {
  if (!enemyHero.alive) return;
  if (enemyHero.hp < enemyHero.maxHp * 0.22) {
    // retreat toward own nexus
    const nexus = entities.find(e => e.type === 'nexus' && e.team === 'enemy');
    moveToward(enemyHero, nexus, dt);
    enemyHero.mp = Math.min(enemyHero.maxMp, enemyHero.mp + 6 * dt);
    return;
  }
  const target = nearestTarget(enemyHero, { range: 320 });
  if (target) {
    enemyHero.moveAngle = Math.atan2(target.y - enemyHero.y, target.x - enemyHero.x);
    if (dist(enemyHero, target) > enemyHero.range * 0.85) {
      moveToward(enemyHero, target, dt);
    } else {
      tryBasicAttack(enemyHero, target, dt);
    }
    if (Math.random() < 0.02) useEnemySkill('E');
    if (Math.random() < 0.01 && dist(enemyHero, target) > enemyHero.range) useEnemySkill('Q');
    if (Math.random() < 0.008 && enemyHero.hp < enemyHero.maxHp * 0.6) useEnemySkill('R');
  } else {
    // advance along the lane
    const advanceTarget = { x: W * 0.3, y: LANE_Y };
    enemyHero.moveAngle = Math.atan2(advanceTarget.y - enemyHero.y, advanceTarget.x - enemyHero.x);
    moveToward(enemyHero, advanceTarget, dt, 0.6);
  }
  enemyHero.mp = Math.min(enemyHero.maxMp, enemyHero.mp + 5 * dt);
}

function moveToward(unit, target, dt, speedMul = 1) {
  const d = dist(unit, target);
  if (d < 4) return;
  const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
  unit.x = clamp(unit.x + Math.cos(angle) * unit.speed * speedMul * dt, 15, W - 15);
  unit.y = clamp(unit.y + Math.sin(angle) * unit.speed * speedMul * dt, 15, H - 15);
}

function updateMinion(m, dt) {
  const target = nearestTarget(m, { range: 200 });
  if (target && dist(m, target) <= 160) {
    if (dist(m, target) > m.range) {
      moveToward(m, target, dt);
    } else {
      tryBasicAttack(m, target, dt);
    }
  } else {
    const goalX = m.team === 'ally' ? W - 60 : 60;
    moveToward(m, { x: goalX, y: LANE_Y }, dt);
  }
}

function updateTower(t, dt) {
  const target = nearestTarget(t, { range: t.range });
  if (target) tryBasicAttack(t, target, dt);
}

function updateProjectiles(dt) {
  for (const p of projectiles) {
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    p.life -= dt;
    for (const e of entities) {
      if (!e.alive || e.team === p.team) continue;
      if (e.type === 'nexus' && !isNexusTargetable(e.team)) continue;
      if (dist(p, e) <= e.radius + p.radius) {
        applyDamage(e, p.dmg, p.team);
        p.life = 0;
        break;
      }
    }
  }
  projectiles = projectiles.filter(p => p.life > 0 && p.x > -20 && p.x < W + 20);
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
    for (let i = 0; i < 3; i++) {
      spawnMinion('ally');
      spawnMinion('enemy');
    }
    spawnTimer = SPAWN_INTERVAL;
  }

  updatePlayer(dt);
  updateEnemyHeroAI(dt);

  for (const e of entities) {
    if (!e.alive) continue;
    tickCooldowns(e, dt);
    if (e.type === 'minion') updateMinion(e, dt);
    else if (e.type === 'tower') updateTower(e, dt);
  }

  updateProjectiles(dt);

  for (const p of particles) p.life -= dt;
  particles = particles.filter(p => p.life > 0);

  entities = entities.filter(e => e.alive || e.type === 'hero'); // keep dead heroes for respawn-less end state check

  checkWinLose();
}

function checkWinLose() {
  const allyNexus = entities.find(e => e.type === 'nexus' && e.team === 'ally');
  const enemyNexus = entities.find(e => e.type === 'nexus' && e.team === 'enemy');
  if (allyNexus && !allyNexus.alive) endGame(false);
  if (enemyNexus && !enemyNexus.alive) endGame(true);
}

// ---------------------- Rendering ----------------------
function drawUnit(u) {
  if (!u.alive) return;
  const color = u.team === 'ally' ? COLORS.ally : COLORS.enemy;

  ctx.save();
  if (u.type === 'nexus') {
    const targetable = isNexusTargetable(u.team);
    ctx.strokeStyle = targetable ? color : COLORS.muted;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(u.x - u.radius, u.y - u.radius, u.radius * 2, u.radius * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = color;
    ctx.fill();
  } else if (u.type === 'tower') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y - u.radius);
    ctx.lineTo(u.x + u.radius, u.y + u.radius);
    ctx.lineTo(u.x - u.radius, u.y + u.radius);
    ctx.closePath();
    ctx.fill();
  } else if (u.type === 'minion') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (u.type === 'hero') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (u.shield > 0) {
      ctx.strokeStyle = COLORS.gold;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  // HP bar
  if (u.type !== 'nexus') {
    const w = u.radius * 2.4;
    const h = 4;
    const x = u.x - w / 2, y = u.y - u.radius - 10;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * (u.hp / u.maxHp), h);
  }
}

function drawLane() {
  ctx.fillStyle = COLORS.lane;
  ctx.fillRect(0, LANE_Y - 46, W, 92);
  ctx.strokeStyle = 'rgba(242,193,78,0.15)';
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, LANE_Y);
  ctx.lineTo(W, LANE_Y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawProjectiles() {
  for (const p of projectiles) {
    ctx.fillStyle = p.team === 'ally' ? COLORS.ally : COLORS.enemy;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
    if (p.line) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.line.x1, p.line.y1);
      ctx.lineTo(p.line.x2, p.line.y2);
      ctx.stroke();
    } else if (p.txt) {
      ctx.fillStyle = p.color;
      ctx.font = '600 12px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.txt, p.x, p.y);
      p.y -= 14 * (1 / 60);
    }
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawLane();
  for (const e of entities) drawUnit(e);
  drawProjectiles();
  drawParticles();
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
    const cds = { Q: 6, E: 5, R: 10 };
    const frac = player.cooldowns[k] / cds[k];
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
}

// ---------------------- Game flow ----------------------
function loop(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0);
  lastTime = ts;
  update(dt);
  render();
  updateHUD();
  requestAnimationFrame(loop);
}

function startGame() {
  initEntities();
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

// ---------------------- Input ----------------------
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

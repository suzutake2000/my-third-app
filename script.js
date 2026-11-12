const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const livesElement = document.querySelector("#lives");
const statusElement = document.querySelector("#status");
const overlay = document.querySelector("#overlay");
const overlayEyebrow = document.querySelector("#overlay-eyebrow");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const startButton = document.querySelector("#start-button");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const keys = new Set();
const stars = Array.from({ length: 95 }, () => ({
  x: Math.random() * WIDTH,
  y: Math.random() * HEIGHT,
  size: Math.random() * 1.8 + 0.4,
  speed: Math.random() * 28 + 12,
  alpha: Math.random() * 0.65 + 0.2,
}));

let player;
let bullets;
let enemies;
let particles;
let score;
let lives;
let spawnTimer;
let shotTimer;
let lastTime = 0;
let state = "ready";

function resetGame() {
  player = { x: 110, y: HEIGHT / 2, width: 42, height: 32, speed: 300, invulnerable: 0 };
  bullets = [];
  enemies = [];
  particles = [];
  score = 0;
  lives = 3;
  spawnTimer = 0.7;
  shotTimer = 0;
  updateHud();
}

function updateHud() {
  scoreElement.textContent = String(score).padStart(5, "0");
  livesElement.textContent = `${"♥ ".repeat(lives).trim()}${lives ? "" : "—"}`;
  livesElement.setAttribute("aria-label", `残りライフ ${lives}`);
}

function startGame() {
  if (state === "running") return;
  resetGame();
  state = "running";
  statusElement.textContent = "IN FLIGHT";
  overlay.classList.add("is-hidden");
}

function endGame() {
  state = "over";
  statusElement.textContent = "MISSION OVER";
  overlayEyebrow.textContent = "MISSION COMPLETE";
  overlayTitle.textContent = "ゲームオーバー";
  overlayCopy.textContent = `スコア ${String(score).padStart(5, "0")} — もう一度プレイして、記録を更新しよう。`;
  startButton.innerHTML = 'もう一度プレイ <span aria-hidden="true">→</span>';
  overlay.classList.remove("is-hidden");
}

function createExplosion(x, y, color, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 130 + 35;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: Math.random() * 0.35 + 0.25,
      maxLife: 0.6,
      size: Math.random() * 3 + 1,
      color,
    });
  }
}

function spawnEnemy() {
  const size = Math.random() * 12 + 24;
  enemies.push({
    x: WIDTH + size,
    y: Math.random() * (HEIGHT - size * 2) + size,
    radius: size / 2,
    speed: Math.random() * 65 + 95 + Math.min(score / 20, 90),
    phase: Math.random() * Math.PI * 2,
    wobble: Math.random() * 18 + 8,
  });
}

function overlapsCircleRect(circle, rect) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function update(delta) {
  for (const star of stars) {
    star.x -= star.speed * delta;
    if (star.x < 0) {
      star.x = WIDTH;
      star.y = Math.random() * HEIGHT;
    }
  }

  if (state !== "running") return;

  player.invulnerable = Math.max(0, player.invulnerable - delta);
  let dx = 0;
  let dy = 0;
  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;
  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;

  const length = Math.hypot(dx, dy) || 1;
  player.x += (dx / length) * player.speed * delta;
  player.y += (dy / length) * player.speed * delta;
  player.x = Math.max(30, Math.min(WIDTH - 35, player.x));
  player.y = Math.max(25, Math.min(HEIGHT - 25, player.y));

  shotTimer -= delta;
  if ((keys.has(" ") || keys.has("space")) && shotTimer <= 0) {
    bullets.push({ x: player.x + 23, y: player.y, speed: 540 });
    shotTimer = 0.2;
  }

  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = Math.max(0.42, 1.15 - score / 800) * (0.75 + Math.random() * 0.5);
  }

  for (const bullet of bullets) bullet.x += bullet.speed * delta;
  bullets = bullets.filter((bullet) => bullet.x < WIDTH + 12);

  for (const enemy of enemies) {
    enemy.x -= enemy.speed * delta;
    enemy.phase += delta * 3;
    enemy.y += Math.sin(enemy.phase) * enemy.wobble * delta;
    if (enemy.x + enemy.radius < 0) {
      enemy.escaped = true;
    }
  }
  enemies = enemies.filter((enemy) => !enemy.escaped);

  for (const bullet of bullets) {
    if (bullet.hit) continue;
    for (const enemy of enemies) {
      if (enemy.destroyed) continue;
      const dxToEnemy = bullet.x - enemy.x;
      const dyToEnemy = bullet.y - enemy.y;
      if (dxToEnemy * dxToEnemy + dyToEnemy * dyToEnemy < enemy.radius * enemy.radius) {
        bullet.hit = true;
        enemy.destroyed = true;
        score += 100;
        updateHud();
        createExplosion(enemy.x, enemy.y, "#ff6d9a", 16);
        break;
      }
    }
  }
  bullets = bullets.filter((bullet) => !bullet.hit);
  enemies = enemies.filter((enemy) => !enemy.destroyed);

  const playerRect = {
    x: player.x - player.width / 2,
    y: player.y - player.height / 2,
    width: player.width,
    height: player.height,
  };
  for (const enemy of enemies) {
    if (overlapsCircleRect(enemy, playerRect) && player.invulnerable <= 0) {
      enemy.destroyed = true;
      lives -= 1;
      player.invulnerable = 1.1;
      updateHud();
      createExplosion(enemy.x, enemy.y, "#ff6d9a", 18);
      if (lives <= 0) endGame();
      break;
    }
  }
  enemies = enemies.filter((enemy) => !enemy.destroyed);

  for (const particle of particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
  }
  particles = particles.filter((particle) => particle.life > 0);
}

function drawBackground() {
  ctx.fillStyle = "#080d22";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH * 0.48, HEIGHT * 0.5, 10, WIDTH * 0.48, HEIGHT * 0.5, WIDTH * 0.7);
  glow.addColorStop(0, "rgba(45, 54, 117, 0.19)");
  glow.addColorStop(1, "rgba(8, 13, 34, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#c9d6ff";
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  if (!player || (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0)) return;
  ctx.save();
  ctx.translate(player.x, player.y);

  const engineGlow = ctx.createLinearGradient(-17, 0, -48, 0);
  engineGlow.addColorStop(0, "rgba(115, 245, 223, 0.9)");
  engineGlow.addColorStop(1, "rgba(115, 245, 223, 0)");
  ctx.fillStyle = engineGlow;
  ctx.beginPath();
  ctx.moveTo(-14, -5);
  ctx.lineTo(-47 - Math.random() * 9, 0);
  ctx.lineTo(-14, 5);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = "#58dff4";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#172b4b";
  ctx.strokeStyle = "#73f5df";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(25, 0);
  ctx.lineTo(5, -6);
  ctx.lineTo(-11, -18);
  ctx.lineTo(-23, -16);
  ctx.lineTo(-16, -4);
  ctx.lineTo(-21, 0);
  ctx.lineTo(-16, 4);
  ctx.lineTo(-23, 16);
  ctx.lineTo(-11, 18);
  ctx.lineTo(5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#73f5df";
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.lineTo(4, -7);
  ctx.lineTo(-15, -6);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-15, 6);
  ctx.lineTo(4, 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#d9ffff";
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(3, -2.5);
  ctx.lineTo(-8, 0);
  ctx.lineTo(3, 2.5);
  ctx.closePath();
  ctx.fill();

  const cockpit = ctx.createLinearGradient(3, -5, 13, 5);
  cockpit.addColorStop(0, "#e5ffff");
  cockpit.addColorStop(0.35, "#69eaff");
  cockpit.addColorStop(1, "#2872b7");
  ctx.fillStyle = cockpit;
  ctx.beginPath();
  ctx.moveTo(12, -4);
  ctx.lineTo(20, 0);
  ctx.lineTo(12, 4);
  ctx.lineTo(4, 2.5);
  ctx.lineTo(4, -2.5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(186, 255, 249, 0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-13, -12);
  ctx.lineTo(-3, -7);
  ctx.moveTo(-13, 12);
  ctx.lineTo(-3, 7);
  ctx.moveTo(-14, 0);
  ctx.lineTo(-7, 0);
  ctx.stroke();

  ctx.fillStyle = "#ffb15e";
  ctx.shadowColor = "#ffb15e";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(-15, -10, 1.8, 0, Math.PI * 2);
  ctx.arc(-15, 10, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(Math.sin(enemy.phase) * 0.15);
  ctx.shadowColor = "#ff4f91";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#ff5b93";
  ctx.beginPath();
  ctx.moveTo(-enemy.radius, -enemy.radius * 0.7);
  ctx.lineTo(-enemy.radius * 0.25, -enemy.radius * 0.45);
  ctx.lineTo(enemy.radius, -enemy.radius);
  ctx.lineTo(enemy.radius * 0.65, 0);
  ctx.lineTo(enemy.radius, enemy.radius);
  ctx.lineTo(-enemy.radius * 0.25, enemy.radius * 0.45);
  ctx.lineTo(-enemy.radius, enemy.radius * 0.7);
  ctx.lineTo(-enemy.radius * 0.65, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#451738";
  ctx.fillRect(-enemy.radius * 0.05, -3, enemy.radius * 0.48, 6);
  ctx.restore();
}

function draw() {
  drawBackground();

  for (const bullet of bullets || []) {
    ctx.save();
    ctx.shadowColor = "#73f5df";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#c2fff5";
    ctx.fillRect(bullet.x - 8, bullet.y - 2, 16, 4);
    ctx.restore();
  }

  for (const enemy of enemies || []) drawEnemy(enemy);
  for (const particle of particles || []) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
  drawPlayer();
}

function frame(timestamp) {
  const delta = Math.min((timestamp - lastTime) / 1000 || 0, 0.033);
  lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

const controlKeys = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " ", "space"]);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (controlKeys.has(key)) event.preventDefault();
  keys.add(key);
  if ((key === "enter" || key === " ") && state !== "running") startGame();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => keys.clear());
startButton.addEventListener("click", startGame);

resetGame();
requestAnimationFrame(frame);

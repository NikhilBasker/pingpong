const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');
const scoreLeft = document.getElementById('scoreLeft');
const scoreRight = document.getElementById('scoreRight');
const menu = document.getElementById('menu');
const gameUI = document.getElementById('gameUI');
const pauseBtn = document.getElementById('pauseBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const restartBtn = document.getElementById('restartBtn');
const restartBtn2 = document.getElementById('restartBtn2');
const endGame = document.getElementById('endGame');
const winnerMsg = document.getElementById('winnerMsg');
const bounceAudio = document.getElementById('bounceSound');
const scoreAudio = document.getElementById('scoreSound');
const roomInput = document.getElementById('roomInput');
const winScoreInput = document.getElementById('winScoreInput');
const difficultyInput = document.getElementById('difficultyInput');
const joinBtn = document.getElementById('joinBtn');
const mobileControls = document.getElementById('mobileControls');
const moveUpBtn = document.getElementById('moveUpBtn');
const moveDownBtn = document.getElementById('moveDownBtn');

// --- Room details UI ---
let roomDetailsEl = document.getElementById('roomDetails');
if (!roomDetailsEl) {
  roomDetailsEl = document.createElement('div');
  roomDetailsEl.id = 'roomDetails';
  roomDetailsEl.style.marginBottom = '10px';
  roomDetailsEl.style.fontSize = '1.1em';
  roomDetailsEl.style.fontWeight = 'bold';
  roomDetailsEl.style.color = '#00ff99';
  gameUI.insertBefore(roomDetailsEl, gameUI.firstChild);
  roomDetailsEl.style.display = 'none';
}

let playerType = null;
let paddles = { left: 200, right: 200 };
let ball = { x: 400, y: 250, size: 15 };
let scores = { left: 0, right: 0 };
let winScore = 10;
let paused = false;
let bigPaddle = { left: false, right: false };
let room = null;
let difficulty = "medium";
let currentPaddleY = 200;

// Responsive canvas sizing
function resizeCanvas() {
  let w = Math.min(window.innerWidth * 0.98, 800);
  let h = Math.min(window.innerHeight * 0.60, 500);
  if (window.innerWidth < 600) {
    w = window.innerWidth * 0.99;
    h = window.innerWidth * 0.52;
  } else if (window.innerWidth < 900) {
    w = window.innerWidth * 0.98;
    h = window.innerWidth * 0.60;
  }
  canvas.width = w;
  canvas.height = h;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Paddle and ball sizes based on difficulty
function getPaddleWidth() { return Math.max(canvas.width * 0.018, 10); }
function getPaddleHeight(big = false) {
  let base;
  if (difficulty === "easy") base = canvas.height * 0.25;
  else if (difficulty === "hard") base = canvas.height * 0.12;
  else base = canvas.height * 0.18;
  if (big) base *= 1.8;
  return Math.max(base, 40);
}
function getBallSize() {
  if (difficulty === "easy") return Math.max(canvas.width * 0.022, 12);
  if (difficulty === "hard") return Math.max(canvas.width * 0.015, 8);
  return Math.max(canvas.width * 0.018, 10);
}

// Room join
const socket = io();

function joinRoom() {
  room = roomInput.value.trim() || Math.random().toString(36).substr(2, 6);
  winScore = parseInt(winScoreInput.value) || 10;
  difficulty = difficultyInput.value || "medium";
  menu.style.display = "none";
  gameUI.style.display = "";
  socket.emit("joinRoom", { room, winScore, difficulty });
  info.textContent = "Waiting for another player...";

  // Show room details
  roomDetailsEl.innerHTML =
    `Room: <span style="color:#fff;background:#222;padding:2px 7px;border-radius:4px;">${room}</span> &nbsp;|&nbsp; Win Score: <span style="color:#fff;">${winScore}</span> &nbsp;|&nbsp; Difficulty: <span style="color:#fff;">${difficulty.charAt(0).toUpperCase()+difficulty.slice(1)}</span>`;
  roomDetailsEl.style.display = '';
}
joinBtn.onclick = joinRoom;

// Player type
socket.on('playerType', type => {
  playerType = type;
  if (type === 'left') info.textContent = "You are Player 1 (left paddle)";
  else if (type === 'right') info.textContent = "You are Player 2 (right paddle)";
  else info.textContent = "You are a spectator";
});

// Game state
socket.on('gameState', state => {
  let scaleX = canvas.width / 800;
  let scaleY = canvas.height / 500;
  ball = {
    x: state.ball.x * scaleX,
    y: state.ball.y * scaleY,
    size: getBallSize()
  };
  paddles = {
    left: state.paddles.left * scaleY,
    right: state.paddles.right * scaleY
  };
  scores = state.scores;
  winScore = state.winScore || winScore;
  difficulty = state.difficulty || "medium";
  scoreLeft.textContent = scores.left;
  scoreRight.textContent = scores.right;
  bigPaddle.left = !!state.bigPaddleLeft;
  bigPaddle.right = !!state.bigPaddleRight;
  currentPaddleY = paddles[playerType] || currentPaddleY;

  // Update room details if settings changed
  roomDetailsEl.innerHTML =
    `Room: <span style="color:#fff;background:#222;padding:2px 7px;border-radius:4px;">${room}</span> &nbsp;|&nbsp; Win Score: <span style="color:#fff;">${winScore}</span> &nbsp;|&nbsp; Difficulty: <span style="color:#fff;">${difficulty.charAt(0).toUpperCase()+difficulty.slice(1)}</span>`;
  roomDetailsEl.style.display = '';

  if (scores.left >= winScore || scores.right >= winScore) {
    endGame.style.display = "";
    winnerMsg.textContent =
      scores.left >= winScore
        ? "Player 1 Wins!"
        : "Player 2 Wins!";
    restartBtn.style.display = "none";
    restartBtn2.style.display = "";
  } else {
    endGame.style.display = "none";
    restartBtn.style.display = "";
    restartBtn2.style.display = "none";
  }
});

socket.on('visual', msg => {
  if (msg === 'bounce') {
    bounceAudio.currentTime = 0;
    bounceAudio.play();
    flashPaddle();
  }
  if (msg === 'score') {
    scoreAudio.currentTime = 0;
    scoreAudio.play();
    flashScreen();
    if ('vibrate' in window.navigator) window.navigator.vibrate(250);
  }
  if (msg === 'bigPaddle') {
    flashPaddle();
  }
});

function requestRestart() {
  socket.emit("restartGame", room);
}
restartBtn.onclick = requestRestart;
restartBtn2.onclick = requestRestart;

pauseBtn.onclick = () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  socket.emit("togglePause", { room, paused });
};
socket.on("pauseState", (isPaused) => {
  paused = isPaused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
});

fullscreenBtn.onclick = () => {
  if (canvas.requestFullscreen) canvas.requestFullscreen();
  else if (canvas.webkitRequestFullscreen) canvas.webkitRequestFullscreen();
};

canvas.addEventListener('mousemove', function(e) {
  if (playerType === 'spectator' || paused) return;
  const rect = canvas.getBoundingClientRect();
  let mouseY = e.clientY - rect.top;
  let paddleY = Math.max(0, Math.min(canvas.height - getPaddleHeight(bigPaddle[playerType]), mouseY - getPaddleHeight(bigPaddle[playerType])/2));
  let scaledY = paddleY * 500 / canvas.height;
  currentPaddleY = paddleY;
  socket.emit('paddleMove', { y: scaledY, room });
});

canvas.addEventListener('touchstart', handleTouch, { passive: false });
canvas.addEventListener('touchmove', handleTouch, { passive: false });

function handleTouch(e) {
  if (playerType === 'spectator' || paused) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    let paddleY = Math.max(0, Math.min(canvas.height - getPaddleHeight(bigPaddle[playerType]), y - getPaddleHeight(bigPaddle[playerType])/2));
    let scaledY = paddleY * 500 / canvas.height;
    currentPaddleY = paddleY;
    if ((playerType === 'left' && x < canvas.width / 2) ||
        (playerType === 'right' && x >= canvas.width / 2)) {
      socket.emit('paddleMove', { y: scaledY, room });
    }
  }
}

// Mobile control pad detection
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
function updateMobileControls() {
  if (isMobile()) {
    mobileControls.style.display = '';
  } else {
    mobileControls.style.display = 'none';
  }
}
window.addEventListener('resize', updateMobileControls);
updateMobileControls();

// Mobile pad handlers
moveUpBtn.addEventListener('touchstart', e => {
  e.preventDefault();
  movePaddle(-1);
});
moveDownBtn.addEventListener('touchstart', e => {
  e.preventDefault();
  movePaddle(1);
});
moveUpBtn.addEventListener('mousedown', e => {
  e.preventDefault();
  movePaddle(-1);
});
moveDownBtn.addEventListener('mousedown', e => {
  e.preventDefault();
  movePaddle(1);
});

function movePaddle(direction) {
  if (playerType === 'spectator' || paused) return;
  let step = canvas.height * 0.06;
  let newY = Math.max(0, Math.min(canvas.height - getPaddleHeight(bigPaddle[playerType]), currentPaddleY + direction * step));
  currentPaddleY = newY;
  let scaledY = newY * 500 / canvas.height;
  socket.emit('paddleMove', { y: scaledY, room });
}

function flashPaddle() {
  canvas.classList.add("flash-paddle");
  setTimeout(() => canvas.classList.remove("flash-paddle"), 80);
}
function flashScreen() {
  document.body.classList.add("flash-screen");
  setTimeout(() => document.body.classList.remove("flash-screen"), 200);
}

function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function drawCircle(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  drawRect(Math.max(canvas.width * 0.025, 10),
    paddles.left,
    getPaddleWidth(),
    getPaddleHeight(bigPaddle.left),
    bigPaddle.left ? "#55ff99" : "#00ff99"
  );
  drawRect(
    canvas.width - getPaddleWidth() - Math.max(canvas.width * 0.025, 10),
    paddles.right,
    getPaddleWidth(),
    getPaddleHeight(bigPaddle.right),
    bigPaddle.right ? "#ff88cc" : "#ff3366"
  );
  drawCircle(ball.x + ball.size/2, ball.y + ball.size/2, ball.size/2, "#fff");
}
function gameLoop() {
  if (!paused) draw();
  requestAnimationFrame(gameLoop);
}
gameLoop();

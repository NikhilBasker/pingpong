const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');
const scoreLeft = document.getElementById('scoreLeft');
const scoreRight = document.getElementById('scoreRight');

// Responsive canvas sizing
function resizeCanvas() {
  // Reference width and height
  let w = Math.min(window.innerWidth * 0.98, 800);
  let h = Math.min(window.innerHeight * 0.65, 500);

  // For phones, make it wider
  if (window.innerWidth < 600) {
    w = window.innerWidth * 0.99;
    h = window.innerWidth * 0.55;
  } else if (window.innerWidth < 900) {
    w = window.innerWidth * 0.98;
    h = window.innerWidth * 0.60;
  }

  canvas.width = w;
  canvas.height = h;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial call

// Paddle and ball sizes scale with canvas
function getPaddleWidth() { return Math.max(canvas.width * 0.018, 10); }
function getPaddleHeight() { return Math.max(canvas.height * 0.20, 60); }
function getBallSize() { return Math.max(canvas.width * 0.018, 10); }

let playerType = null;
let paddles = { left: 200, right: 200 }; // These will be scaled
let ball = { x: 400, y: 250, size: 15 };
let scores = { left: 0, right: 0 };

const socket = io();

socket.on('playerType', type => {
  playerType = type;
  if (type === 'left') info.textContent = "You are Player 1 (left paddle)";
  else if (type === 'right') info.textContent = "You are Player 2 (right paddle)";
  else info.textContent = "You are a spectator";
});

socket.on('gameState', state => {
  // Scale positions to canvas size
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
  scoreLeft.textContent = scores.left;
  scoreRight.textContent = scores.right;
});

// Mouse controls
canvas.addEventListener('mousemove', function(e) {
  if (playerType === 'spectator') return;
  const rect = canvas.getBoundingClientRect();
  let mouseY = e.clientY - rect.top;
  let paddleY = Math.max(0, Math.min(canvas.height - getPaddleHeight(), mouseY - getPaddleHeight()/2));
  // Scale paddleY back to server base (500px canvas)
  let scaledY = paddleY * 500 / canvas.height;
  socket.emit('paddleMove', scaledY);
});

// Touch controls
canvas.addEventListener('touchstart', handleTouch, { passive: false });
canvas.addEventListener('touchmove', handleTouch, { passive: false });

function handleTouch(e) {
  if (playerType === 'spectator') return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    let paddleY = Math.max(0, Math.min(canvas.height - getPaddleHeight(), y - getPaddleHeight()/2));
    let scaledY = paddleY * 500 / canvas.height;
    if ((playerType === 'left' && x < canvas.width / 2) ||
        (playerType === 'right' && x >= canvas.width / 2)) {
      socket.emit('paddleMove', scaledY);
    }
  }
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

  // Middle line
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Left paddle
  drawRect(
    Math.max(canvas.width * 0.025, 10),
    paddles.left,
    getPaddleWidth(),
    getPaddleHeight(),
    "#00ff99"
  );
  // Right paddle
  drawRect(
    canvas.width - getPaddleWidth() - Math.max(canvas.width * 0.025, 10),
    paddles.right,
    getPaddleWidth(),
    getPaddleHeight(),
    "#ff3366"
  );
  // Ball
  drawCircle(ball.x + ball.size/2, ball.y + ball.size/2, ball.size/2, "#fff");
}

function gameLoop() {
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();

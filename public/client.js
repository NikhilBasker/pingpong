const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');
const scoreLeft = document.getElementById('scoreLeft');
const scoreRight = document.getElementById('scoreRight');
const PADDLE_WIDTH = 15, PADDLE_HEIGHT = 100;
const PLAYER_X = 20, RIGHT_X = canvas.width - 20 - PADDLE_WIDTH;

let playerType = null;
let paddles = { left: 200, right: 200 };
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
  ball = state.ball;
  paddles = state.paddles;
  scores = state.scores;
  scoreLeft.textContent = scores.left;
  scoreRight.textContent = scores.right;
});

// Mouse controls
canvas.addEventListener('mousemove', function(e) {
  if (playerType === 'spectator') return;
  const rect = canvas.getBoundingClientRect();
  let mouseY = e.clientY - rect.top;
  mouseY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, mouseY - PADDLE_HEIGHT/2));
  socket.emit('paddleMove', mouseY);
});

// Touch controls for mobile/tablet
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
    let paddleY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, y - PADDLE_HEIGHT/2));
    // Only move paddle if player touches correct side
    if ((playerType === 'left' && x < canvas.width / 2) ||
        (playerType === 'right' && x >= canvas.width / 2)) {
      socket.emit('paddleMove', paddleY);
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
  drawRect(PLAYER_X, paddles.left, PADDLE_WIDTH, PADDLE_HEIGHT, "#00ff99");
  // Right paddle
  drawRect(RIGHT_X, paddles.right, PADDLE_WIDTH, PADDLE_HEIGHT, "#ff3366");
  // Ball
  drawCircle(ball.x + ball.size/2, ball.y + ball.size/2, ball.size/2, "#fff");
}

function gameLoop() {
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();

const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const PADDLE_WIDTH = 15, PADDLE_HEIGHT = 100;
const BALL_SIZE = 15;
const PLAYER_X = 20, AI_X = canvas.width - 20 - PADDLE_WIDTH;

let playerY = (canvas.height - PADDLE_HEIGHT) / 2;
let aiY = (canvas.height - PADDLE_HEIGHT) / 2;
let ballX = canvas.width / 2 - BALL_SIZE / 2;
let ballY = canvas.height / 2 - BALL_SIZE / 2;
let ballSpeedX = 5, ballSpeedY = 3;

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
  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Middle line
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Left paddle (player)
  drawRect(PLAYER_X, playerY, PADDLE_WIDTH, PADDLE_HEIGHT, "#00ff99");
  // Right paddle (AI)
  drawRect(AI_X, aiY, PADDLE_WIDTH, PADDLE_HEIGHT, "#ff3366");
  // Ball
  drawCircle(ballX + BALL_SIZE/2, ballY + BALL_SIZE/2, BALL_SIZE/2, "#fff");
}

function update() {
  // Ball movement
  ballX += ballSpeedX;
  ballY += ballSpeedY;

  // Ball collision with top/bottom walls
  if (ballY <= 0 || ballY + BALL_SIZE >= canvas.height) {
    ballSpeedY = -ballSpeedY;
  }

  // Ball collision with player paddle
  if (
    ballX <= PLAYER_X + PADDLE_WIDTH &&
    ballY + BALL_SIZE >= playerY &&
    ballY <= playerY + PADDLE_HEIGHT
  ) {
    ballSpeedX = -ballSpeedX;
    // Optional: add a little randomness to the bounce
    ballSpeedY += (Math.random() - 0.5) * 2;
    ballX = PLAYER_X + PADDLE_WIDTH; // Avoid stuck ball
  }

  // Ball collision with AI paddle
  if (
    ballX + BALL_SIZE >= AI_X &&
    ballY + BALL_SIZE >= aiY &&
    ballY <= aiY + PADDLE_HEIGHT
  ) {
    ballSpeedX = -ballSpeedX;
    ballSpeedY += (Math.random() - 0.5) * 2;
    ballX = AI_X - BALL_SIZE; // Avoid stuck ball
  }

  // Ball out of bounds (left or right)
  if (ballX < 0 || ballX + BALL_SIZE > canvas.width) {
    resetBall();
  }

  // AI paddle movement (simple tracking)
  let aiCenter = aiY + PADDLE_HEIGHT / 2;
  if (aiCenter < ballY + BALL_SIZE / 2 - 10) {
    aiY += 4; // Move down
  } else if (aiCenter > ballY + BALL_SIZE / 2 + 10) {
    aiY -= 4; // Move up
  }
  // Clamp AI paddle within bounds
  aiY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, aiY));
}

function resetBall() {
  ballX = canvas.width / 2 - BALL_SIZE / 2;
  ballY = canvas.height / 2 - BALL_SIZE / 2;
  ballSpeedX = (Math.random() < 0.5 ? -1 : 1) * 5;
  ballSpeedY = (Math.random() < 0.5 ? -1 : 1) * 3;
}

canvas.addEventListener('mousemove', function(e) {
  const rect = canvas.getBoundingClientRect();
  let mouseY = e.clientY - rect.top;
  playerY = mouseY - PADDLE_HEIGHT / 2;
  // Clamp player paddle within bounds
  playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY));
});

// Main game loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Start game
gameLoop();
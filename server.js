const http = require('http');
const express = require('express');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3000;

let players = {};
let scores = { left: 0, right: 0 };
let ball = {
  x: 400 - 7.5,
  y: 250 - 7.5,
  vx: 5,
  vy: 3,
  size: 15
};
const paddleHeight = 100;
const paddleWidth = 15;

function resetBall(loser) {
  ball.x = 400 - 7.5;
  ball.y = 250 - 7.5;
  // Ball moves toward the player who just lost the point
  ball.vx = (loser === 'left' ? 1 : -1) * 5;
  ball.vy = (Math.random() < 0.5 ? -1 : 1) * 3;
}

function updateGame() {
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Collide with top/bottom
  if (ball.y <= 0 || ball.y + ball.size >= 500) ball.vy *= -1;

  // Collide with left paddle
  if (
    ball.x <= 20 + paddleWidth &&
    ball.y + ball.size >= players.left &&
    ball.y <= players.left + paddleHeight
  ) {
    ball.vx *= -1;
    ball.x = 20 + paddleWidth;
    ball.vy += (Math.random() - 0.5) * 2;
  }

  // Collide with right paddle
  if (
    ball.x + ball.size >= 765 &&
    ball.y + ball.size >= players.right &&
    ball.y <= players.right + paddleHeight
  ) {
    ball.vx *= -1;
    ball.x = 765 - ball.size;
    ball.vy += (Math.random() - 0.5) * 2;
  }

  // Score and reset if out
  if (ball.x < 0) {
    scores.right++;
    resetBall('left');
  }
  if (ball.x + ball.size > 800) {
    scores.left++;
    resetBall('right');
  }
}

// Ball speed increase logic
let speedInterval = setInterval(() => {
  // Only increase if game is active
  if (players.left !== undefined && players.right !== undefined) {
    // Increase speed by 15%
    ball.vx *= 1.15;
    ball.vy *= 1.15;
  }
}, 10000); // Every 10 seconds

setInterval(() => {
  // Only run game if both players are present
  if (players.left !== undefined && players.right !== undefined) {
    updateGame();
    io.emit('gameState', {
      ball,
      paddles: { left: players.left, right: players.right },
      scores
    });
  }
}, 1000 / 60);

// Serve static files (client)
app.use(express.static(__dirname + '/public'));

io.on('connection', socket => {
  // Assign player
  let side;
  if (players.left === undefined) {
    side = 'left';
    players.left = 200;
  } else if (players.right === undefined) {
    side = 'right';
    players.right = 200;
  } else {
    side = 'spectator';
  }
  socket.emit('playerType', side);

  // Send initial scores
  socket.emit('gameState', {
    ball,
    paddles: { left: players.left, right: players.right },
    scores
  });

  // Receive paddle position
  socket.on('paddleMove', y => {
    if (side === 'left') players.left = y;
    if (side === 'right') players.right = y;
  });

  socket.on('disconnect', () => {
    if (side === 'left') delete players.left;
    if (side === 'right') delete players.right;
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

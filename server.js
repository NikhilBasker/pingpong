const http = require('http');
const express = require('express');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

const DEFAULT_WIN_SCORE = 10;
const CANVAS_W = 800;
const CANVAS_H = 500;

function getDifficultyParams(level = "medium") {
  if (level === "easy") {
    return { paddleHeight: 125, ballSpeed: 4, ballSize: 18 };
  } else if (level === "hard") {
    return { paddleHeight: 60, ballSpeed: 7, ballSize: 10 };
  } else { // medium
    return { paddleHeight: 100, ballSpeed: 5.5, ballSize: 14 };
  }
}

let games = {}; // roomCode -> game state

function newGame(winScore, difficulty) {
  const params = getDifficultyParams(difficulty);
  return {
    difficulty: difficulty || "medium",
    players: {},
    sides: { left: null, right: null },
    paddles: { left: CANVAS_H/2 - params.paddleHeight/2, right: CANVAS_H/2 - params.paddleHeight/2 },
    scores: { left: 0, right: 0 },
    winScore: winScore || DEFAULT_WIN_SCORE,
    ball: {
      x: CANVAS_W/2 - params.ballSize/2,
      y: CANVAS_H/2 - params.ballSize/2,
      vx: params.ballSpeed * (Math.random() < 0.5 ? 1 : -1),
      vy: (params.ballSpeed - 1.5) * (Math.random() < 0.5 ? 1 : -1),
      size: params.ballSize
    },
    paddleHeight: params.paddleHeight,
    ballSpeed: params.ballSpeed,
    ballSize: params.ballSize,
    paused: false,
    bigPaddleLeft: false,
    bigPaddleRight: false,
    powerupInterval: null,
    lastSpeedup: null,
    gameOver: false
  };
}

function resetBall(game, loserSide) {
  game.ball.x = CANVAS_W/2 - game.ballSize/2;
  game.ball.y = CANVAS_H/2 - game.ballSize/2;
  game.ball.vx = game.ballSpeed * (loserSide === 'left' ? 1 : -1);
  game.ball.vy = (game.ballSpeed - 1.5) * (Math.random() < 0.5 ? 1 : -1);
}

function startPowerupCycle(room, game) {
  if (game.powerupInterval) clearInterval(game.powerupInterval);
  game.powerupInterval = setInterval(() => {
    if (game.gameOver || game.paused) return;
    let side = Math.random() < 0.5 ? 'left' : 'right';
    game[`bigPaddle${side[0].toUpperCase() + side.slice(1)}`] = true;
    io.in(room).emit('visual', 'bigPaddle');
    setTimeout(() => {
      game[`bigPaddle${side[0].toUpperCase() + side.slice(1)}`] = false;
    }, 5000);
  }, 30000);
}

function stopPowerupCycle(game) {
  if (game.powerupInterval) clearInterval(game.powerupInterval);
  game.bigPaddleLeft = false;
  game.bigPaddleRight = false;
}

function updateGame(room, game) {
  if (game.paused || game.gameOver) return;

  let ball = game.ball;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Collision with top/bottom
  if (ball.y <= 0 || ball.y + ball.size >= CANVAS_H) {
    ball.vy *= -1;
    io.to(room).emit('visual', 'bounce');
  }

  // Collision with left paddle
  let paddleHLeft = game.bigPaddleLeft ? game.paddleHeight * 1.8 : game.paddleHeight;
  if (
    ball.x <= 20 + 15 &&
    ball.y + ball.size >= game.paddles.left &&
    ball.y <= game.paddles.left + paddleHLeft
  ) {
    ball.vx *= -1;
    ball.x = 20 + 15;
    ball.vy += (Math.random() - 0.5) * 2;
    io.to(room).emit('visual', 'bounce');
  }

  // Collision with right paddle
  let paddleHRight = game.bigPaddleRight ? game.paddleHeight * 1.8 : game.paddleHeight;
  if (
    ball.x + ball.size >= CANVAS_W - 20 - 15 &&
    ball.y + ball.size >= game.paddles.right &&
    ball.y <= game.paddles.right + paddleHRight
  ) {
    ball.vx *= -1;
    ball.x = CANVAS_W - 20 - 15 - ball.size;
    ball.vy += (Math.random() - 0.5) * 2;
    io.to(room).emit('visual', 'bounce');
  }

  // Score
  if (ball.x < 0) {
    game.scores.right++;
    io.to(room).emit('visual', 'score');
    resetBall(game, 'left');
  }
  if (ball.x + ball.size > CANVAS_W) {
    game.scores.left++;
    io.to(room).emit('visual', 'score');
    resetBall(game, 'right');
  }

  // Speed up ball every 10 seconds
  if (!game.lastSpeedup || Date.now() - game.lastSpeedup > 10000) {
    ball.vx *= 1.10;
    ball.vy *= 1.10;
    game.lastSpeedup = Date.now();
  }

  // Win condition
  if (!game.gameOver && (game.scores.left >= game.winScore || game.scores.right >= game.winScore)) {
    game.gameOver = true;
    stopPowerupCycle(game);
    io.in(room).emit('gameState', {
      ball: game.ball,
      paddles: game.paddles,
      scores: game.scores,
      winScore: game.winScore,
      bigPaddleLeft: game.bigPaddleLeft,
      bigPaddleRight: game.bigPaddleRight,
      difficulty: game.difficulty
    });
    io.in(room).emit('visual', 'score');
    return;
  }

  io.in(room).emit('gameState', {
    ball: game.ball,
    paddles: game.paddles,
    scores: game.scores,
    winScore: game.winScore,
    bigPaddleLeft: game.bigPaddleLeft,
    bigPaddleRight: game.bigPaddleRight,
    difficulty: game.difficulty
  });
}

setInterval(() => {
  Object.entries(games).forEach(([room, game]) => updateGame(room, game));
}, 1000/60);

io.on('connection', socket => {
  let currentRoom = null;
  let side = null;

  socket.on('joinRoom', ({ room, winScore, difficulty }) => {
    if (!room) room = Math.random().toString(36).substr(2, 6);
    if (!games[room]) {
      games[room] = newGame(winScore, difficulty);
      startPowerupCycle(room, games[room]);
    }
    currentRoom = room;
    socket.join(room);

    let game = games[room];
    if (!game.sides.left) {
      game.sides.left = socket.id;
      game.players[socket.id] = 'left';
      side = 'left';
    } else if (!game.sides.right) {
      game.sides.right = socket.id;
      game.players[socket.id] = 'right';
      side = 'right';
    } else {
      game.players[socket.id] = 'spectator';
      side = 'spectator';
    }
    socket.emit('playerType', side);

    socket.emit('gameState', {
      ball: game.ball,
      paddles: game.paddles,
      scores: game.scores,
      winScore: game.winScore,
      bigPaddleLeft: game.bigPaddleLeft,
      bigPaddleRight: game.bigPaddleRight,
      difficulty: game.difficulty
    });
  });

  socket.on('paddleMove', ({ y, room }) => {
    if (!games[room]) return;
    let game = games[room];
    let moveSide = game.players[socket.id];
    if (moveSide === 'left' || moveSide === 'right') {
      let paddleH = (moveSide === 'left' ? game.bigPaddleLeft : game.bigPaddleRight) ? game.paddleHeight * 1.8 : game.paddleHeight;
      y = Math.max(0, Math.min(CANVAS_H - paddleH, y));
      game.paddles[moveSide] = y;
    }
  });

  socket.on('togglePause', ({ room, paused }) => {
    if (!games[room]) return;
    games[room].paused = paused;
    io.in(room).emit('pauseState', paused);
  });

  socket.on('restartGame', room => {
    if (!games[room]) return;
    let winScore = games[room].winScore;
    let difficulty = games[room].difficulty;
    games[room] = newGame(winScore, difficulty);
    startPowerupCycle(room, games[room]);
  });

  socket.on('disconnect', () => {
    if (currentRoom && games[currentRoom]) {
      let game = games[currentRoom];
      let leaveSide = game.players[socket.id];
      if (leaveSide === 'left') game.sides.left = null;
      if (leaveSide === 'right') game.sides.right = null;
      delete game.players[socket.id];
      if (!game.sides.left && !game.sides.right) {
        stopPowerupCycle(game);
        delete games[currentRoom];
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

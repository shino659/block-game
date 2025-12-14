const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const restartButton = document.getElementById("restart");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = canvas.width / COLS;
const COLORS = [
  "#fef08a",
  "#86efac",
  "#a5b4fc",
  "#f9a8d4",
  "#67e8f9",
  "#fca5a5",
  "#c4b5fd",
];

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const PIECES = Object.keys(SHAPES);

class Piece {
  constructor(type) {
    this.type = type;
    this.shape = SHAPES[type].map((row) => [...row]);
    this.color = COLORS[PIECES.indexOf(type)];
    this.x = Math.floor(COLS / 2) - Math.ceil(this.shape[0].length / 2);
    this.y = 0;
  }

  rotate() {
    const rotated = this.shape[0].map((_, idx) =>
      this.shape.map((row) => row[idx]).reverse()
    );
    this.shape = rotated;
  }
}

class Board {
  constructor() {
    this.grid = this.createEmptyGrid();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.active = this.spawnPiece();
    this.gameOver = false;
    this.dropInterval = 800;
    this.dropTimer = 0;
  }

  createEmptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  spawnPiece() {
    const type = PIECES[Math.floor(Math.random() * PIECES.length)];
    const piece = new Piece(type);
    if (this.isCollision(piece, piece.x, piece.y)) {
      this.gameOver = true;
    }
    return piece;
  }

  isCollision(piece, offsetX, offsetY) {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (!piece.shape[y][x]) continue;
        const newX = offsetX + x;
        const newY = offsetY + y;
        if (
          newX < 0 ||
          newX >= COLS ||
          newY >= ROWS ||
          (newY >= 0 && this.grid[newY][newX])
        ) {
          return true;
        }
      }
    }
    return false;
  }

  mergePiece(piece) {
    piece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          const gridY = piece.y + y;
          const gridX = piece.x + x;
          if (gridY >= 0) {
            this.grid[gridY][gridX] = piece.color;
          }
        }
      });
    });
  }

  clearLines() {
    const remaining = this.grid.filter((row) => row.some((cell) => !cell));
    const cleared = ROWS - remaining.length;
    if (cleared > 0) {
      const newRows = Array.from({ length: cleared }, () => Array(COLS).fill(null));
      this.grid = [...newRows, ...remaining];
      this.lines += cleared;
      this.score += this.getScoreForLines(cleared);
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(120, 800 - (this.level - 1) * 50);
    }
  }

  getScoreForLines(count) {
    const base = [0, 100, 300, 500, 800];
    return (base[count] || base[4]) * this.level;
  }
}

const board = new Board();
let lastTime = 0;

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  board.grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) drawCell(x, y, cell);
    });
  });

  const piece = board.active;
  piece.shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) drawCell(piece.x + x, piece.y + y, piece.color);
    });
  });

  scoreEl.textContent = board.score.toLocaleString();
  linesEl.textContent = board.lines;
  levelEl.textContent = board.level;

  if (board.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "28px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2);
  }
}

function drop() {
  if (board.gameOver) return;
  const piece = board.active;
  const newY = piece.y + 1;
  if (!board.isCollision(piece, piece.x, newY)) {
    piece.y = newY;
  } else {
    board.mergePiece(piece);
    board.clearLines();
    board.active = board.spawnPiece();
  }
}

function hardDrop() {
  const piece = board.active;
  while (!board.isCollision(piece, piece.x, piece.y + 1)) {
    piece.y++;
  }
  board.mergePiece(piece);
  board.clearLines();
  board.active = board.spawnPiece();
}

function tryRotate() {
  const piece = board.active;
  const prevShape = piece.shape.map((row) => [...row]);
  piece.rotate();
  if (board.isCollision(piece, piece.x, piece.y)) {
    // simple wall kick: try left/right one cell
    if (!board.isCollision(piece, piece.x - 1, piece.y)) {
      piece.x -= 1;
    } else if (!board.isCollision(piece, piece.x + 1, piece.y)) {
      piece.x += 1;
    } else {
      piece.shape = prevShape;
    }
  }
}

function move(deltaX) {
  const piece = board.active;
  const newX = piece.x + deltaX;
  if (!board.isCollision(piece, newX, piece.y)) {
    piece.x = newX;
  }
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  board.dropTimer += delta;
  if (board.dropTimer > board.dropInterval) {
    drop();
    board.dropTimer = 0;
  }
  drawBoard();
  requestAnimationFrame(update);
}

function resetGame() {
  board.grid = board.createEmptyGrid();
  board.score = 0;
  board.lines = 0;
  board.level = 1;
  board.dropInterval = 800;
  board.gameOver = false;
  board.active = board.spawnPiece();
}

function handleKey(event) {
  if (board.gameOver) return;
  switch (event.key) {
    case "ArrowLeft":
      move(-1);
      break;
    case "ArrowRight":
      move(1);
      break;
    case "ArrowUp":
      tryRotate();
      break;
    case "ArrowDown":
      drop();
      board.dropTimer = 0;
      break;
    case " ":
      hardDrop();
      board.dropTimer = 0;
      break;
    default:
      return;
  }
  event.preventDefault();
}

document.addEventListener("keydown", handleKey);
restartButton.addEventListener("click", resetGame);

update();

let canvas;
let ctx;
// our websocket connection
let socket;
let hash;
let moveRight = false;
let moveLeft = false;
let prevTime;

const squares = {};

const update = (data) => {
  if (!squares[data.hash]) {
    squares[data.hash] = data;
    return;
  }

  // if we were using io.sockets.in or socket.emit
  // to forcefully move this user back because of
  // collision, error, invalid data, etc
  /**
  if(data.hash === hash) {
    //force update user somehow
    return;
  } * */

  const square = squares[data.hash];

  if (square.lastUpdate >= data.lastUpdate) {
    return;
  }

  square.lastUpdate = data.lastUpdate;
  square.prevX = data.prevX;
  square.prevY = data.prevY;
  square.destX = data.destX;
  square.destY = data.destY;
  square.alpha = 0.05;
  square.force = data.force;
};

const lerp = (v0, v1, alpha) => ((1 - alpha) * v0) + (alpha * v1);

const updatePosition = (deltaTime) => {
  const square = squares[hash];

  square.prevX = square.x;
  square.prevY = square.y;

  /* if (moveUp && square.destY > square.height / 2) {
    square.destY -= 24 * deltaTime;
  }
  if (moveDown && square.destY < canvas.height - (square.height / 2)) {
    square.destY += 24 * deltaTime;
  } */
  if (moveLeft && square.destX > square.width / 2) {
    square.destX -= 24 * deltaTime;
  }
  if (moveRight && square.destX < canvas.width - (square.width / 2)) {
    square.destX += 24 * deltaTime;
  }

  // Reset our alpha since we are moving
  square.alpha = 0.05;

  // moved to sendWithLag
  socket.emit('movementUpdate', square);
};

const redraw = (time) => {
  const deltaTime = (time - prevTime) / 100;
  prevTime = time;
  updatePosition(deltaTime);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const keys = Object.keys(squares);

  // Sort our keys by lastUpdate
  // More recently updated characters are drawn on top
  // keys.sort((a, b) => squares[a].lastUpdate - squares[b].lastUpdate);

  for (let i = 0; i < keys.length; i++) {
    const square = squares[keys[i]];

    if (square.alpha < 1) square.alpha += 0.05;

    square.x = lerp(square.prevX, square.destX, square.alpha);
    square.y = lerp(square.prevY, square.destY, square.alpha);

    if (square.hash === hash) {
      ctx.fillStyle = 'rgb(0, 0, 255)';
    } else {
      ctx.fillStyle = 'rgb(0, 0, 0)';
    }
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;

    // Draw the triangle for the character
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.moveTo(square.x, square.y - (square.height / 2));
    ctx.lineTo(square.x + (square.width / 2), square.y + (square.height / 2));
    ctx.lineTo(square.x - (square.width / 2), square.y + (square.height / 2));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  requestAnimationFrame(redraw);
};

const setUser = (data) => {
  const h = data.hash;
  hash = h;
  squares[hash] = data;
  requestAnimationFrame(redraw);
};

const removeUser = (rHash) => {
  if (squares[rHash]) {
    delete squares[rHash];
  }
};

const keyDownHandler = (e) => {
  const keyPressed = e.which;

  if (keyPressed === 65 || keyPressed === 37) {
    // A OR LEFT
    moveLeft = true;
  } else if (keyPressed === 68 || keyPressed === 39) {
    // D OR RIGHT
    moveRight = true;
  }
  
  // Space for jumping
  if(keyPressed === 32) {
    if(squares[hash].force <= 0 && squares[hash].y > 570) {
      squares[hash].force = 12;
    }
    e.preventDefault();
  }

  // if one of these keys is down, let's cancel the browsers
  // default action so the page doesn't try to scroll on the user
  if (moveLeft || moveRight) {
    e.preventDefault();
  }
};

const keyUpHandler = (e) => {
  const keyPressed = e.which;

  if (keyPressed === 65 || keyPressed === 37) {
    // A OR LEFT
    moveLeft = false;
  } else if (keyPressed === 68 || keyPressed === 39) {
    // D OR RIGHT
    moveRight = false;
  }
};

const init = () => {
  canvas = document.querySelector('#canvas');
  ctx = canvas.getContext('2d');

  socket = io.connect();

  /* socket.on('connect', () => {
    setInterval(sendWithLag, 100);
  }); */

  socket.on('joined', setUser);

  socket.on('updatedMovement', update);

  socket.on('left', removeUser);

  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keyup', keyUpHandler);
};

window.onload = init;

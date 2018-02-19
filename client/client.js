let canvas;
let ctx;
// our websocket connection
let socket;
let hash;
let moveDown = false;
let moveUp = false;
let moveRight = false;
let moveLeft = false;
let prevTime;

const squares = {};
const slashLines = {};

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
  square.mouseX = data.mouseX;
  square.mouseY = data.mouseY;
  square.slashCooldown = data.slashCooldown;
};

const lerp = (v0, v1, alpha) => ((1 - alpha) * v0) + (alpha * v1);

const updatePosition = (deltaTime) => {
  const square = squares[hash];

  square.prevX = square.x;
  square.prevY = square.y;

  if (square.slashCooldown <= 3) {
    if (moveUp && square.destY > square.height / 2) {
      square.destY -= 24 * deltaTime;
    }
    if (moveDown && square.destY < canvas.height - (square.height / 2)) {
      square.destY += 24 * deltaTime;
    }
    if (moveLeft && square.destX > square.width / 2) {
      square.destX -= 24 * deltaTime;
    }
    if (moveRight && square.destX < canvas.width - (square.width / 2)) {
      square.destX += 24 * deltaTime;
    }
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
    if (square.slashCooldown > 0) square.slashCooldown -= deltaTime;

    square.x = lerp(square.prevX, square.destX, square.alpha);
    square.y = lerp(square.prevY, square.destY, square.alpha);

    square.angle = Math.atan2(square.mouseX - square.x, -(square.mouseY - square.y));

    if (slashLines[square.hash]) {
      const slashLine = slashLines[square.hash];
      slashLine.alpha -= deltaTime / 8;
      if (square.slashCooldown <= 3 && slashLine.alpha !== 0) {
        // Tell the server to remove the line
        // socket.emit('slashLineRemove', slashLine);
        slashLine.alpha = 0;
      } else {
        slashLine.p2X = square.x;
        slashLine.p2Y = square.y;

        // Draw the line
        ctx.save();
        ctx.setLineDash([5, 10]);
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(0, 0, 0, ${slashLine.alpha})`;
        ctx.beginPath();
        ctx.moveTo(slashLine.p1X, slashLine.p1Y);
        ctx.lineTo(slashLine.p2X, slashLine.p2Y);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(square.x, square.y);
    ctx.rotate(square.angle);
    const slashAlpha = (1 / (square.slashCooldown + 1)) * 0.8;

    if (square.hash === hash) {
      ctx.fillStyle = `rgba(0, 0, 255, ${slashAlpha})`;

      // Draw a line in the direction you're facing
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.setLineDash([5, 10]);
      ctx.moveTo(0, 0 - (square.height / 2));
      ctx.lineTo(0, 0 - (square.height / 2) - 50);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(0, 0, 0, ${slashAlpha})`;
    }
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;

    // Draw the triangle for the character
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.moveTo(0, 0 - (square.height / 2));
    ctx.lineTo(0 + (square.width / 2), 0 + (square.height / 2));
    ctx.lineTo(0 - (square.width / 2), 0 + (square.height / 2));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
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

  if (keyPressed === 87 || keyPressed === 38) {
    // W OR UP
    moveUp = true;
  } else if (keyPressed === 65 || keyPressed === 37) {
    // A OR LEFT
    moveLeft = true;
  } else if (keyPressed === 83 || keyPressed === 40) {
    // S OR DOWN
    moveDown = true;
  } else if (keyPressed === 68 || keyPressed === 39) {
    // D OR RIGHT
    moveRight = true;
  }

  // if one of these keys is down, let's cancel the browsers
  // default action so the page doesn't try to scroll on the user
  if (moveUp || moveDown || moveLeft || moveRight) {
    e.preventDefault();
  }
};

const keyUpHandler = (e) => {
  const keyPressed = e.which;

  if (keyPressed === 87 || keyPressed === 38) {
    // W OR UP
    moveUp = false;
  } else if (keyPressed === 65 || keyPressed === 37) {
    // A OR LEFT
    moveLeft = false;
  } else if (keyPressed === 83 || keyPressed === 40) {
    // S OR DOWN
    moveDown = false;
  } else if (keyPressed === 68 || keyPressed === 39) {
    // D OR RIGHT
    moveRight = false;
  }
};

/* const sendWithLag = () => {
  socket.emit('movementUpdate', squares[hash]);
}; */

const mouseMoveHandler = (e) => {
  if (squares[hash]) {
    const square = squares[hash];
    square.mouseX = e.pageX - e.target.offsetLeft;
    square.mouseY = e.pageY - e.target.offsetTop;

    socket.emit('movementUpdate', square);
  }
};

const slash = (e) => {
  if (squares[hash]) {
    const square = squares[hash];
    if (square.slashCooldown <= 0) {
      square.mouseX = e.pageX - e.target.offsetLeft;
      square.mouseY = e.pageY - e.target.offsetTop;

      const directionX = square.x - square.mouseX;
      const directionY = square.y - square.mouseY;
      const magnitude = Math.sqrt((directionX ** 2) + (directionY ** 2));

      const dX = directionX / magnitude;
      const dY = directionY / magnitude;

      // Move 200 units in the direciton of the mouse cursor
      square.slashCooldown = 10;
      square.destX -= dX * 200;
      square.destY -= dY * 200;

      // Create a slash line for the player
      slashLines[square.hash] = {
        hash: square.hash,
        p1X: square.x,
        p1Y: square.y,
        p2X: square.x,
        p2Y: square.y,
        alpha: 1.0,
      };

      // Tell the server to add the slash line
      socket.emit('slashLineCreated', slashLines[square.hash]);
    }
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

  socket.on('addLine', (data) => {
    slashLines[data.hash] = data;
  });

  // We were originally going to delete and add lines each time a slash happened
  // However, we can just reduce the alpha to 0 and reuse the line
  /* socket.on('removeLine', (data) => {
    delete slashLines[data.hash];
  }); */

  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keyup', keyUpHandler);
  canvas.addEventListener('mousemove', mouseMoveHandler);
  canvas.addEventListener('click', slash);
};

window.onload = init;

const http = require('http');
const socketio = require('socket.io');
const xxh = require('xxhashjs');

const fs = require('fs');

const PORT = process.env.PORT || process.env.NODE_PORT || 3000;

const handler = (req, res) => {
  if (req.url === '/bundle.js') {
    fs.readFile(`${__dirname}/../hosted/bundle.js`, (err, data) => {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(data);
    });
  } else {
    // Read our file ASYNCHRONOUSLY from the file system.
    fs.readFile(`${__dirname}/../hosted/index.html`, (err, data) => {
      // if err, throw it for now
      if (err) {
        throw err;
      }
      res.writeHead(200);
      res.end(data);
    });
  }
};

const app = http.createServer(handler);
const io = socketio(app);

app.listen(PORT);

io.on('connection', (sock) => {
  const socket = sock;
  socket.join('room1');

  // Server itself doesn't care about height, width, prevX, and prevY (unless collisions)
  socket.character = {
    hash: xxh.h32(`${socket.id}${new Date().getTime()}`, 0xDEADBEEF).toString(16),
    lastUpdate: new Date().getTime(),
    x: 100,
    y: 100,
    height: 40,
    width: 40,
    prevX: 100,
    prevY: 100,
    destX: 100,
    destY: 100,
    alpha: 0,
    angle: 0,
    mouseX: 0,
    mouseY: 0,
    slashCooldown: 0,
  };

  socket.emit('joined', socket.character);

  socket.on('movementUpdate', (data) => {
    socket.character = data;
    socket.character.lastUpdate = new Date().getTime();

    socket.broadcast.to('room1').emit('updatedMovement', socket.character);
  });

  socket.on('slashLineCreated', (data) => {
    socket.broadcast.to('room1').emit('addLine', data);
  });

  socket.on('slashLineRemove', (data) => {
    io.sockets.in('room1').emit('removeLine', data);
  });

  socket.on('disconnect', () => {
    io.sockets.in('room1').emit('left', socket.character.hash);

    socket.leave('room1');
  });
});

console.log(`listening on port ${PORT}`);

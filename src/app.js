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

const characters = {};
const cSize = 600;

// Used to stop players from going offscreen
const boundaryStop = (c) => {
  const character = c;
  if (character.destX < character.width / 2) character.destX = character.width / 2;
  if (character.destX > cSize - (character.width / 2)) {
    character.destX = cSize - (character.width / 2);
  }
  if (character.destY < character.height / 2) character.destY = character.height / 2;
  if (character.destY > cSize - (character.height / 2)) {
    character.destY = cSize - (character.height / 2);
  }
};

// Applies force for all users
// This handles gravity and jumping
const applyForce = () => {
  const keys = Object.keys(characters);
  for (let i = 0; i < keys.length; i++) {
    const character = characters[keys[i]];
    if (character.force > 0) {
      character.force -= 1;
      character.destY -= character.force;
    } else {
      character.destY += 2;
    }

    boundaryStop(character);
    character.lastUpdate = new Date().getTime();
    io.sockets.in('room1').emit('updatedMovement', character);
  }
};

app.listen(PORT);

io.on('connection', (sock) => {
  const socket = sock;
  socket.join('room1');

  // Server itself doesn't care about height, width, prevX, and prevY (unless collisions)
  const character = {
    hash: xxh.h32(`${socket.id}${new Date().getTime()}`, 0xDEADBEEF).toString(16),
    lastUpdate: new Date().getTime(),
    x: 220,
    y: 20,
    height: 40,
    width: 40,
    prevX: 220,
    prevY: 20,
    destX: 220,
    destY: 20,
    alpha: 0,
    force: 0,
  };

  characters[character.hash] = character;
  socket.hash = character.hash;

  socket.emit('joined', character);

  socket.on('movementUpdate', (data) => {
    boundaryStop(data);
    characters[data.hash] = data;
    characters[data.hash].lastUpdate = new Date().getTime();

    socket.broadcast.to('room1').emit('updatedMovement', characters[data.hash]);
  });

  socket.on('disconnect', () => {
    io.sockets.in('room1').emit('left', socket.hash);

    delete characters[socket.hash];

    socket.leave('room1');
  });
});

console.log(`listening on port ${PORT}`);

setInterval(() => {
  applyForce();
}, 20);

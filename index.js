const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');

app.use(express.static('public'));

// Game Data
const WORDS = ['Giraffe', 'Elephant', 'Lion', 'Penguin'];
const QUESTIONS = ['First kiss age?', 'First car year?', 'Number of siblings?'];
const lobbies = new Map();

// Routes
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/lobby', (req, res) => res.sendFile(__dirname + '/public/lobby.html'));

io.on('connection', (socket) => {
  let currentLobby = null;

  // Lobby Creation
  socket.on('createLobby', ({ playerName, lobbyName }) => {
    const lobbyId = uuidv4().slice(0, 6);
    const newLobby = {
      id: lobbyId,
      name: lobbyName,
      players: [{
        id: socket.id,
        name: playerName,
        isHost: true,
        role: null
      }],
      game: null,
      settings: {}
    };
    
    lobbies.set(lobbyId, newLobby);
    socket.join(lobbyId);
    currentLobby = lobbyId;
    socket.emit('lobbyCreated', lobbyId);
  });

  // Lobby Joining
  socket.on('joinLobby', ({ lobbyId, playerName }) => {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return socket.emit('error', 'Lobby not found');
    
    lobby.players.push({
      id: socket.id,
      name: playerName,
      isHost: false,
      role: null
    });
    
    socket.join(lobbyId);
    currentLobby = lobbyId;
    io.to(lobbyId).emit('lobbyUpdate', lobby);
  });

  // Game Management
  socket.on('startGame', (settings) => {
    const lobby = lobbies.get(currentLobby);
    if (!lobby) return;
    
    lobby.game = settings.gameType;
    lobby.settings = settings;
    
    if (lobby.game === 'imposters') {
      const imposters = lobby.players.sort(() => 0.5 - Math.random()).slice(0, settings.imposterCount);
      const word = WORDS[Math.floor(Math.random() * WORDS.length)];
      
      lobby.players.forEach(player => {
        player.role = imposters.includes(player) ? 'imposter' : 'civilian';
        player.word = player.role === 'civilian' ? word : null;
      });
    }
    
    io.to(currentLobby).emit('gameStarted', lobby);
  });

  // Cleanup
  socket.on('disconnect', () => {
    if (!currentLobby) return;
    const lobby = lobbies.get(currentLobby);
    if (!lobby) return;
    
    lobby.players = lobby.players.filter(p => p.id !== socket.id);
    if (lobby.players.length === 0) lobbies.delete(currentLobby);
    else io.to(currentLobby).emit('lobbyUpdate', lobby);
  });
});

http.listen(process.env.PORT || 3000, () => {
  console.log('Server running');
});
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');
const gameData = require('./public/gameData.json');

app.use(express.static('public'));

const lobbies = new Map();

io.on('connection', (socket) => {
  let currentLobby = null;

  // Create lobby
  socket.on('createLobby', ({ lobbyName, playerName }) => {
    const lobbyId = uuidv4();
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
    
    lobbies.set(lobbyName.toLowerCase(), newLobby);
    socket.join(lobbyId);
    currentLobby = lobbyId;
    io.to(lobbyId).emit('lobbyUpdate', newLobby);
  });

  // Join lobby
  socket.on('joinLobby', ({ lobbyName, playerName }) => {
    const lobby = lobbies.get(lobbyName.toLowerCase());
    if (!lobby) return socket.emit('error', 'Lobby not found');
    if (lobby.players.length >= 15) return socket.emit('error', 'Lobby full');
    if (lobby.players.some(p => p.name === playerName)) return socket.emit('error', 'Name taken');

    const newPlayer = {
      id: socket.id,
      name: playerName,
      isHost: false,
      role: null
    };

    lobby.players.push(newPlayer);
    socket.join(lobby.id);
    currentLobby = lobby.id;
    io.to(lobby.id).emit('lobbyUpdate', lobby);
  });

  // Start game
  socket.on('startGame', (settings) => {
    const lobby = Array.from(lobbies.values()).find(l => l.id === currentLobby);
    if (!lobby) return;

    lobby.game = settings.gameType;
    lobby.settings = settings;

    if (lobby.game === 'imposters') {
      const imposters = lobby.players.sort(() => 0.5 - Math.random()).slice(0, settings.imposterCount);
      const word = gameData.words[Math.floor(Math.random() * gameData.words.length)];
      
      lobby.players.forEach(player => {
        player.role = imposters.includes(player) ? 'imposter' : 'civilian';
        player.word = player.role === 'civilian' ? word : null;
      });
    } else {
      const questions = [...gameData.questions].sort(() => Math.random() - 0.5);
      lobby.players.forEach((player, index) => {
        player.question = index < settings.imposterQuestions ? 
          questions[0] : 
          questions[Math.floor(Math.random() * (questions.length - 1)) + 1];
      });
    }

    io.to(currentLobby).emit('gameStarted', lobby);
  });

  // Handle disconnects
  socket.on('disconnect', () => {
    if (!currentLobby) return;
    const lobby = Array.from(lobbies.values()).find(l => l.id === currentLobby);
    if (!lobby) return;

    lobby.players = lobby.players.filter(p => p.id !== socket.id);
    if (lobby.players.length === 0) {
      lobbies.delete(lobby.name.toLowerCase());
    } else {
      io.to(currentLobby).emit('lobbyUpdate', lobby);
    }
  });
});

http.listen(process.env.PORT || 3000, () => console.log('Server running'));
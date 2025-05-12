const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');

app.use(express.static('public'));

const lobbies = new Map();
const words = ['Giraffe', 'Elephant', 'Tiger', 'Penguin', 'Kangaroo'];
const questions = ['First kiss age?', 'First car year?', 'Number of siblings?'];

io.on('connection', (socket) => {
  let currentLobby = null;

  socket.on('createLobby', (data) => {
    const lobbyId = uuidv4().slice(0, 8);
    const lobby = {
      id: lobbyId,
      name: data.lobbyName,
      players: [{ id: socket.id, name: data.playerName, isHost: true }],
      game: null,
      maxPlayers: 15,
      settings: {},
      answers: new Map(),
      votes: new Map()
    };
    lobbies.set(lobbyId, lobby);
    socket.join(lobbyId);
    currentLobby = lobbyId;
    io.to(lobbyId).emit('lobbyUpdate', lobby);
  });

  socket.on('joinLobby', (data) => {
    const lobby = lobbies.get(data.lobbyId);
    if (lobby && lobby.players.length < lobby.maxPlayers) {
      socket.join(data.lobbyId);
      lobby.players.push({ id: socket.id, name: data.playerName, isHost: false });
      currentLobby = data.lobbyId;
      io.to(data.lobbyId).emit('lobbyUpdate', lobby);
    }
  });

  socket.on('startGame', (settings) => {
    const lobby = lobbies.get(currentLobby);
    if (lobby) {
      lobby.game = settings.gameType;
      lobby.settings = settings;
      
      if (lobby.game === 'imposters') {
        assignImposters(lobby);
      } else {
        assignQuestions(lobby);
      }
      
      io.to(currentLobby).emit('gameStarted', lobby);
    }
  });

  socket.on('submitAnswer', (answer) => {
    const lobby = lobbies.get(currentLobby);
    if (lobby) {
      lobby.answers.set(socket.id, answer);
      if (lobby.answers.size === lobby.players.length) {
        io.to(currentLobby).emit('allAnswersSubmitted', Array.from(lobby.answers));
      }
    }
  });

  socket.on('submitVote', (votedId) => {
    const lobby = lobbies.get(currentLobby);
    if (lobby) {
      lobby.votes.set(socket.id, votedId);
      if (lobby.votes.size === lobby.players.length) {
        const voteCounts = Array.from(lobby.votes.values()).reduce((acc, id) => {
          acc[id] = (acc[id] || 0) + 1;
          return acc;
        }, {});
        io.to(currentLobby).emit('votingResults', voteCounts);
      }
    }
  });

  socket.on('disconnect', () => {
    if (currentLobby) {
      const lobby = lobbies.get(currentLobby);
      if (lobby) {
        lobby.players = lobby.players.filter(p => p.id !== socket.id);
        if (lobby.players.length === 0) {
          lobbies.delete(currentLobby);
        } else {
          io.to(currentLobby).emit('lobbyUpdate', lobby);
        }
      }
    }
  });

  function assignImposters(lobby) {
    const impostersCount = lobby.settings.imposters || 1;
    const players = [...lobby.players];
    
    for (let i = 0; i < impostersCount; i++) {
      const randomIndex = Math.floor(Math.random() * players.length);
      players[randomIndex].isImposter = true;
    }
    
    const word = words[Math.floor(Math.random() * words.length)];
    players.forEach(player => {
      player.word = player.isImposter ? null : word;
    });
  }

  function assignQuestions(lobby) {
    const questionsCount = lobby.settings.questions || 1;
    const players = [...lobby.players];
    const imposterQuestions = questions.slice(0, questionsCount);
    
    players.forEach((player, index) => {
      player.question = index < questionsCount ? 
        imposterQuestions[index] : 
        questions[Math.floor(Math.random() * questions.length)];
    });
  }
});

// Replace the last line with:
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
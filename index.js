const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');

// Add favicon fix
app.get('/favicon.ico', (req, res) => res.status(204));

app.use(express.static('public'));

// Store lobbies by name
const lobbies = new Map();

io.on('connection', (socket) => {
    // Create lobby with name
    socket.on('createLobby', ({ lobbyName, playerName }) => {
        const lobbyId = uuidv4();
        const newLobby = {
            id: lobbyId,
            name: lobbyName,
            players: [{
                id: socket.id,
                name: playerName,
                isHost: true
            }],
            game: null
        };
        
        // Store lobby by both ID and name
        lobbies.set(lobbyId, newLobby);
        lobbies.set(lobbyName, newLobby);
        
        socket.join(lobbyId);
        socket.emit('lobbyCreated', {
            id: lobbyId,
            playerName: playerName
        });
    });

    // Join by lobby name
    socket.on('joinLobby', ({ lobbyName, playerName }) => {
        const lobby = lobbies.get(lobbyName);
        
        if (!lobby) {
            return socket.emit('error', 'Lobby not found');
        }
        
        if (lobby.players.length >= 15) {
            return socket.emit('error', 'Lobby is full');
        }
        
        lobby.players.push({
            id: socket.id,
            name: playerName,
            isHost: false
        });
        
        socket.join(lobby.id);
        io.to(lobby.id).emit('lobbyJoined', {
            id: lobby.id,
            playerName: playerName
        });
    });
});

http.listen(process.env.PORT || 3000, () => {
    console.log('Server running');
});
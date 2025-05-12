// Initialize socket once
const socket = io();

function createLobby() {
    const lobbyName = document.getElementById('lobbyName').value;
    const playerName = document.getElementById('playerName').value;
    
    if (lobbyName && playerName) {
        socket.emit('createLobby', { 
            lobbyName: lobbyName,
            playerName: playerName 
        });
    }
}

function joinLobby() {
    const lobbyName = document.getElementById('joinLobbyName').value;
    const playerName = document.getElementById('joinPlayerName').value;
    
    if (lobbyName && playerName) {
        socket.emit('joinLobby', { 
            lobbyName: lobbyName,
            playerName: playerName 
        });
    }
}

// Handle lobby creation response
socket.on('lobbyCreated', (lobbyData) => {
    window.location.href = `/lobby.html?lobbyId=${lobbyData.id}&playerName=${encodeURIComponent(lobbyData.playerName)}`;
});

// Handle lobby join response
socket.on('lobbyJoined', (lobbyData) => {
    window.location.href = `/lobby.html?lobbyId=${lobbyData.id}&playerName=${encodeURIComponent(lobbyData.playerName)}`;
});

// Error handling
socket.on('error', (message) => {
    alert(message);
});
const socket = io();

function createLobby() {
    const lobbyName = document.getElementById('lobbyName').value;
    const playerName = document.getElementById('playerName').value;
    if (lobbyName && playerName) {
        socket.emit('createLobby', { lobbyName, playerName });
    }
}

function joinLobby() {
    const lobbyName = document.getElementById('joinLobbyName').value;
    const playerName = document.getElementById('joinPlayerName').value;
    if (lobbyName && playerName) {
        socket.emit('joinLobby', { lobbyName, playerName });
    }
}

socket.on('lobbyUpdate', (lobby) => {
    window.location.href = `/lobby.html?lobbyId=${lobby.id}&playerName=${encodeURIComponent(lobby.players.find(p => p.id === socket.id).name)}`;
});

socket.on('error', (message) => {
    alert(message);
});
const socket = io();

function createLobby() {
    const playerName = document.getElementById('playerNameCreate').value;
    const lobbyName = document.getElementById('lobbyName').value;
    if (playerName && lobbyName) {
        socket.emit('createLobby', { playerName, lobbyName });
    }
}

function joinLobby() {
    const playerName = document.getElementById('playerNameJoin').value;
    const lobbyId = document.getElementById('lobbyId').value;
    if (playerName && lobbyId) {
        socket.emit('joinLobby', { playerName, lobbyId });
    }
}

socket.on('lobbyUpdate', (lobby) => {
    window.location.href = `/lobby.html?lobbyId=${lobby.id}&playerName=${encodeURIComponent(lobby.players.find(p => p.id === socket.id).name)}`;
});
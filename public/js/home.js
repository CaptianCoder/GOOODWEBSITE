const socket = io();

function createLobby() {
    const name = document.getElementById('createName').value;
    const lobbyName = document.getElementById('lobbyName').value;
    if (name && lobbyName) {
        socket.emit('createLobby', { 
            playerName: name, 
            lobbyName: lobbyName 
        });
    }
}

function joinLobby() {
    const name = document.getElementById('joinName').value;
    const code = document.getElementById('lobbyCode').value;
    if (name && code) {
        socket.emit('joinLobby', { 
            playerName: name, 
            lobbyId: code 
        });
    }
}

socket.on('lobbyCreated', (lobbyId) => {
    window.location.href = `/lobby?lobbyId=${lobbyId}`;
});

socket.on('lobbyUpdate', (lobby) => {
    window.location.href = `/lobby?lobbyId=${lobby.id}`;
});

socket.on('error', (message) => {
    alert(message);
});
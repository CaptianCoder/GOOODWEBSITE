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

// Initialize socket after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // Now properly initialized
    
    window.createLobby = function() {
        const name = document.getElementById('createName').value;
        const lobbyName = document.getElementById('lobbyName').value;
        if (name && lobbyName) {
            socket.emit('createLobby', { 
                playerName: name, 
                lobbyName: lobbyName 
            });
        }
    };

    window.joinLobby = function() {
        const name = document.getElementById('joinName').value;
        const code = document.getElementById('lobbyCode').value;
        if (name && code) {
            socket.emit('joinLobby', { 
                playerName: name, 
                lobbyId: code 
            });
        }
    };

    socket.on('lobbyCreated', (lobbyId) => {
        window.location.href = `/lobby?lobbyId=${lobbyId}`;
    });

    socket.on('lobbyUpdate', (lobby) => {
        window.location.href = `/lobby?lobbyId=${lobby.id}`;
    });

    socket.on('error', (message) => {
        alert(message);
    });
});
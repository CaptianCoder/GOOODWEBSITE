const socket = io();
const lobbyId = new URLSearchParams(window.location.search).get('lobbyId');
let isHost = false;

socket.emit('joinLobby', { 
    lobbyId, 
    playerName: `Player${Math.floor(Math.random() * 1000)}` 
});

socket.on('lobbyUpdate', (lobby) => {
    document.getElementById('lobbyTitle').textContent = lobby.name;
    isHost = lobby.players.some(p => p.id === socket.id && p.isHost);
    
    // Update players
    document.getElementById('players').innerHTML = lobby.players
        .map(player => `
            <div class="player-card">
                <span>${player.name}</span>
                ${player.isHost ? '👑' : ''}
            </div>
        `).join('');
    
    // Host controls
    document.getElementById('hostPanel').style.display = isHost ? 'block' : 'none';
});

socket.on('gameStarted', (lobby) => {
    const player = lobby.players.find(p => p.id === socket.id);
    const gameArea = document.getElementById('gameArea');
    
    if (lobby.game === 'imposters') {
        gameArea.innerHTML = `
            <h2>${player.role === 'imposter' ? 'You are the IMPOSTER!' : `Word: ${player.word}`}</h2>
            <p>Discuss with other players to find the imposter!</p>
        `;
    }
});

function startGame() {
    const gameType = document.getElementById('gameSelect').value;
    const imposterCount = parseInt(document.getElementById('imposterCount').value);
    
    socket.emit('startGame', {
        gameType: gameType,
        imposterCount: imposterCount
    });
}
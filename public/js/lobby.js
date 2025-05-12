const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const lobbyId = urlParams.get('lobbyId');
const playerName = decodeURIComponent(urlParams.get('playerName'));
let isHost = false;

socket.emit('joinLobby', { 
    lobbyId, 
    playerName 
});

socket.on('lobbyUpdate', (lobby) => {
    document.getElementById('lobbyTitle').textContent = lobby.name;
    isHost = lobby.players.some(p => p.id === socket.id && p.isHost);
    
    // Update player list
    document.getElementById('players').innerHTML = lobby.players
        .map(player => `
            <div class="player-card">
                ${player.name} 
                ${player.isHost ? '👑 (Host)' : ''}
            </div>
        `).join('');
    
    // Show host controls
    document.getElementById('hostControls').style.display = isHost ? 'block' : 'none';
});

socket.on('gameStarted', (lobby) => {
    const player = lobby.players.find(p => p.id === socket.id);
    const gameArea = document.getElementById('gameArea');
    
    if (lobby.game === 'imposters') {
        gameArea.innerHTML = `
            <h2>${player.role === 'imposter' ? 'You are the IMPOSTER!' : `Word: ${player.word}`}</h2>
            <p>Discuss with other players to find the imposter!</p>
        `;
    } else {
        gameArea.innerHTML = `
            <h2>Your Question: ${player.question}</h2>
            <input type="text" id="answerInput" placeholder="Your answer...">
            <button onclick="submitAnswer()">Submit</button>
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

function submitAnswer() {
    const answer = document.getElementById('answerInput').value;
    // Add answer submission logic
}
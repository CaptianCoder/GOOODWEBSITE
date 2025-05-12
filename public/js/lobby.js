const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const lobbyId = urlParams.get('lobbyId');
const playerName = urlParams.get('playerName');
let isHost = false;

socket.emit('joinLobby', { lobbyId, playerName });

socket.on('lobbyUpdate', (lobby) => {
    isHost = lobby.players.some(p => p.id === socket.id && p.isHost);
    document.getElementById('lobbyName').textContent = lobby.name;
    
    // Update player list
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = lobby.players.map(p => `
        <div class="player">
            ${p.name} ${p.isHost ? '👑' : ''}
            ${p.isImposter ? '👤' : ''}
        </div>
    `).join('');
    
    // Show/host controls
    document.getElementById('hostControls').style.display = isHost ? 'block' : 'none';
});

socket.on('gameStarted', (lobby) => {
    const gameArea = document.getElementById('gameArea');
    if (lobby.game === 'imposters') {
        const player = lobby.players.find(p => p.id === socket.id);
        gameArea.innerHTML = `
            <h2>${player.isImposter ? 'You are the Imposter!' : 'Word: ' + player.word}</h2>
            <p>Wait for others to discuss...</p>
        `;
    } else {
        const player = lobby.players.find(p => p.id === socket.id);
        gameArea.innerHTML = `
            <h2>Question: ${player.question}</h2>
            <input type="text" id="answerInput">
            <button onclick="submitAnswer()">Submit Answer</button>
        `;
    }
});

socket.on('allAnswersSubmitted', (answers) => {
    const gameArea = document.getElementById('gameArea');
    gameArea.innerHTML += `
        <h3>Answers:</h3>
        ${answers.map(([id, answer]) => `
            <div>
                ${document.querySelector(`.player div:contains('${id}')`).textContent}: 
                ${answer}
                <button onclick="vote('${id}')">Vote</button>
            </div>
        `).join('')}
    `;
});

socket.on('votingResults', (results) => {
    const gameArea = document.getElementById('gameArea');
    gameArea.innerHTML += `
        <h3>Voting Results:</h3>
        <pre>${JSON.stringify(results, null, 2)}</pre>
    `;
});

function selectGame(gameType) {
    const settingsDiv = document.getElementById('gameSettings');
    let html = '';
    
    if (gameType === 'imposters') {
        html = `
            <h3>Imposters Settings</h3>
            <label>Number of Imposters:</label>
            <select id="imposterCount">
                ${[1,2,3].map(n => `<option>${n}</option>`).join('')}
            </select>
        `;
    } else {
        html = `
            <h3>Guessing Game Settings</h3>
            <label>Number of Imposter Questions:</label>
            <input type="number" id="questionCount" min="1" value="1">
        `;
    }
    
    settingsDiv.innerHTML = html;
    document.getElementById('startButton').style.display = 'block';
}

function startGame() {
    const gameType = document.querySelector('#gameSettings h3').textContent.includes('Imposters') ? 'imposters' : 'guessing';
    const settings = {
        gameType,
        imposters: gameType === 'imposters' ? parseInt(document.getElementById('imposterCount').value) : null,
        questions: gameType === 'guessing' ? parseInt(document.getElementById('questionCount').value) : null
    };
    socket.emit('startGame', settings);
}

function submitAnswer() {
    const answer = document.getElementById('answerInput').value;
    socket.emit('submitAnswer', answer);
}

function vote(playerId) {
    socket.emit('submitVote', playerId);
}

function endRound() {
    // Add round ending logic
}
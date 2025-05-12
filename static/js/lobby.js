const socket = io();
let isHost = false;
let currentGame = null;
let lobbyCode = new URLSearchParams(window.location.search).get('code');
let players = [];
let currentHostId = null;

function updatePlayerList() {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = players.map(p => {
        const isYou = p.id === socket.id;
        const isHost = p.id === currentHostId;
        return `
            <li class="player-item ${isYou ? 'you' : ''} ${isHost ? 'host' : ''}">
                <span class="player-name">
                    ${isHost ? '👑 ' : ''}
                    ${p.name}
                    ${isYou ? ' (You)' : ''}
                </span>
                ${p.answer ? `<span class="answer">${p.answer}</span>` : ''}
                ${p.votes > 0 ? `<span class="votes">${p.votes} votes</span>` : ''}
            </li>
        `;
    }).join('');
}

socket.on('connect', () => {
    const username = localStorage.getItem('username') || 'Player';
    if (lobbyCode) {
        socket.emit('join_lobby', { code: lobbyCode, username });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lobby-code-display').textContent = lobbyCode;
});

function copyCode() {
    navigator.clipboard.writeText(lobbyCode);
    alert('Lobby code copied to clipboard!');
}

socket.on('lobby_state', (data) => {
    isHost = data.is_host;
    currentGame = data.game;
    players = data.players || [];
    currentHostId = data.host_id;

    document.getElementById('host-controls').classList.toggle('hidden', !isHost);
    if (data.game_data.state) {
        handleGameState(data.game_data);
    }
    updatePlayerList();
});

document.addEventListener('force_player_update', updatePlayerList);

function handleGameState(gameData) {
    document.querySelectorAll('.game-view').forEach(el => el.classList.add('hidden'));
    document.getElementById('game-area').classList.remove('hidden');
    
    switch(gameData.state) {
        case 'lobby':
            document.getElementById('game-area').classList.add('hidden');
            break;
            
        case 'playing':
            const impostersView = document.getElementById('imposters-game');
            impostersView.classList.remove('hidden');
            const player = players.find(p => p.id === socket.id);
            document.getElementById('your-word').textContent = 
                player.role === 'civilian' ? player.word : '???';
            players.forEach(p => p.votes = 0);
            updatePlayerList();
            break;
            
        case 'answering':
            const guessingView = document.getElementById('guessing-game');
            guessingView.classList.remove('hidden');
            const currentPlayer = players.find(p => p.id === socket.id);
            document.getElementById('your-question').textContent = currentPlayer.question;
            document.getElementById('answer-input').disabled = false;
            document.getElementById('answer-input').value = '';
            players.forEach(p => p.votes = 0);
            updatePlayerList();
            break;
            
        case 'voting':
            setupVoting();
            document.getElementById('voting-section').classList.remove('hidden');
            break;
            
        case 'results':
            showResults(gameData.results);
            document.getElementById('results-section').classList.remove('hidden');
            break;
    }
}

function setupVoting() {
    const container = document.querySelector('.vote-buttons');
    container.innerHTML = players
        .filter(p => p.id !== socket.id)
        .map(p => `
            <button class="vote-btn" onclick="submitVote('${p.id}')">
                ${p.name} ${p.id === currentHostId ? '👑' : ''} (${p.votes} votes)
            </button>
        `).join('');
}

function showResults(results) {
    const resultsDiv = document.getElementById('results-section');
    let html = '<div class="results-card">';
    
    if (currentGame === 'imposters') {
        html += `
            <h3>Round Results</h3>
            <p>Word was: ${results.word}</p>
            <p>Suspected: ${results.suspected.join(', ')}</p>
            <p>Actual Imposters: ${results.actual_imposters.join(', ')}</p>
            <p>${results.correct ? '✅ Correct guess!' : '❌ Wrong guess!'}</p>
        `;
    } else {
        html += `
            <h3>Truth Revealed</h3>
            ${Object.entries(results.questions).map(([name, q]) => `
                <div class="question-reveal">
                    <strong>${name}:</strong> ${q}<br>
                    <em>Answer: ${results.answers[name] || 'None'}</em>
                </div>
            `).join('')}
        `;
    }
    html += '</div>';
    resultsDiv.innerHTML = html;
}

function startGame() {
    const settings = {
        imposters: parseInt(document.getElementById('imposters-count').value) || 1,
        questionType: document.getElementById('question-type')?.value || 'random'
    };
    socket.emit('start_game', { code: lobbyCode, settings });
}

function endRound() {
    socket.emit('end_round', { code: lobbyCode });
}

function submitAnswer() {
    const answer = document.getElementById('answer-input').value.trim();
    if (answer) {
        socket.emit('submit_answer', { code: lobbyCode, answer });
        document.getElementById('answer-input').disabled = true;
    }
}

function submitVote(playerId) {
    socket.emit('submit_vote', { code: lobbyCode, target_id: playerId });
}

document.getElementById('game-select').addEventListener('change', () => {
    const game = document.getElementById('game-select').value;
    let settingsHtml = '';
    
    if (game === 'imposters') {
        settingsHtml = `
            <div class="setting-group">
                <label>Imposters:</label>
                <input type="number" id="imposters-count" min="1" max="3" value="1">
            </div>
            <div class="setting-group">
                <label>Question Type:</label>
                <select id="question-type">
                    <option value="random">Random</option>
                    <option value="personal">Personal</option>
                </select>
            </div>
        `;
    }
    
    document.getElementById('game-settings').innerHTML = settingsHtml;
});
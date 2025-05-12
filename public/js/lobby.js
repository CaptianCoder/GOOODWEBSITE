const socket = io();
let isHost = false;
let currentGame = null;
let lobbyCode = new URLSearchParams(window.location.search).get('code');

socket.on('connect', () => {
    if (lobbyCode) {
        socket.emit('join_lobby', {
            code: lobbyCode,
            username: localStorage.getItem('username') || 'Player'
        });
    }
});

socket.on('lobby_state', (data) => {
    isHost = data.is_host;
    currentGame = data.game;
    
    // Show host controls
    document.getElementById('host-controls').classList.toggle('hidden', !isHost);
    
    // Update game state
    if (data.game_data.state) {
        handleGameState(data.game_data);
    }
});

socket.on('player_update', (players) => {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = players.map(p => `
        <li>${p.name} ${p.id === socket.id ? '(You)' : ''}</li>
    `).join('');
    document.getElementById('player-count').textContent = players.length;
});

socket.on('game_update', (data) => {
    currentGame = data.game;
    handleGameState(data);
});

socket.on('game_started', (gameData) => {
    handleGameState(gameData);
    document.getElementById('end-round').classList.remove('hidden');
});

socket.on('round_results', (results) => {
    const resultsDiv = document.getElementById('results-section');
    resultsDiv.classList.remove('hidden');
    
    let html = '<h3>Results:</h3>';
    if (currentGame === 'imposters') {
        html += `
            <p>Suspected: ${results.suspected.join(', ')}</p>
            <p>Actual Imposters: ${results.actual_imposters.join(', ')}</p>
            <p>${results.correct ? 'Correct!' : 'Wrong!'}</p>
        `;
    } else {
        html += `
            <p>Suspected: ${results.suspected.join(', ')}</p>
            <p>Actual Imposters: ${results.actual_imposters.join(', ')}</p>
            <div class="questions-reveal">
                ${Object.entries(results.questions).map(([name, q]) => `
                    <p><strong>${name}:</strong> ${q}</p>
                `).join('')}
            </div>
        `;
    }
    
    resultsDiv.innerHTML = html;
});

// Game control functions
function updateGameSettings() {
    const game = document.getElementById('game-select').value;
    if (!game) return;

    let settingsHtml = '';
    if (game === 'imposters') {
        settingsHtml = `
            <label>Number of Imposters:</label>
            <input type="number" id="imposters-count" min="1" max="3" value="1">
            <label>Question Type:</label>
            <select id="question-type">
                <option value="random">Random</option>
                <option value="personal">Personal</option>
            </select>
        `;
    } else if (game === 'guessing') {
        settingsHtml = `
            <label>Imposter Questions:</label>
            <input type="number" id="imposters-count" min="1" max="3" value="1">
        `;
    }
    
    document.getElementById('game-settings').innerHTML = settingsHtml;
    socket.emit('set_game', {
        code: lobbyCode,
        game: game,
        settings: getCurrentSettings()
    });
}

function startGame() {
    socket.emit('start_game', {
        code: lobbyCode,
        settings: getCurrentSettings()
    });
}

function endRound() {
    socket.emit('end_round', { code: lobbyCode });
}

function handleGameState(gameData) {
    // Hide all game views
    document.querySelectorAll('.game-view').forEach(el => el.classList.add('hidden'));
    document.getElementById('voting-section').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');

    if (gameData.state === 'playing' && currentGame === 'imposters') {
        const player = getCurrentPlayer();
        document.getElementById('imposters-game').classList.remove('hidden');
        document.getElementById('your-word').textContent = 
            player.role === 'civilian' ? player.word : '???';
    }
    else if (gameData.state === 'answering' && currentGame === 'guessing') {
        const player = getCurrentPlayer();
        document.getElementById('guessing-game').classList.remove('hidden');
        document.getElementById('your-question').textContent = player.question;
    }

    if (gameData.state === 'voting') {
        setupVoting();
    }
}

function getCurrentPlayer() {
    return lobby.players.find(p => p.id === socket.id);
}

function setupVoting() {
    const votingSection = document.getElementById('voting-section');
    votingSection.classList.remove('hidden');
    
    votingSection.querySelector('.vote-buttons').innerHTML = 
        lobby.players.filter(p => p.id !== socket.id).map(p => `
            <button class="vote-btn" onclick="submitVote('${p.id}')">
                ${p.name}
            </button>
        `).join('');
}

function submitVote(playerId) {
    socket.emit('submit_vote', {
        code: lobbyCode,
        target_id: playerId
    });
}

function submitAnswer() {
    const answer = document.getElementById('answer-input').value;
    socket.emit('submit_answer', {
        code: lobbyCode,
        answer: answer
    });
}

// Helper functions
function getCurrentSettings() {
    const game = document.getElementById('game-select').value;
    if (game === 'imposters') {
        return {
            imposters: parseInt(document.getElementById('imposters-count').value),
            questionType: document.getElementById('question-type').value
        };
    }
    return {
        imposters: parseInt(document.getElementById('imposters-count').value)
    };
}
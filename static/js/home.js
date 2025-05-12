const socket = io();

// Show/hide forms properly
function showCreateLobby() {
    document.getElementById('create-lobby').classList.remove('hidden');
    document.getElementById('join-lobby').classList.add('hidden');
}

function showJoinLobby() {
    document.getElementById('join-lobby').classList.remove('hidden');
    document.getElementById('create-lobby').classList.add('hidden');
}

// Create lobby with username validation
function createLobby() {
    const username = document.getElementById('username-create').value.trim();
    if (username.length > 0) {
        localStorage.setItem('username', username);
        socket.emit('create_lobby', { username });
    } else {
        alert('Please enter a username!');
    }
}

// Update joinLobby function
function joinLobby() {
    const username = document.getElementById('username-join').value.trim();
    const codeInput = document.getElementById('lobby-code').value.trim().toUpperCase();
    
    if (!username) {
        alert('Please enter a username!');
        return;
    }
    if (!/^[A-Z0-9]{6}$/.test(codeInput)) {  // Allow numbers in code
        alert('Invalid code! Must be 6 characters');
        return;
    }
    
    localStorage.setItem('username', username);
    socket.emit('join_lobby', { 
        username: username,
        code: codeInput
    });
}

// Add error handling
socket.on('join_error', (error) => {
    alert(`Join failed: ${error.message}`);
});

// Socket handlers
socket.on('lobby_created', (data) => {
    window.location.href = `/lobby?code=${data.code}`;
});

socket.on('lobby_joined', (data) => {
    window.location.href = `/lobby?code=${data.code}`;
});

socket.on('error', (data) => {
    alert(`Error: ${data.message}`);
});
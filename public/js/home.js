const socket = io();

function showCreateLobby() {
    document.querySelectorAll('div').forEach(div => div.classList.add('hidden'));
    document.getElementById('create-lobby').classList.remove('hidden');
}

function showJoinLobby() {
    document.querySelectorAll('div').forEach(div => div.classList.add('hidden'));
    document.getElementById('join-lobby').classList.remove('hidden');
}

function createLobby() {
    const username = document.getElementById('username-create').value;
    if (username) {
        socket.emit('create_lobby', { username });
    }
}

function joinLobby() {
    const username = document.getElementById('username-join').value;
    const code = document.getElementById('lobby-code').value;
    if (username && code) {
        socket.emit('join_lobby', { username, code });
    }
}

socket.on('lobby_created', (data) => {
    window.location.href = `/lobby?code=${data.code}`;
});

socket.on('error', (data) => {
    alert(data.message);
});
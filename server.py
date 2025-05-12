from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, join_room, leave_room, emit
import random
import string
import json
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super_secret_key'
socketio = SocketIO(app, manage_session=False)

lobbies = {}
MAX_PLAYERS = 15

# Game configuration loader
def load_game_config(game):
    with open(f'games/{game}.json') as f:
        return json.load(f)

# Generate lobby code
def generate_code():
    return ''.join(random.choices(string.ascii_uppercase, k=6))

# Helper functions
def get_lobby(code):
    return lobbies.get(code.upper())

def get_player(code, sid):
    lobby = get_lobby(code)
    if lobby:
        return next((p for p in lobby['players'] if p['id'] == sid), None)
    return None

# Routes
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/lobby')
def lobby():
    return render_template('lobby.html')

# Socket Events
@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    for code, lobby in list(lobbies.items()):
        lobby['players'] = [p for p in lobby['players'] if p['id'] != request.sid]
        if not lobby['players']:
            del lobbies[code]
        else:
            if lobby['host'] == request.sid:
                lobby['host'] = lobby['players'][0]['id']
            emit('player_update', lobby['players'], room=code)

@socketio.on('create_lobby')
def handle_create_lobby(data):
    code = generate_code()
    lobbies[code] = {
        'host': request.sid,
        'players': [{'id': request.sid, 'name': data['username']}],
        'game': None,
        'settings': {},
        'game_data': {},
        'created_at': time.time()
    }
    join_room(code)
    emit('lobby_created', {'code': code})

@socketio.on('join_lobby')
def handle_join_lobby(data):
    code = data['code'].upper()
    lobby = get_lobby(code)
    if not lobby:
        emit('error', {'message': 'Invalid lobby code'})
        return
    if len(lobby['players']) >= MAX_PLAYERS:
        emit('error', {'message': 'Lobby is full'})
        return
    
    player = {
        'id': request.sid,
        'name': data['username'],
        'role': None,
        'answer': None,
        'votes': 0
    }
    lobby['players'].append(player)
    join_room(code)
    emit('player_update', lobby['players'], room=code)
    emit('lobby_state', {
        'is_host': lobby['host'] == request.sid,
        'game': lobby['game'],
        'settings': lobby['settings'],
        'game_data': lobby['game_data']
    })

@socketio.on('set_game')
def handle_set_game(data):
    code = data['code']
    lobby = get_lobby(code)
    if lobby['host'] != request.sid:
        return
    
    lobby['game'] = data['game']
    lobby['settings'] = data.get('settings', {})
    lobby['game_data'] = {}
    emit('game_update', {
        'game': lobby['game'],
        'settings': lobby['settings']
    }, room=code)

@socketio.on('start_game')
def handle_start_game(data):
    code = data['code']
    lobby = get_lobby(code)
    if lobby['host'] != request.sid:
        return
    
    game_config = load_game_config(lobby['game'])
    
    if lobby['game'] == 'imposters':
        # Assign roles
        players = lobby['players']
        num_imposters = min(lobby['settings'].get('imposters', 1), len(players)-1)
        imposters = random.sample(players, num_imposters)
        category = random.choice(list(game_config['categories'].keys()))
        word = random.choice(game_config['categories'][category])
        
        for player in players:
            if player in imposters:
                player['role'] = 'imposter'
                player['word'] = None
            else:
                player['role'] = 'civilian'
                player['word'] = word
            player['answer'] = None
            player['votes'] = 0
        
        lobby['game_data'] = {
            'state': 'playing',
            'category': category,
            'word': word,
            'round': 1
        }
    
    elif lobby['game'] == 'guessing':
        # Assign questions
        players = lobby['players']
        num_imposters = min(lobby['settings'].get('imposters', 1), len(players)-1)
        imposters = random.sample(players, num_imposters)
        normal_q = random.choice(game_config['normal_questions'])
        imposter_q = random.choice(game_config['imposter_questions'])
        
        for player in players:
            if player in imposters:
                player['role'] = 'imposter'
                player['question'] = imposter_q
            else:
                player['role'] = 'civilian'
                player['question'] = normal_q
            player['answer'] = None
            player['votes'] = 0
        
        lobby['game_data'] = {
            'state': 'answering',
            'round': 1
        }
    
    emit('game_started', lobby['game_data'], room=code)
    emit('player_update', lobby['players'], room=code)

@socketio.on('submit_answer')
def handle_submit_answer(data):
    code = data['code']
    lobby = get_lobby(code)
    player = get_player(code, request.sid)
    if not player:
        return
    
    player['answer'] = data['answer']
    emit('player_update', lobby['players'], room=code)

@socketio.on('submit_vote')
def handle_submit_vote(data):
    code = data['code']
    lobby = get_lobby(code)
    voter = get_player(code, request.sid)
    target = next((p for p in lobby['players'] if p['id'] == data['target_id']), None)
    
    if voter and target:
        target['votes'] += 1
        emit('player_update', lobby['players'], room=code)

@socketio.on('end_round')
def handle_end_round(data):
    code = data['code']
    lobby = get_lobby(code)
    if lobby['host'] != request.sid:
        return
    
    # Calculate results
    results = []
    if lobby['game'] == 'imposters':
        max_votes = max(p['votes'] for p in lobby['players'])
        suspected = [p for p in lobby['players'] if p['votes'] == max_votes]
        actual_imposters = [p for p in lobby['players'] if p['role'] == 'imposter']
        results = {
            'suspected': [p['name'] for p in suspected],
            'actual_imposters': [p['name'] for p in actual_imposters],
            'correct': any(p in actual_imposters for p in suspected)
        }
    elif lobby['game'] == 'guessing':
        max_votes = max(p['votes'] for p in lobby['players'])
        suspected = [p for p in lobby['players'] if p['votes'] == max_votes]
        actual_imposters = [p for p in lobby['players'] if p['role'] == 'imposter']
        results = {
            'suspected': [p['name'] for p in suspected],
            'actual_imposters': [p['name'] for p in actual_imposters],
            'questions': {p['name']: p['question'] for p in lobby['players']}
        }
    
    lobby['game_data']['state'] = 'results'
    emit('round_results', results, room=code)
    emit('game_update', lobby['game_data'], room=code)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8080, debug=True)
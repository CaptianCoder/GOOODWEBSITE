from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, join_room, leave_room, emit
import random
import string
import json
import time
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super_secret_key'
socketio = SocketIO(app, manage_session=False)

lobbies = {}
MAX_PLAYERS = 15

def load_game_config(game):
    with open(f'games/{game}.json') as f:
        return json.load(f)

def generate_code():
    return ''.join(random.choices(string.ascii_uppercase, k=6))

def get_lobby(code):
    return lobbies.get(code.upper())

def get_player(code, sid):
    lobby = get_lobby(code)
    if lobby:
        return next((p for p in lobby['players'] if p['id'] == sid), None)
    return None

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/lobby')
def lobby():
    return render_template('lobby.html')

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
        emit('player_update', lobby['players'], room=code)

@socketio.on('create_lobby')
def handle_create_lobby(data):
    code = generate_code()
    host_player = {
        'id': request.sid,
        'name': data['username'],
        'role': None,
        'answer': None,
        'votes': 0,
        'joined_at': datetime.now().isoformat()
    }
    lobbies[code] = {
        'host': request.sid,
        'players': [host_player],
        'game': None,
        'settings': {},
        'game_data': {'state': 'lobby'},
        'created_at': datetime.now().isoformat()
    }
    join_room(code)
    emit('lobby_created', {'code': code}, room=request.sid)
    emit('player_update', lobbies[code]['players'], room=code)

@socketio.on('join_lobby')
def handle_join_lobby(data):
    code = data['code'].upper().strip()
    if not code or len(code) != 6:
        emit('error', {'message': 'Invalid code format! Must be 6 characters'})
        return
    
    lobby = lobbies.get(code)
    if not lobby:
        emit('error', {'message': 'Lobby not found!'})
        return
    
    existing_player = next((p for p in lobby['players'] if p['id'] == request.sid), None)
    if existing_player:
        existing_player['name'] = data['username']
    else:
        if len(lobby['players']) >= MAX_PLAYERS:
            emit('error', {'message': 'Lobby is full!'})
            return
        
        new_player = {
            'id': request.sid,
            'name': data['username'],
            'role': None,
            'answer': None,
            'votes': 0,
            'joined_at': datetime.now().isoformat()
        }
        lobby['players'].append(new_player)
    
    join_room(code)
    emit('lobby_joined', {'code': code}, room=request.sid)
    emit('lobby_state', {
        'is_host': lobby['host'] == request.sid,
        'players': lobby['players'],
        'host_id': lobby['host'],
        'game': lobby['game'],
        'settings': lobby['settings'],
        'game_data': lobby['game_data']
    }, room=request.sid)
    emit('player_update', lobby['players'], room=code)

@socketio.on('start_game')
def handle_start_game(data):
    code = data['code'].upper()
    lobby = get_lobby(code)
    if not lobby or lobby['host'] != request.sid:
        return
    if not lobby['game']:
        emit('error', {'message': 'No game selected!'}, room=request.sid)
        return

    game_config = load_game_config(lobby['game'])
    players = lobby['players']
    
    for p in players:
        p['votes'] = 0
        p['answer'] = None

    if lobby['game'] == 'imposters':
        num_imposters = min(data['settings'].get('imposters', 1), len(players)-1)
        num_imposters = max(num_imposters, 1)
        imposters = random.sample(players, num_imposters)
        category = random.choice(list(game_config['categories'].keys()))
        word = random.choice(game_config['categories'][category])

        for player in players:
            player['role'] = 'imposter' if player in imposters else 'civilian'
            player['word'] = word if player['role'] == 'civilian' else None
            player['question'] = random.choice(game_config['questions'])

        lobby['game_data'] = {
            'state': 'playing',
            'category': category,
            'word': word,
            'round': lobby['game_data'].get('round', 0) + 1
        }

    elif lobby['game'] == 'guessing':
        num_imposters = min(data['settings'].get('imposters', 1), len(players)-1)
        num_imposters = max(num_imposters, 1)
        imposters = random.sample(players, num_imposters)
        normal_q = random.choice(game_config['normal_questions'])
        imposter_q = random.choice(game_config['imposter_questions'])

        for player in players:
            player['role'] = 'imposter' if player in imposters else 'civilian'
            player['question'] = imposter_q if player in imposters else normal_q

        lobby['game_data'] = {
            'state': 'answering',
            'round': lobby['game_data'].get('round', 0) + 1
        }

    emit('game_started', lobby['game_data'], room=code)
    emit('player_update', lobby['players'], room=code)

@socketio.on('submit_answer')
def handle_submit_answer(data):
    code = data['code'].upper()
    lobby = get_lobby(code)
    player = get_player(code, request.sid)
    if player and data.get('answer'):
        player['answer'] = data['answer']
        emit('player_update', lobby['players'], room=code)

@socketio.on('submit_vote')
def handle_submit_vote(data):
    code = data['code'].upper()
    lobby = get_lobby(code)
    voter = get_player(code, request.sid)
    target = next((p for p in lobby['players'] if p['id'] == data['target_id']), None)
    
    if voter and target and voter['id'] != target['id']:
        target['votes'] += 1
        emit('player_update', lobby['players'], room=code)

@socketio.on('end_round')
def handle_end_round(data):
    code = data['code'].upper()
    lobby = get_lobby(code)
    if not lobby or lobby['host'] != request.sid:
        return

    results = {}
    if lobby['game'] == 'imposters':
        actual_imposters = [p for p in lobby['players'] if p['role'] == 'imposter']
        max_votes = max(p['votes'] for p in lobby['players'])
        suspected = [p for p in lobby['players'] if p['votes'] == max_votes]
        
        results = {
            'word': lobby['game_data']['word'],
            'suspected': [p['name'] for p in suspected],
            'actual_imposters': [p['name'] for p in actual_imposters],
            'correct': any(p in actual_imposters for p in suspected)
        }
    elif lobby['game'] == 'guessing':
        results = {
            'questions': {p['name']: p['question'] for p in lobby['players']},
            'answers': {p['name']: p['answer'] for p in lobby['players']}
        }

    lobby['game_data']['state'] = 'results'
    emit('round_results', results, room=code)
    emit('game_update', lobby['game_data'], room=code)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8080, debug=True)
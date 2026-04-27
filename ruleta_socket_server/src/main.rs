use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tokio::{
    net::{TcpListener, TcpStream},
    sync::mpsc,
};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use uuid::Uuid;

type Tx = mpsc::UnboundedSender<String>;
type Clients = Arc<Mutex<HashMap<String, ClientInfo>>>;
type Rooms = Arc<Mutex<HashMap<String, RoomInfo>>>;

#[derive(Clone)]
struct ClientInfo {
    user_id: String,
    nickname: String,
    avatar: String,
    sender: Tx,
}

#[derive(Clone, Debug)]
struct GamePlayer {
    user_id: String,
    nickname: String,
    avatar: String,
    coins: i32,
}

#[derive(Clone, Debug)]
struct GameState {
    pot: i32,
    turn_index: usize,
    players: Vec<GamePlayer>,
    history: Vec<String>,
    game_started: bool,
    game_over: bool,
}

#[derive(Clone, Debug)]
struct RoomInfo {
    room_code: String,
    host_id: String,
    players: Vec<String>,
    game_state: Option<GameState>,
}

#[derive(Serialize, Deserialize, Debug)]
struct IncomingMessage {
    #[serde(rename = "type")]
    msg_type: String,
    payload: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug)]
struct OutgoingMessage {
    #[serde(rename = "type")]
    msg_type: String,
    payload: serde_json::Value,
}

#[tokio::main]
async fn main() {
    let address = "0.0.0.0:5000";

    let listener = TcpListener::bind(address)
        .await
        .expect("No se pudo iniciar el servidor");

    let clients: Clients = Arc::new(Mutex::new(HashMap::new()));
    let rooms: Rooms = Arc::new(Mutex::new(HashMap::new()));

    println!("Servidor WebSocket corriendo en ws://{}", address);

    while let Ok((stream, _)) = listener.accept().await {
        let clients_clone = Arc::clone(&clients);
        let rooms_clone = Arc::clone(&rooms);

        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, clients_clone, rooms_clone).await {
                eprintln!("Error en conexión: {}", e);
            }
        });
    }
}

async fn handle_connection(
    stream: TcpStream,
    clients: Clients,
    rooms: Rooms,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ws_stream = accept_async(stream).await?;
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let temp_id = Uuid::new_v4().to_string();

    {
        let mut clients_lock = clients.lock().unwrap();
        clients_lock.insert(
            temp_id.clone(),
            ClientInfo {
                user_id: temp_id.clone(),
                nickname: "Anónimo".to_string(),
                avatar: "😀".to_string(),
                sender: tx.clone(),
            },
        );
    }

    let clients_for_writer = Arc::clone(&clients);
    let temp_id_for_writer = temp_id.clone();

    let write_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }

        let mut clients_lock = clients_for_writer.lock().unwrap();
        clients_lock.remove(&temp_id_for_writer);
    });

    while let Some(msg_result) = ws_receiver.next().await {
        let msg = match msg_result {
            Ok(m) => m,
            Err(_) => break,
        };

        if !msg.is_text() {
            continue;
        }

        let text = match msg.to_text() {
            Ok(t) => t,
            Err(_) => continue,
        };

        let parsed: IncomingMessage = match serde_json::from_str(text) {
            Ok(p) => p,
            Err(_) => {
                send_error(&clients, &temp_id, "JSON inválido");
                continue;
            }
        };

        match parsed.msg_type.as_str() {
            "connect_user" => {
                let nickname = parsed
                    .payload
                    .get("nickname")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Anónimo")
                    .to_string();

                let avatar = parsed
                    .payload
                    .get("avatar")
                    .and_then(|v| v.as_str())
                    .unwrap_or("😀")
                    .to_string();

                {
                    let mut clients_lock = clients.lock().unwrap();
                    if let Some(client) = clients_lock.get_mut(&temp_id) {
                        client.nickname = nickname.clone();
                        client.avatar = avatar.clone();
                    }
                }

                let success_msg = OutgoingMessage {
                    msg_type: "connect_user_success".to_string(),
                    payload: serde_json::json!({
                        "userId": temp_id,
                        "nickname": nickname,
                        "avatar": avatar
                    }),
                };

                send_to_client(&clients, &temp_id, &success_msg);
            }

            "general_chat_message" => {
                let clients_lock = clients.lock().unwrap();
                let sender_client = match clients_lock.get(&temp_id) {
                    Some(c) => c.clone(),
                    None => continue,
                };
                drop(clients_lock);

                let message_text = parsed
                    .payload
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let broadcast_msg = OutgoingMessage {
                    msg_type: "general_chat_broadcast".to_string(),
                    payload: serde_json::json!({
                        "userId": sender_client.user_id,
                        "nickname": sender_client.nickname,
                        "avatar": sender_client.avatar,
                        "message": message_text
                    }),
                };

                broadcast_to_all(&clients, &broadcast_msg);
            }

            "create_room" => {
                let room_code = generate_room_code();

                let client_data = {
                    let clients_lock = clients.lock().unwrap();
                    clients_lock.get(&temp_id).cloned()
                };

                let client = match client_data {
                    Some(c) => c,
                    None => {
                        send_error(&clients, &temp_id, "Usuario no conectado");
                        continue;
                    }
                };

                {
                    let mut rooms_lock = rooms.lock().unwrap();

                    rooms_lock.insert(
                        room_code.clone(),
                        RoomInfo {
                            room_code: room_code.clone(),
                            host_id: temp_id.clone(),
                            players: vec![temp_id.clone()],
                            game_state: None,
                        },
                    );

                    println!("Sala creada: {}", room_code);
                    println!("Salas actuales: {:?}", rooms_lock.keys());
                }

                let response = OutgoingMessage {
                    msg_type: "create_room_success".to_string(),
                    payload: serde_json::json!({
                        "roomCode": room_code,
                        "hostId": temp_id,
                        "players": [
                            {
                                "userId": client.user_id,
                                "nickname": client.nickname,
                                "avatar": client.avatar
                            }
                        ],
                        "maxPlayers": 6,
                        "minPlayers": 2
                    }),
                };

                send_to_client(&clients, &client.user_id, &response);
                broadcast_active_rooms(&rooms, &clients);
            }

            "join_room" => {
                let room_code = parsed
                    .payload
                    .get("roomCode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_uppercase();

                if room_code.is_empty() {
                    send_error(&clients, &temp_id, "Código de sala vacío");
                    continue;
                }

                let client_data = {
                    let clients_lock = clients.lock().unwrap();
                    clients_lock.get(&temp_id).cloned()
                };

                let client = match client_data {
                    Some(c) => c,
                    None => {
                        send_error(&clients, &temp_id, "Usuario no conectado");
                        continue;
                    }
                };

                let player_ids = {
                    let mut rooms_lock = rooms.lock().unwrap();

                    let room = match rooms_lock.get_mut(&room_code) {
                        Some(r) => r,
                        None => {
                            send_error(&clients, &temp_id, "La sala no existe");
                            continue;
                        }
                    };

                    if room.players.len() >= 6 {
                        send_error(&clients, &temp_id, "La sala está llena");
                        continue;
                    }

                    if !room.players.contains(&temp_id) {
                        room.players.push(temp_id.clone());
                    }

                    println!("Usuario {} se unió a sala {}", client.nickname, room_code);

                    room.players.clone()
                };

                let players_payload = build_players_payload(&clients, &player_ids);
                let update_msg = OutgoingMessage {
                    msg_type: "room_players_update".to_string(),
                    payload: serde_json::json!({
                        "roomCode": room_code,
                        "players": players_payload
                    }),
                };

                send_to_room(&clients, &player_ids, &update_msg);

                let response = OutgoingMessage {
                    msg_type: "join_room_success".to_string(),
                    payload: serde_json::json!({
                        "roomCode": room_code,
                        "players": players_payload
                    }),
                };

                send_to_client(&clients, &client.user_id, &response);
                broadcast_active_rooms(&rooms, &clients);
            }

            "start_game" => {
                let room_code = parsed
                    .payload
                    .get("roomCode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_uppercase();

                if room_code.is_empty() {
                    send_error(&clients, &temp_id, "Código de sala vacío");
                    continue;
                }

                let (player_ids, game_payload) = {
                    let mut rooms_lock = rooms.lock().unwrap();

                    let room = match rooms_lock.get_mut(&room_code) {
                        Some(r) => r,
                        None => {
                            send_error(&clients, &temp_id, "La sala no existe");
                            continue;
                        }
                    };

                    if room.players.len() < 2 {
                        send_error(&clients, &temp_id, "Se necesitan al menos 2 jugadores");
                        continue;
                    }

                    let clients_lock = clients.lock().unwrap();

                    let mut game_players: Vec<GamePlayer> = Vec::new();

                    for player_id in &room.players {
                        if let Some(client) = clients_lock.get(player_id) {
                            game_players.push(GamePlayer {
                                user_id: client.user_id.clone(),
                                nickname: client.nickname.clone(),
                                avatar: client.avatar.clone(),
                                coins: 9,
                            });
                        }
                    }

                    let initial_pot = game_players.len() as i32;

                    let history = vec![
                        format!("La partida inició. Todos aportaron 1 moneda. Pozo inicial: {}", initial_pot)
                    ];

                    let game_state = GameState {
                        pot: initial_pot,
                        turn_index: 0,
                        players: game_players.clone(),
                        history: history.clone(),
                        game_started: true,
                        game_over: false,
                    };

                    room.game_state = Some(game_state);

                    let players_json: Vec<serde_json::Value> = game_players
                        .iter()
                        .map(|player| {
                            serde_json::json!({
                                "userId": player.user_id,
                                "nickname": player.nickname,
                                "avatar": player.avatar,
                                "coins": player.coins
                            })
                        })
                        .collect();

                    let turn_user_id = game_players[0].user_id.clone();

                    let payload = serde_json::json!({
                        "roomCode": room_code,
                        "pot": initial_pot,
                        "turnUserId": turn_user_id,
                        "turnIndex": 0,
                        "players": players_json,
                        "history": history,
                        "gameStarted": true,
                        "gameOver": false
                    });

                    (room.players.clone(), payload)
                };

                let response = OutgoingMessage {
                    msg_type: "game_started".to_string(),
                    payload: game_payload,
                };

                send_to_room(&clients, &player_ids, &response);
                broadcast_active_rooms(&rooms, &clients);
            }

            "spin_request" => {
                let room_code = parsed
                    .payload
                    .get("roomCode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_uppercase();

                if room_code.is_empty() {
                    send_error(&clients, &temp_id, "Código de sala vacío");
                    continue;
                }

                let (player_ids, response_payload) = {
                    let mut rooms_lock = rooms.lock().unwrap();

                    let room = match rooms_lock.get_mut(&room_code) {
                        Some(r) => r,
                        None => {
                            send_error(&clients, &temp_id, "La sala no existe");
                            continue;
                        }
                    };

                    let game_state = match room.game_state.as_mut() {
                        Some(gs) => gs,
                        None => {
                            send_error(&clients, &temp_id, "No hay partida activa");
                            continue;
                        }
                    };

                    let current_player = match game_state.players.get(game_state.turn_index) {
                        Some(p) => p.clone(),
                        None => {
                            send_error(&clients, &temp_id, "Turno inválido");
                            continue;
                        }
                    };

                    if current_player.coins <= 0 {
                        game_state.turn_index =
                            find_next_active_turn_index(game_state, game_state.turn_index);
                    }

                    let current_player = match game_state.players.get(game_state.turn_index) {
                        Some(p) => p.clone(),
                        None => {
                            send_error(&clients, &temp_id, "Turno inválido");
                            continue;
                        }
                    };

                    if current_player.user_id != temp_id {
                        send_error(&clients, &temp_id, "No es tu turno");
                        continue;
                    }

                    let selected_index = random_ruleta_index();
                    let result = ruleta_result_by_index(selected_index);

                    let mut winner_nickname = String::new();

                    match result.as_str() {
                        "Pon una" => {
                            if game_state.players[game_state.turn_index].coins >= 1 {
                                game_state.players[game_state.turn_index].coins -= 1;
                                game_state.pot += 1;
                            }
                        }
                        "Pon dos" => {
                            if game_state.players[game_state.turn_index].coins >= 2 {
                                game_state.players[game_state.turn_index].coins -= 2;
                                game_state.pot += 2;
                            } else if game_state.players[game_state.turn_index].coins == 1 {
                                game_state.players[game_state.turn_index].coins -= 1;
                                game_state.pot += 1;
                            }
                        }
                        "Toma una" => {
                            if game_state.pot >= 1 {
                                game_state.pot -= 1;
                                game_state.players[game_state.turn_index].coins += 1;
                            }
                        }
                        "Toma dos" => {
                            if game_state.pot >= 2 {
                                game_state.pot -= 2;
                                game_state.players[game_state.turn_index].coins += 2;
                            } else if game_state.pot == 1 {
                                game_state.pot -= 1;
                                game_state.players[game_state.turn_index].coins += 1;
                            }
                        }
                        "Todos ponen" => {
                            for player in game_state.players.iter_mut() {
                                if player.coins >= 1 {
                                    player.coins -= 1;
                                    game_state.pot += 1;
                                }
                            }
                        }
                        "Toma todo" => {
                            if game_state.pot > 0 {
                                game_state.players[game_state.turn_index].coins += game_state.pot;
                                game_state.pot = 0;
                            }

                            game_state.game_over = true;
                            winner_nickname = game_state.players[game_state.turn_index].nickname.clone();
                        }
                        _ => {}
                    }
                    if game_state.pot == 0 && result != "Toma todo" && !game_state.game_over {
                        let mut aportes = 0;

                        for player in game_state.players.iter_mut() {
                            if player.coins > 0 {
                                player.coins -= 1;
                                game_state.pot += 1;
                                aportes += 1;
                            }
                        }

                        if aportes > 0 {
                            game_state.history.push(format!(
                                "El pozo quedó en 0. Todos los jugadores activos aportaron 1 moneda. Nuevo pozo: {}",
                                game_state.pot
                            ));
                        }
                    }

                    let current_nickname = game_state.players[game_state.turn_index].nickname.clone();
                    let current_avatar = game_state.players[game_state.turn_index].avatar.clone();

                    let history_entry = format!(
                        "{} {} obtuvo: {}. Pozo: {}",
                        current_avatar, current_nickname, result, game_state.pot
                    );

                    game_state.history.push(history_entry.clone());

                    if !game_state.game_over {
                        let active_count = active_players_count(game_state);

                        if active_count <= 1 {
                            if let Some(winner) = find_last_active_player(game_state) {
                                game_state.game_over = true;
                                winner_nickname = winner.nickname.clone();

                                game_state.history.push(format!(
                                    "🏆 {} gana la partida por ser el último jugador con monedas",
                                    winner.nickname
                                ));
                            }
                        } else {
                            game_state.turn_index =
                                find_next_active_turn_index(game_state, game_state.turn_index);
                        }
                    } else {
                        game_state
                            .history
                            .push(format!("🏆 Ganador de la sala {}: {}", room_code, winner_nickname));
                    }

                    let players_json: Vec<serde_json::Value> = game_state
                        .players
                        .iter()
                        .map(|player| {
                            serde_json::json!({
                                "userId": player.user_id,
                                "nickname": player.nickname,
                                "avatar": player.avatar,
                                "coins": player.coins
                            })
                        })
                        .collect();

                    let turn_user_id = game_state
                        .players
                        .get(game_state.turn_index)
                        .map(|p| p.user_id.clone())
                        .unwrap_or_default();

                    let payload = serde_json::json!({
                        "roomCode": room_code,
                        "currentUserId": current_player.user_id,
                        "currentNickname": current_nickname,
                        "result": result,
                        "selectedIndex": selected_index,
                        "pot": game_state.pot,
                        "turnIndex": game_state.turn_index,
                        "turnUserId": turn_user_id,
                        "players": players_json,
                        "history": game_state.history,
                        "gameOver": game_state.game_over,
                        "winnerNickname": winner_nickname
                    });

                    (room.players.clone(), payload)
                };

                let response = OutgoingMessage {
                    msg_type: "spin_result".to_string(),
                    payload: response_payload,
                };

                send_to_room(&clients, &player_ids, &response);
                broadcast_active_rooms(&rooms, &clients);
            }

            "room_chat_message" => {
                let room_code = parsed
                    .payload
                    .get("roomCode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_uppercase();

                let message_text = parsed
                    .payload
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                if room_code.is_empty() {
                    send_error(&clients, &temp_id, "Código de sala vacío");
                    continue;
                }

                if message_text.trim().is_empty() {
                    send_error(&clients, &temp_id, "Mensaje vacío");
                    continue;
                }

                let client_data = {
                    let clients_lock = clients.lock().unwrap();
                    clients_lock.get(&temp_id).cloned()
                };

                let client = match client_data {
                    Some(c) => c,
                    None => {
                        send_error(&clients, &temp_id, "Usuario no conectado");
                        continue;
                    }
                };

                let player_ids = {
                    let rooms_lock = rooms.lock().unwrap();

                    let room = match rooms_lock.get(&room_code) {
                        Some(r) => r,
                        None => {
                            send_error(&clients, &temp_id, "La sala no existe");
                            continue;
                        }
                    };

                    if !room.players.contains(&temp_id) {
                        send_error(&clients, &temp_id, "No perteneces a esta sala");
                        continue;
                    }

                    room.players.clone()
                };

                let response = OutgoingMessage {
                    msg_type: "room_chat_broadcast".to_string(),
                    payload: serde_json::json!({
                        "roomCode": room_code,
                        "userId": client.user_id,
                        "nickname": client.nickname,
                        "avatar": client.avatar,
                        "message": message_text
                    }),
                };

                send_to_room(&clients, &player_ids, &response);
            }

            "restart_game_keep_coins" => {
                let room_code = parsed
                    .payload
                    .get("roomCode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_uppercase();

                if room_code.is_empty() {
                    send_error(&clients, &temp_id, "Código de sala vacío");
                    continue;
                }

                let (player_ids, game_payload) = {
                    let mut rooms_lock = rooms.lock().unwrap();

                    let room = match rooms_lock.get_mut(&room_code) {
                        Some(r) => r,
                        None => {
                            send_error(&clients, &temp_id, "La sala no existe");
                            continue;
                        }
                    };

                    let game_state = match room.game_state.as_mut() {
                        Some(gs) => gs,
                        None => {
                            send_error(&clients, &temp_id, "No hay una partida para reiniciar");
                            continue;
                        }
                    };

                    if !game_state.game_over {
                        send_error(&clients, &temp_id, "La partida actual todavía no ha terminado");
                        continue;
                    }

                    if game_state.players.len() < 2 {
                        send_error(&clients, &temp_id, "Se necesitan al menos 2 jugadores");
                        continue;
                    }

                    let mut new_pot = 0;

                    for player in game_state.players.iter_mut() {
                        if player.coins >= 1 {
                            player.coins -= 1;
                            new_pot += 1;
                        }
                    }

                    if new_pot < 2 {
                        send_error(&clients, &temp_id, "No hay suficientes jugadores con monedas para reiniciar");
                        continue;
                    }

                    game_state.pot = new_pot;
                    game_state.turn_index = 0;
                    game_state.game_started = true;
                    game_state.game_over = false;
                    game_state.history = vec![format!(
                        "Nueva partida iniciada con monedas actuales. Pozo inicial: {}",
                        new_pot
                    )];

                    let players_json: Vec<serde_json::Value> = game_state
                        .players
                        .iter()
                        .map(|player| {
                            serde_json::json!({
                                "userId": player.user_id,
                                "nickname": player.nickname,
                                "avatar": player.avatar,
                                "coins": player.coins
                            })
                        })
                        .collect();

                    let turn_user_id = game_state
                        .players
                        .get(game_state.turn_index)
                        .map(|p| p.user_id.clone())
                        .unwrap_or_default();

                    let payload = serde_json::json!({
                        "roomCode": room_code,
                        "pot": game_state.pot,
                        "turnIndex": game_state.turn_index,
                        "turnUserId": turn_user_id,
                        "players": players_json,
                        "history": game_state.history,
                        "gameStarted": true,
                        "gameOver": false
                    });

                    (room.players.clone(), payload)
                };

                let response = OutgoingMessage {
                    msg_type: "game_restarted_keep_coins".to_string(),
                    payload: game_payload,
                };

                send_to_room(&clients, &player_ids, &response);
            }

            "observer_connect" => {
                let response = OutgoingMessage {
                    msg_type: "observer_connect_success".to_string(),
                    payload: serde_json::json!({
                        "message": "Observador conectado correctamente"
                    }),
                };

                send_to_client(&clients, &temp_id, &response);
                broadcast_active_rooms(&rooms, &clients);
            }

            _ => {
                send_error(&clients, &temp_id, "Tipo de mensaje no soportado todavía");
            }
        }
    }

    write_task.abort();

    {
        let mut clients_lock = clients.lock().unwrap();
        clients_lock.remove(&temp_id);
    }

    Ok(())
}

fn send_to_client(clients: &Clients, client_id: &str, msg: &OutgoingMessage) {
    let serialized = match serde_json::to_string(msg) {
        Ok(s) => s,
        Err(_) => return,
    };

    let clients_lock = clients.lock().unwrap();
    if let Some(client) = clients_lock.get(client_id) {
        let _ = client.sender.send(serialized);
    }
}

fn broadcast_to_all(clients: &Clients, msg: &OutgoingMessage) {
    let serialized = match serde_json::to_string(msg) {
        Ok(s) => s,
        Err(_) => return,
    };

    let clients_lock = clients.lock().unwrap();
    for client in clients_lock.values() {
        let _ = client.sender.send(serialized.clone());
    }
}

fn send_error(clients: &Clients, client_id: &str, error_message: &str) {
    let error_msg = OutgoingMessage {
        msg_type: "error".to_string(),
        payload: serde_json::json!({
            "message": error_message
        }),
    };

    send_to_client(clients, client_id, &error_msg);
}

fn generate_room_code() -> String {
    let id = Uuid::new_v4().to_string();
    id.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(6)
        .collect::<String>()
        .to_uppercase()
}

fn build_players_payload(
    clients: &Clients,
    player_ids: &Vec<String>,
) -> Vec<serde_json::Value> {
    let clients_lock = clients.lock().unwrap();

    player_ids
        .iter()
        .filter_map(|id| clients_lock.get(id))
        .map(|client| {
            serde_json::json!({
                "userId": client.user_id,
                "nickname": client.nickname,
                "avatar": client.avatar
            })
        })
        .collect()
}

fn send_to_room(clients: &Clients, player_ids: &Vec<String>, msg: &OutgoingMessage) {
    let serialized = match serde_json::to_string(msg) {
        Ok(s) => s,
        Err(_) => return,
    };

    let clients_lock = clients.lock().unwrap();

    for player_id in player_ids {
        if let Some(client) = clients_lock.get(player_id) {
            let _ = client.sender.send(serialized.clone());
        }
    }
}

fn random_ruleta_index() -> usize {
    let id = Uuid::new_v4().to_string();
    let first_char = id.chars().next().unwrap_or('0') as usize;
    first_char % 6
}

fn ruleta_result_by_index(index: usize) -> String {
    let options = [
        "Pon una",
        "Pon dos",
        "Toma una",
        "Toma dos",
        "Todos ponen",
        "Toma todo",
    ];

    options[index].to_string()
}

fn build_active_rooms_payload(rooms: &Rooms, clients: &Clients) -> serde_json::Value {
    let rooms_lock = rooms.lock().unwrap();
    let clients_lock = clients.lock().unwrap();

    let rooms_json: Vec<serde_json::Value> = rooms_lock
        .values()
        .map(|room| {
            let players_json: Vec<serde_json::Value> = room
                .players
                .iter()
                .filter_map(|player_id| clients_lock.get(player_id))
                .map(|client| {
                    serde_json::json!({
                        "userId": client.user_id,
                        "nickname": client.nickname,
                        "avatar": client.avatar
                    })
                })
                .collect();

            let status = match &room.game_state {
                Some(game_state) => {
                    if game_state.game_over {
                        "finished"
                    } else if game_state.game_started {
                        "playing"
                    } else {
                        "waiting"
                    }
                }
                None => "waiting",
            };

            let game_data = match &room.game_state {
                Some(game_state) => {
                    let turn_player = game_state
                        .players
                        .get(game_state.turn_index)
                        .map(|player| {
                            serde_json::json!({
                                "userId": player.user_id,
                                "nickname": player.nickname,
                                "avatar": player.avatar
                            })
                        });

                    let game_players_json: Vec<serde_json::Value> = game_state
                        .players
                        .iter()
                        .map(|player| {
                            serde_json::json!({
                                "userId": player.user_id,
                                "nickname": player.nickname,
                                "avatar": player.avatar,
                                "coins": player.coins
                            })
                        })
                        .collect();

                    serde_json::json!({
                        "pot": game_state.pot,
                        "turnIndex": game_state.turn_index,
                        "turnPlayer": turn_player,
                        "players": game_players_json,
                        "history": game_state.history,
                        "gameStarted": game_state.game_started,
                        "gameOver": game_state.game_over
                    })
                }
                None => {
                    serde_json::json!({
                        "pot": 0,
                        "turnIndex": 0,
                        "turnPlayer": null,
                        "players": players_json,
                        "history": [],
                        "gameStarted": false,
                        "gameOver": false
                    })
                }
            };

            serde_json::json!({
                "roomCode": room.room_code,
                "hostId": room.host_id,
                "status": status,
                "players": players_json,
                "game": game_data
            })
        })
        .collect();

    serde_json::json!({
        "rooms": rooms_json
    })
}

fn broadcast_active_rooms(rooms: &Rooms, clients: &Clients) {
    let payload = build_active_rooms_payload(rooms, clients);

    let msg = OutgoingMessage {
        msg_type: "active_rooms_update".to_string(),
        payload,
    };

    broadcast_to_all(clients, &msg);
}

fn active_players_count(game_state: &GameState) -> usize {
    game_state
        .players
        .iter()
        .filter(|player| player.coins > 0)
        .count()
}

fn find_next_active_turn_index(game_state: &GameState, current_index: usize) -> usize {
    let total_players = game_state.players.len();

    for offset in 1..=total_players {
        let next_index = (current_index + offset) % total_players;

        if game_state.players[next_index].coins > 0 {
            return next_index;
        }
    }

    current_index
}

fn find_last_active_player(game_state: &GameState) -> Option<GamePlayer> {
    game_state
        .players
        .iter()
        .find(|player| player.coins > 0)
        .cloned()
}
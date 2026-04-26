import React, {useEffect,useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  Player,
  crearCodigoSala,
  crearJugadoresIniciales,
  iniciarPartidaLogic,
  aplicarResultadoRuleta,
  opcionesRuleta,
} from '../utils/gameLogic';
import {socketService} from '../services/socketService';

type Props = {
  route: any;
  navigation: any;
};

const GameScreen = ({route, navigation}: Props) => {
  const {nickname, avatar, roomMode, roomCodeInput} = route.params;

  const initialPlayers: Player[] = crearJugadoresIniciales(nickname, avatar);
  const codigoInicialSala =
    roomMode === 'unirse' && roomCodeInput
      ? roomCodeInput
      : crearCodigoSala();

  const [roomCode, setRoomCode] = useState(codigoInicialSala);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [pot, setPot] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [resultado, setResultado] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [turnIndex, setTurnIndex] = useState(0);
  const [winner, setWinner] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(
    null,
  );
  const [isSpinning, setIsSpinning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Desconectado');
  const [accessType, setAccessType] = useState('');
  const [serverMessages, setServerMessages] = useState<string[]>([]);
  const [localUserId, setLocalUserId] = useState('');
  const [roomChatMessages, setRoomChatMessages] = useState<string[]>([]);
  const [roomMessageText, setRoomMessageText] = useState('');
  const [generalMessageText, setGeneralMessageText] = useState('');

  const iniciarPartida = () => {
  if (gameStarted) {
    return;
  }

  socketService.startGame(roomCode);
  };

 useEffect(() => {
  socketService.connect(
    nickname,
    avatar,
    data => {
      if (data.type === 'connect_user_success') {
        setConnectionStatus('Conectado');
        setLocalUserId(data.payload.userId);
        setServerMessages(prev => [
          ...prev,
          `Servidor: usuario conectado correctamente (${data.payload.nickname})`,
        ]);

        if (roomMode === 'crear') {
          socketService.createRoom();
        } else {
          socketService.joinRoom(roomCodeInput);
        }
      }

      if (data.type === 'general_chat_broadcast') {
        setServerMessages(prev => [
          ...prev,
          `Chat general - ${data.payload.avatar} ${data.payload.nickname}: ${data.payload.message}`,
        ]);
      }

      if (data.type === 'create_room_success') {
        setRoomCode(data.payload.roomCode);

        const realPlayers = data.payload.players.map(
          (player: any, index: number) => ({
            id: index + 1,
            userId: player.userId,
            nickname: player.nickname,
            avatar: player.avatar,
            coins: 10,
          }),
        );

        setPlayers(realPlayers);

        setServerMessages(prev => [
          ...prev,
          `Sala creada correctamente: ${data.payload.roomCode}`,
        ]);
      }
      if (data.type === 'game_started') {
        setPot(data.payload.pot);
        setGameStarted(data.payload.gameStarted);
        setGameOver(data.payload.gameOver);
        setTurnIndex(data.payload.turnIndex);
        setResultado('La partida ha iniciado');

        const realPlayers = data.payload.players.map((player: any, index: number) => ({
          id: index + 1,
          userId: player.userId,
          nickname: player.nickname,
          avatar: player.avatar,
          coins: player.coins,
        }));

        setPlayers(realPlayers);
        setHistory(data.payload.history);

        setServerMessages(prev => [
          ...prev,
          `Partida iniciada en sala ${data.payload.roomCode}`,
        ]);
      }
      if (
        (data.type === 'join_room_success' ||
        data.type === 'room_players_update')&&
         !gameStarted) {
        setRoomCode(data.payload.roomCode);

        const realPlayers = data.payload.players.map(
          (player: any, index: number) => ({
            id: index + 1,
            userId: player.userId,
            nickname: player.nickname,
            avatar: player.avatar,
            coins: 10,
          }),
        );

        setPlayers(realPlayers);

        setServerMessages(prev => [
          ...prev,
          `Jugadores actualizados en sala ${data.payload.roomCode}`,
        ]);
      }

      if (data.type === 'error') {
        setServerMessages(prev => [
          ...prev,
          `Error servidor: ${data.payload.message}`,
        ]);
      }

      if (data.type === 'spin_result') {
        setPot(data.payload.pot);
        setGameOver(data.payload.gameOver);
        setTurnIndex(data.payload.turnIndex);
        setWinner(data.payload.winnerNickname || '');
        setResultado(data.payload.result);
        setSelectedOptionIndex(data.payload.selectedIndex);

        const realPlayers = data.payload.players.map((player: any, index: number) => ({
          id: index + 1,
          userId: player.userId,
          nickname: player.nickname,
          avatar: player.avatar,
          coins: player.coins,
        }));

        setPlayers(realPlayers);
        setHistory(data.payload.history);

        setServerMessages(prev => [
          ...prev,
          `${data.payload.currentNickname} obtuvo: ${data.payload.result}`,
        ]);
      }

      if (data.type === 'room_chat_broadcast') {
        setRoomChatMessages(prev => [
         ...prev,
         `${data.payload.avatar} ${data.payload.nickname}: ${data.payload.message}`,
  ]);
}
      if (data.type === 'game_restarted_keep_coins') {
        setPot(data.payload.pot);
        setGameStarted(data.payload.gameStarted);
        setGameOver(data.payload.gameOver);
        setTurnIndex(data.payload.turnIndex);
        setWinner('');
        setResultado('Nueva partida iniciada');
        setSelectedOptionIndex(null);

        const realPlayers = data.payload.players.map((player: any, index: number) => ({
          id: index + 1,
          userId: player.userId,
          nickname: player.nickname,
          avatar: player.avatar,
          coins: player.coins,
        }));

        setPlayers(realPlayers);
        setHistory(data.payload.history);

        setServerMessages(prev => [
          ...prev,
          `Nueva partida iniciada en sala ${data.payload.roomCode}`,
        ]);
      }
    },

      
    status => {
      setConnectionStatus(status);
    },
  );

  setAccessType(roomMode === 'crear' ? 'Crear sala' : 'Unirse a sala');



  return () => {
    socketService.disconnect();
  };
}, []);

  const enviarMensajeSala = () => {
  if (!roomMessageText.trim()) {
    return;
  }

  socketService.sendRoomMessage(roomCode, roomMessageText.trim());
  setRoomMessageText('');
};

  const girarRuleta = () => {
  if (!gameStarted || gameOver || isSpinning) {
    return;
  }

  socketService.spin(roomCode);
};

    
  const reiniciarPartida = () => {
    if (isSpinning) {
      return;
    }

    setPlayers(crearJugadoresIniciales(nickname, avatar));
    setPot(0);
    setGameStarted(false);
    setResultado('');
    setGameOver(false);
    setTurnIndex(0);
    setWinner('');
    setHistory([]);
    setSelectedOptionIndex(null);

    if (roomMode === 'crear') {
      setRoomCode(crearCodigoSala());
    } else {
      setRoomCode(roomCodeInput);
    }
  };

  const volverAlInicio = () => {
    if (isSpinning) {
      return;
    }

    navigation.navigate('LoginScreen');
  };

  const enviarMensajeGeneral = () => {
  if (!generalMessageText.trim()) {
    return;
  }

  socketService.sendGeneralMessage(generalMessageText.trim());
  setGeneralMessageText('');
};

const reiniciarConMonedasActuales = () => {
  if (!gameOver) {
    return;
  }

  socketService.restartGameKeepCoins(roomCode);
};


  const currentPlayer = players[turnIndex];
  const mainPlayer = players.find(player => player.userId === localUserId) || players[0];
  const isMyTurn = currentPlayer?.userId === localUserId;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Ruleta Game</Text>

      <View style={styles.roomBox}>
        <Text style={styles.roomTitle}>Sala</Text>
        <Text style={styles.roomCode}>{roomCode}</Text>
        <Text style={styles.roomInfo}>
          Modo:{accessType}</Text>
        <Text style={styles.roomInfo}>Estado de conexión: {connectionStatus}</Text>
        <Text style={styles.roomInfo}>Jugadores conectados: {players.length}</Text>
        <Text style={styles.roomInfo}>
          Tu perfil: {mainPlayer.avatar} {mainPlayer.nickname}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>Pozo principal: {pot}</Text>
        <Text style={styles.infoText}>
          Estado:{' '}
          {gameOver
            ? 'Juego terminado'
            : gameStarted
            ? 'Partida iniciada'
            : 'Esperando inicio'}
        </Text>

        {gameStarted && !gameOver && currentPlayer ? (
          <Text style={styles.turnText}>
            Turno de: {currentPlayer.avatar} {currentPlayer.nickname}
          </Text>
        ) : null}

        {gameOver && winner ? (
          <Text style={styles.winnerText}>Ganador: {winner}</Text>
        ) : null}

        <Text style={styles.resultText}>
          Resultado: {resultado || 'Sin giro todavía'}
        </Text>
      </View>

      <View style={styles.wheelBox}>
        <Text style={styles.sectionTitle}>Ruleta</Text>
        <View style={styles.wheelGrid}>
          {opcionesRuleta.map((item, index) => (
            <View
              key={index}
              style={[
                styles.wheelOption,
                selectedOptionIndex === index ? styles.wheelOptionSelected : null,
              ]}>
              <Text
                style={[
                  styles.wheelOptionText,
                  selectedOptionIndex === index
                    ? styles.wheelOptionTextSelected
                    : null,
                ]}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.playersBox}>
        <Text style={styles.sectionTitle}>Jugadores</Text>
        {players.map((player, index) => (
          <View
            key={player.id}
            style={[
              styles.playerRow,
              index === turnIndex && gameStarted && !gameOver
                ? styles.activePlayerRow
                : null,
            ]}>
            <Text style={styles.playerText}>
              {player.avatar} {player.nickname} - Monedas: {player.coins}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.historyBox}>
        <Text style={styles.sectionTitle}>Historial</Text>
        {history.length === 0 ? (
          <Text style={styles.historyText}>Sin movimientos todavía</Text>
        ) : (
          history.map((item, index) => (
            <Text key={index} style={styles.historyText}>
              • {item}
            </Text>
          ))
        )}
      </View>
      <View style={styles.historyBox}>
  <Text style={styles.sectionTitle}>Mensajes del servidor</Text>
  {serverMessages.length === 0 ? (
    <Text style={styles.historyText}>Sin mensajes todavía</Text>
  ) : (
    serverMessages.map((item, index) => (
      <Text key={index} style={styles.historyText}>
        • {item}
      </Text>
    ))
  )}
  </View>

  <View style={styles.historyBox}>
  <Text style={styles.sectionTitle}>Chat de sala</Text>

  {roomChatMessages.length === 0 ? (
    <Text style={styles.historyText}>Sin mensajes en la sala</Text>
  ) : (
    roomChatMessages.map((item, index) => (
      <Text key={index} style={styles.historyText}>
        • {item}
      </Text>
    ))
  )}

  <TextInput
    style={styles.input}
    placeholder="Escribe un mensaje para la sala"
    value={roomMessageText}
    onChangeText={setRoomMessageText}
  />

  <TouchableOpacity style={styles.testButton} onPress={enviarMensajeSala}>
    <Text style={styles.buttonText}>Enviar a la sala</Text>
  </TouchableOpacity>
</View>
 
      {!gameStarted ? (
  <TouchableOpacity style={styles.button} onPress={iniciarPartida}>
    <Text style={styles.buttonText}>Iniciar partida</Text>
  </TouchableOpacity>
) : (
  <TouchableOpacity
    style={[
      styles.button,
      (gameOver || isSpinning || !isMyTurn) && styles.buttonDisabled,
    ]}
    onPress={girarRuleta}
    disabled={gameOver || isSpinning || !isMyTurn}>
    <Text style={styles.buttonText}>
      {gameOver
        ? 'Juego finalizado'
        : isSpinning
        ? 'Girando...'
        : !isMyTurn
        ? 'Esperando turno'
        : 'Girar ruleta'}
    </Text>
  </TouchableOpacity>
)}

    {gameOver ? (
  <TouchableOpacity
    style={styles.keepCoinsButton}
    onPress={reiniciarConMonedasActuales}>
    <Text style={styles.buttonText}>Nueva partida con monedas actuales</Text>
  </TouchableOpacity>
) : null}

      <TouchableOpacity
        style={[styles.resetButton, isSpinning && styles.buttonDisabled]}
        onPress={reiniciarPartida}
        disabled={isSpinning}>
        <Text style={styles.buttonText}>Reiniciar partida</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.backButton, isSpinning && styles.buttonDisabled]}
        onPress={volverAlInicio}
        disabled={isSpinning}>
        <Text style={styles.buttonText}>Volver al inicio</Text>
      </TouchableOpacity>
      <View style={styles.historyBox}>
  <Text style={styles.sectionTitle}>Chat general</Text>

  <TextInput
    style={styles.input}
    placeholder="Escribe un mensaje general"
    value={generalMessageText}
    onChangeText={setGeneralMessageText}
  />

  <TouchableOpacity style={styles.testButton} onPress={enviarMensajeGeneral}>
    <Text style={styles.buttonText}>Enviar mensaje general</Text>
  </TouchableOpacity>
</View>
    </ScrollView>

    
    );
  
  
};



export default GameScreen;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F5F7FB',
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 20,
  },
  roomBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D9E1F2',
  },
  roomTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  roomCode: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#355DA8',
    marginBottom: 10,
    letterSpacing: 2,
  },
  roomInfo: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 6,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D9E1F2',
  },
  infoText: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  turnText: {
    fontSize: 20,
    marginTop: 5,
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#355DA8',
  },
  winnerText: {
    fontSize: 22,
    marginTop: 5,
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#1E8449',
  },
  resultText: {
    fontSize: 18,
    marginTop: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  wheelBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D9E1F2',
  },
  wheelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wheelOption: {
    width: '48%',
    backgroundColor: '#EEF3FF',
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C9D8F2',
  },
  wheelOptionSelected: {
    backgroundColor: '#355DA8',
    borderColor: '#355DA8',
  },
  wheelOptionText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2D3D',
  },
  wheelOptionTextSelected: {
    color: '#FFFFFF',
  },
  playersBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D9E1F2',
  },
  historyBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#D9E1F2',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  playerRow: {
    marginBottom: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activePlayerRow: {
    backgroundColor: '#DCE8FF',
  },
  playerText: {
    fontSize: 18,
    textAlign: 'center',
  },
  historyText: {
    fontSize: 16,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#355DA8',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 15,
    alignSelf: 'center',
  },
  resetButton: {
    backgroundColor: '#C0392B',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginBottom: 15,
    alignSelf: 'center',
  },
  backButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignSelf: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#7E9ACF',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  testButton: {
  backgroundColor: '#1E8449',
  paddingVertical: 14,
  paddingHorizontal: 30,
  borderRadius: 10,
  marginBottom: 15,
  alignSelf: 'center',
},
input: {
  borderWidth: 1,
  borderColor: '#CCC',
  borderRadius: 10,
  paddingHorizontal: 15,
  paddingVertical: 10,
  marginTop: 10,
  marginBottom: 10,
  backgroundColor: '#FFF',
},
keepCoinsButton: {
  backgroundColor: '#8E44AD',
  paddingVertical: 14,
  paddingHorizontal: 30,
  borderRadius: 10,
  marginBottom: 15,
  alignSelf: 'center',
},
});
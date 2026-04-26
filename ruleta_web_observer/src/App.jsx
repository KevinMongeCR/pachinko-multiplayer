import {useEffect, useState} from 'react';

function App() {
  const [status, setStatus] = useState('Desconectado');
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:5000');

    socket.onopen = () => {
      setStatus('Conectado');

      socket.send(
        JSON.stringify({
          type: 'observer_connect',
          payload: {
            observerName: 'web_observer',
          },
        }),
      );
    };

    socket.onmessage = event => {
      const data = JSON.parse(event.data);
      console.log('Mensaje del servidor:', data);

      if (data.type === 'active_rooms_update') {
        setRooms(data.payload.rooms || []);
        return;
      }

      setMessages(prev => [
        ...prev,
        `${data.type}: ${JSON.stringify(data.payload)}`,
      ]);
    };

    socket.onerror = () => {
      setStatus('Error de conexión');
    };

    socket.onclose = () => {
      setStatus('Desconectado');
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f7fb',
        padding: '30px',
        fontFamily: 'Arial',
      }}>
      <h1 style={{textAlign: 'center', marginBottom: '30px'}}>
        Panel Observador - Ruleta Game
      </h1>

      <div style={cardStyle}>
        <h2>Estado</h2>
        <p>
          Conexión WebSocket: <strong>{status}</strong>
        </p>
      </div>

      <div style={cardStyle}>
        <h2>Salas activas</h2>

        {rooms.length === 0 ? (
          <p>No hay salas activas.</p>
        ) : (
          rooms.map(room => (
            <div key={room.roomCode} style={roomStyle}>
              <h3>Sala: {room.roomCode}</h3>

              <p>
                Estado: <strong>{room.status}</strong>
              </p>

              <p>Jugadores conectados: {room.players.length}</p>

              <h4>Jugadores</h4>
              <ul>
                {(room.game?.players || room.players).map(player => (
                  <li key={player.userId}>
                    {player.avatar} {player.nickname}
                    {player.coins !== undefined ? ` - Monedas: ${player.coins}` : ''}
                  </li>
                ))}
              </ul>

              <h4>Partida</h4>
              <p>Pozo: {room.game?.pot || 0}</p>

              {room.game?.turnPlayer ? (
                <p>
                  Turno actual: {room.game.turnPlayer.avatar}{' '}
                  {room.game.turnPlayer.nickname}
                </p>
              ) : (
                <p>Turno actual: sin partida iniciada</p>
              )}

              {room.game?.gameOver ? (
                <p style={{fontWeight: 'bold', color: '#1E8449'}}>
                  Partida finalizada
                </p>
              ) : null}

              <h4>Historial</h4>
              {room.game?.history?.length > 0 ? (
                <ul>
                  {room.game.history.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>Sin historial todavía.</p>
              )}
            </div>
          ))
        )}
      </div>

      <div style={cardStyle}>
        <h2>Mensajes recibidos</h2>

        {messages.length === 0 ? (
          <p>Sin mensajes todavía</p>
        ) : (
          messages.map((item, index) => <p key={index}>• {item}</p>)
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'white',
  padding: '20px',
  borderRadius: '12px',
  maxWidth: '900px',
  margin: '0 auto 20px auto',
  boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
};

const roomStyle = {
  border: '1px solid #ddd',
  borderRadius: '10px',
  padding: '15px',
  marginBottom: '15px',
};

export default App;
type SocketMessage = {
  type: string;
  payload: any;
};

class SocketService {
  private socket: WebSocket | null = null;

  connect(
    nickname: string,
    avatar: string,
    onMessage?: (data: SocketMessage) => void,
    onStatusChange?: (status: string) => void,
  ) {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.socket = new WebSocket('ws://10.0.2.2:5000');

    this.socket.onopen = () => {
      console.log('Conectado al servidor Rust');
      onStatusChange?.('Conectado');

      this.send({
        type: 'connect_user',
        payload: {
          nickname,
          avatar,
        },
      });
    };

    this.socket.onmessage = event => {
      try {
        const parsedData: SocketMessage = JSON.parse(event.data);
        console.log('Mensaje del servidor:', parsedData);
        onMessage?.(parsedData);
      } catch (error) {
        console.log('Error al parsear mensaje del servidor:', error);
      }
    };

    this.socket.onerror = error => {
      console.log('Error de socket:', error);
      onStatusChange?.('Error');
    };

    this.socket.onclose = () => {
      console.log('Conexión cerrada');
      onStatusChange?.('Desconectado');
    };
  }

  send(message: SocketMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log('Socket no conectado');
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  createRoom() {
    this.send({
      type: 'create_room',
      payload: {},
    });
  }

  joinRoom(roomCode: string) {
    this.send({
      type: 'join_room',
      payload: {
        roomCode,
      },
    });
  }

  startGame(roomCode: string) {
  this.send({
    type: 'start_game',
    payload: {
      roomCode,
    },
  });
  }

  spin(roomCode: string) {
  this.send({
    type: 'spin_request',
    payload: {
      roomCode,
    },
  });
}

  sendGeneralMessage(messageText: string) {
    this.send({
      type: 'general_chat_message',
      payload: {
        message: messageText,
      },
    });
  }

  sendRoomMessage(roomCode: string, messageText: string) {
  this.send({
    type: 'room_chat_message',
    payload: {
      roomCode,
      message: messageText,
    },
  });
}

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  restartGameKeepCoins(roomCode: string) {
  this.send({
    type: 'restart_game_keep_coins',
    payload: {
      roomCode,
    },
  });
}
}

export const socketService = new SocketService();
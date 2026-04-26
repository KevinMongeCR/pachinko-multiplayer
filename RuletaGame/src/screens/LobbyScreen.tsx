import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import {socketService} from '../services/socketService';

type Props = {
  navigation: any;
  route: any;
};

const LobbyScreen = ({navigation, route}: Props) => {
  const {nickname, avatar} = route.params;

  const [messages, setMessages] = useState<string[]>([]);
  const [messageText, setMessageText] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Conectando...');

  useEffect(() => {
    socketService.connect(
      nickname,
      avatar,
      data => {
        if (data.type === 'connect_user_success') {
          setConnectionStatus('Conectado');

          setMessages(prev => [
            ...prev,
            `Conectado como ${data.payload.nickname}`,
          ]);
        }

        if (data.type === 'general_chat_broadcast') {
          setMessages(prev => [
            ...prev,
            `${data.payload.avatar} ${data.payload.nickname}: ${data.payload.message}`,
          ]);
        }

        if (data.type === 'error') {
          setMessages(prev => [
            ...prev,
            `Error: ${data.payload.message}`,
          ]);
        }
      },
      status => {
        setConnectionStatus(status);
      },
    );

    return () => {
      socketService.disconnect();
    };
  }, []);

  const enviarMensajeGeneral = () => {
    if (!messageText.trim()) {
      return;
    }

    socketService.sendGeneralMessage(messageText.trim());
    setMessageText('');
  };

  const crearSala = () => {
    navigation.navigate('GameScreen', {
      nickname,
      avatar,
      roomMode: 'crear',
      roomCodeInput: '',
    });
  };

  const unirseSala = () => {
    if (!roomCodeInput.trim()) {
      return;
    }

    navigation.navigate('GameScreen', {
      nickname,
      avatar,
      roomMode: 'unirse',
      roomCodeInput: roomCodeInput.trim().toUpperCase(),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Lobby General</Text>

      <Text style={styles.status}>
        Estado conexión: {connectionStatus}
      </Text>

      <View style={styles.chatBox}>
        <Text style={styles.sectionTitle}>Chat General</Text>

        {messages.length === 0 ? (
          <Text style={styles.emptyText}>Sin mensajes todavía</Text>
        ) : (
          messages.map((item, index) => (
            <Text key={index} style={styles.messageText}>
              • {item}
            </Text>
          ))
        )}

        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje general"
          value={messageText}
          onChangeText={setMessageText}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={enviarMensajeGeneral}>
          <Text style={styles.buttonText}>Enviar mensaje</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.roomBox}>
        <Text style={styles.sectionTitle}>Sala</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={crearSala}>
          <Text style={styles.buttonText}>Crear sala</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Código de sala"
          value={roomCodeInput}
          onChangeText={setRoomCodeInput}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={unirseSala}>
          <Text style={styles.buttonText}>Unirse a sala</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default LobbyScreen;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F5F7FB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  status: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  chatBox: {
    marginBottom: 25,
  },
  roomBox: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptyText: {
    marginBottom: 10,
  },
  messageText: {
    marginBottom: 6,
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
  button: {
    backgroundColor: '#355DA8',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: {
    color: '#FFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
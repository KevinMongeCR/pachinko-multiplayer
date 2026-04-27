import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {socketService} from '../services/socketService';

type Props = {
  navigation: any;
};

const avatars = ['😀', '😎', '🤖'];


const LoginScreen = ({navigation}: Props) => {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('😀');
  const [serverIp, setServerIp] = useState('10.0.2.2');

  const entrarAlLobby = () => {
  if (!nickname.trim()) {
    alert('Por favor ingresa un nickname');
    return;
  }

  if (!serverIp.trim()) {
    alert('Por favor ingresa la IP del servidor');
    return;
  }

  socketService.setServerIp(serverIp.trim());

  navigation.navigate('LobbyScreen', {
    nickname,
    avatar,
  });
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pachinko</Text>

      <Text style={styles.label}>Ingresa tu nickname</Text>
      <TextInput
        style={styles.input}
        placeholder="Ejemplo: KevinCR"
        value={nickname}
        onChangeText={setNickname}
      />

      <Text style={styles.label}>Selecciona un avatar</Text>
      <View style={styles.avatarContainer}>
        {avatars.map((item, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setAvatar(item)}
            style={[
              styles.avatarButton,
              avatar === item && styles.avatarSelected,
            ]}>
            <Text style={styles.avatarText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>IP del servidor</Text>
        <TextInput
          style={styles.input}
          placeholder="Ejemplo: 192.168.0.9"
          value={serverIp}
          onChangeText={setServerIp}
          autoCapitalize="none"
        />

      <TouchableOpacity style={styles.button} onPress={entrarAlLobby}>
        <Text style={styles.buttonText}>Entrar al juego</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F5F7FB',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 20,
    backgroundColor: '#FFF',
  },
  avatarContainer: {
    flexDirection: 'row',
    marginBottom: 25,
  },
  avatarButton: {
    padding: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 10,
    backgroundColor: '#FFF',
  },
  avatarSelected: {
    borderWidth: 2,
    borderColor: '#355DA8',
  },
  avatarText: {
    fontSize: 28,
  },
  button: {
    backgroundColor: '#355DA8',
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

type Props = {
  navigation: any;
};

const avatars = ['😀', '😎', '🤖'];

const LoginScreen = ({navigation}: Props) => {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('😀');

  const entrarAlLobby = () => {
    if (!nickname.trim()) {
      alert('Por favor ingresa un nickname');
      return;
    }

    navigation.navigate('LobbyScreen', {
      nickname,
      avatar,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ruleta Game</Text>

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

      <TouchableOpacity style={styles.button} onPress={entrarAlLobby}>
        <Text style={styles.buttonText}>Entrar al lobby</Text>
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
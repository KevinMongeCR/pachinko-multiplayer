import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import LoginScreen from './src/views/LoginScreen';
import GameScreen from './src/views/GameScreen';
import LobbyScreen from './src/screens/LobbyScreen';
const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="LoginScreen">
        <Stack.Screen
          name="LoginScreen"
          component={LoginScreen}
          options={{title: 'Inicio'}}
        />
        <Stack.Screen
          name="LobbyScreen"
          component={LobbyScreen}
          options={{title: 'Lobby'}}
/>
        <Stack.Screen
          name="GameScreen"
          component={GameScreen}
          options={{title: 'Juego'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;

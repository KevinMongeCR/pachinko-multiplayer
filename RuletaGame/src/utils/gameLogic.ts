export type Player = {
  id: number;
  userId?: string;
  nickname: string;
  avatar: string;
  coins: number;
};

export const opcionesRuleta = [
  'Pon una',
  'Pon dos',
  'Toma una',
  'Toma dos',
  'Todos ponen',
  'Toma todo',
];

export const crearCodigoSala = () => {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';

  for (let i = 0; i < 6; i++) {
    const index = Math.floor(Math.random() * caracteres.length);
    codigo += caracteres[index];
  }

  return codigo;
};

export const crearJugadoresIniciales = (
  nickname: string,
  avatar: string,
): Player[] => [
  {id: 1, nickname, avatar, coins: 10},
  {id: 2, nickname: 'Ana', avatar: '🐱', coins: 10},
  {id: 3, nickname: 'Luis', avatar: '🐸', coins: 10},
];

export const iniciarPartidaLogic = (players: Player[]) => {
  const updatedPlayers = [...players];
  let newPot = 0;

  for (let i = 0; i < updatedPlayers.length; i++) {
    if (updatedPlayers[i].coins >= 1) {
      updatedPlayers[i] = {
        ...updatedPlayers[i],
        coins: updatedPlayers[i].coins - 1,
      };
      newPot += 1;
    }
  }

  return {
    updatedPlayers,
    newPot,
    resultado: 'La partida ha iniciado',
  };
};

export const aplicarResultadoRuleta = (
  players: Player[],
  pot: number,
  turnIndex: number,
  opcion: string,
) => {
  const updatedPlayers = [...players];
  let newPot = pot;
  let newGameOver = false;
  let nextTurn = turnIndex;
  let winner = '';

  switch (opcion) {
    case 'Pon una':
      if (updatedPlayers[turnIndex].coins >= 1) {
        updatedPlayers[turnIndex].coins -= 1;
        newPot += 1;
      }
      break;

    case 'Pon dos':
      if (updatedPlayers[turnIndex].coins >= 2) {
        updatedPlayers[turnIndex].coins -= 2;
        newPot += 2;
      } else if (updatedPlayers[turnIndex].coins === 1) {
        updatedPlayers[turnIndex].coins -= 1;
        newPot += 1;
      }
      break;

    case 'Toma una':
      if (newPot >= 1) {
        updatedPlayers[turnIndex].coins += 1;
        newPot -= 1;
      }
      break;

    case 'Toma dos':
      if (newPot >= 2) {
        updatedPlayers[turnIndex].coins += 2;
        newPot -= 2;
      } else if (newPot === 1) {
        updatedPlayers[turnIndex].coins += 1;
        newPot -= 1;
      }
      break;

    case 'Todos ponen':
      for (let i = 0; i < updatedPlayers.length; i++) {
        if (updatedPlayers[i].coins >= 1) {
          updatedPlayers[i].coins -= 1;
          newPot += 1;
        }
      }
      break;

    case 'Toma todo':
      if (newPot > 0) {
        updatedPlayers[turnIndex].coins += newPot;
        newPot = 0;
      }
      newGameOver = true;
      winner = updatedPlayers[turnIndex].nickname;
      break;
  }

  if (!newGameOver) {
    nextTurn = (turnIndex + 1) % updatedPlayers.length;
  }

  return {
    updatedPlayers,
    newPot,
    opcion,
    newGameOver,
    nextTurn,
    winner,
  };
};
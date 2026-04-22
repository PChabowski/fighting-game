import { insertCoin, onPlayerJoin as _onPlayerJoin, isHost, myPlayer, RPC } from "playroomkit";

export const initPlayroom = async (options = {}) => {
  // skipLobby jest wymagane by Playroom nie zasłaniał naszego customowego Lobby.
  // Używamy streamMode: false, ponieważ w grze typu bijatyka każdy gracz patrzy na swój własny ekran (każdy walczy).
  // streamMode: true stworzyłoby jednego hosta jako "ekran", a drugiego jako "kontroler", uniemożliwiając Matchmaking dwóch ekranów.
  await insertCoin({ 
      streamMode: false, 
      discord: false, 
      skipLobby: true, 
      gameId: 'blood-honor-fighting-game', 
      ...options 
  });
};

export const onPlayerJoin = _onPlayerJoin;

export const onGameStart = (callback) => {
  _onPlayerJoin((state) => {
    callback(state);
  });
};

export const getMyPlayer = () => {
    return myPlayer();
};

export const isGameHost = () => {
    return isHost();
};

export const playroomRPC = RPC;

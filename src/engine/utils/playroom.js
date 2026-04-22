import { insertCoin, onPlayerJoin as _onPlayerJoin, isHost, myPlayer, RPC } from "playroomkit";

export const initPlayroom = async (options = {}) => {
  // skipLobby jest wymagane by Playroom nie zasłaniał naszego customowego Lobby.
  // opcjonalnie możemy przekazać roomCode by wymusić konkretny pokój.
  await insertCoin({ streamMode: true, discord: false, skipLobby: true, ...options });
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

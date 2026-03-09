// src/App.jsx
import React, { useEffect, useRef } from 'react';
import useGameStore from './store/useGameStore';
import GameCanvas from './components/GameCanvas';
import GameMenu from './components/GameMenu';
import CharacterSelect from './components/CharacterSelect';
import MultiplayerMenu from './components/MultiplayerMenu';
import MultiplayerLobby from './components/MultiplayerLobby';
import JoinMenu from './components/JoinMenu';
import GameInterface from './components/GameInterface';

function App() {
  const { view } = useGameStore();

  return (
    <div className="conteiner">
      {/* Elementy nakładane (Menu/WinModal itp.) powinny zajmować cały ekran lub korzystać z display: none, 
          w przypadku starej logiki modale/menu korzystały z klasy .who-win aby wyświetlać się na środku ekranu. */}
      {view === 'MENU' && <GameMenu />}
      {view === 'CHAR_SELECT' && <CharacterSelect />}
      {view === 'MULTI_MENU' && <MultiplayerMenu />}
      {view === 'MULTI_JOIN' && <JoinMenu />}
      {view === 'MULTI_LOBBY' && <MultiplayerLobby />}
      {view === 'GAME' && <GameInterface />}
      
      {/* Game Engine rendering layer */}
      <GameCanvas />
    </div>
  );
}

export default App;
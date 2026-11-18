import React, { useEffect, useState } from 'react';
import {
  Shield,
  Swords,
  Settings,
  Users,
  Castle,
  Flag,
  KeyRound,
  Cpu,
  Globe,
  Mouse,
  Keyboard,
  RefreshCw,
  Server,
  User,
  Gamepad2,
  Smartphone,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { getArenasForMode } from '../game/arenas/arenas';
import { MODES, t } from '../i18n/translations';
import { useAppStore } from '../store/useAppStore';
import { BotDifficulty, GameModeId, TouchControlsMode } from '../game/types';
import { networkClient } from '../game/net/networkClient';
import { RoomSummary } from '../game/net/protocol';
import { soundEngine } from '../game/audio/soundEngine';
import { useMobileFullscreen } from '../utils/mobileFullscreen';

export const ModeSelectScreen: React.FC = () => {
  const {
    language,
    setLanguage,
    selectedMode,
    selectMode,
    selectedArenaId,
    selectArena,
    botDifficulty,
    setBotDifficulty,
    controlScheme,
    setControlScheme,
    touchControlsMode,
    setTouchControlsMode,
    gamepadConnected,
    playerName,
    setPlayerName,
    localHeroId,
    localSkinIndex,
    localTeam,
    setAudioModalOpen,
    setNetworkConnection,
    setNetworkError,
    networkError,
    setScreen,
    autoFillBots,
  } = useAppStore();

  const [roomInput, setRoomInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '';
  });
  const [joining, setJoining] = useState(false);
  const [activeRooms, setActiveRooms] = useState<RoomSummary[]>(() => networkClient.getRooms());
  const { isMobileDevice, isFullscreen, toggleFullscreen } = useMobileFullscreen();
  const availableArenas = getArenasForMode(selectedMode);

  useEffect(() => {
    let mounted = true;
    const unsub = networkClient.subscribeRoomList((rooms) => {
      if (mounted) setActiveRooms(rooms);
    });
    networkClient.refreshRoomList();
    const timer = setInterval(() => {
      networkClient.refreshRoomList();
    }, 4000);
    return () => {
      mounted = false;
      unsub();
      clearInterval(timer);
    };
  }, []);

  const handleEnterLocalLobby = () => {
    soundEngine.playMusic('menu');
    setNetworkError(null);
    const res = networkClient.createLocalRoomSession();
    setNetworkConnection('local', res.roomCode, res.localId);
    autoFillBots({
      iron: localTeam === 'iron' ? 1 : 0,
      crimson: localTeam === 'crimson' ? 1 : 0,
    });
    setScreen('LOBBY');
  };

  const handleCreateOnlineRoom = async () => {
    if (joining) return;
    setJoining(true);
    setNetworkError(null);
    soundEngine.playMusic('menu');
    setNetworkConnection('connecting', '', 'local-player-1');

    try {
      const res = await networkClient.createOnlineRoom({
        name: playerName || 'Wojownik',
        mode: selectedMode,
        arenaId: selectedArenaId,
        difficulty: botDifficulty,
        heroId: localHeroId,
        skinIndex: localSkinIndex,
        team: localTeam,
      });
      setNetworkConnection('online', res.roomCode, res.localId);
      setScreen('LOBBY');
    } catch (err) {
      setNetworkConnection('idle', '', 'local-player-1');
      setNetworkError(err instanceof Error ? err.message : 'Server connection failed');
    } finally {
      setJoining(false);
    }
  };

  const handleJoinOnlineRoom = async (codeToJoin: string) => {
    const clean = codeToJoin.trim().toUpperCase();
    if (joining || !clean) return;
    setJoining(true);
    setNetworkError(null);
    soundEngine.playMusic('menu');
    setNetworkConnection('connecting', '', 'local-player-1');

    try {
      const res = await networkClient.joinOnlineRoom({
        roomCode: clean,
        name: playerName || 'Wojownik',
        heroId: localHeroId,
        skinIndex: localSkinIndex,
      });
      setNetworkConnection('online', res.roomCode, res.localId);
      setScreen('LOBBY');
    } catch (err) {
      setNetworkConnection('idle', '', 'local-player-1');
      setNetworkError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setJoining(false);
    }
  };

  const renderModeIcon = (id: GameModeId) => {
    if (id === 'dominion') return <Flag className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (id === 'stronghold') return <Castle className="w-4 h-4 text-amber-400 shrink-0" />;
    if (id === 'duel_1v1') return <Swords className="w-4 h-4 text-red-400 shrink-0" />;
    return <Users className="w-4 h-4 text-blue-400 shrink-0" />;
  };

  return (
    <div className="h-screen w-screen bg-[#0E1116] text-slate-100 flex flex-col overflow-y-auto">
      <div
        className="fixed inset-0 opacity-20 pointer-events-none bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/environment/backgrounds/layer_3.png')" }}
      />
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-[#0E1116]/70 via-[#0E1116]/85 to-[#0E1116]" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between gap-2 sm:gap-6 px-3 sm:px-6 lg:px-10 py-3 sm:py-4 border-b border-slate-800/80 bg-[#0E1116]/80 backdrop-blur-sm">
        <div className="font-display text-base sm:text-xl lg:text-2xl font-bold tracking-wider text-slate-100 whitespace-nowrap shrink-0">
          {t(language, 'brand')}
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs text-slate-400">
          <span className="whitespace-nowrap shrink-0">{t(language, 'tagline')}</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {isMobileDevice && (
            <button
              type="button"
              data-testid="mobile-fullscreen-btn"
              onClick={() => toggleFullscreen()}
              aria-label={t(language, isFullscreen ? 'fullscreenExit' : 'fullscreenEnter')}
              title={t(language, isFullscreen ? 'fullscreenExit' : 'fullscreenEnter')}
              className={`p-1.5 sm:p-2 bg-[#181D26] hover:bg-[#1F2631] border rounded transition-colors shrink-0 cursor-pointer ${
                isFullscreen
                  ? 'border-amber-400 text-amber-300'
                  : 'border-slate-700/70 text-slate-200'
              }`}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setLanguage(language === 'pl' ? 'en' : 'pl')}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold bg-[#181D26] hover:bg-[#1F2631] border border-slate-700/70 rounded text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>{language === 'pl' ? 'PL / EN' : 'EN / PL'}</span>
          </button>

          <button
            type="button"
            data-testid="settings-modal-btn"
            onClick={() => setAudioModalOpen(true)}
            aria-label={t(language, 'audioModalTitle')}
            title={t(language, 'audioModalTitle')}
            className="p-1.5 sm:p-2 bg-[#181D26] hover:bg-[#1F2631] border border-slate-700/70 rounded text-slate-200 transition-colors shrink-0 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-200" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-[1360px] w-full mx-auto px-6 lg:px-10 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-slate-100 mb-1">
              {t(language, 'chooseMode')}
            </h1>
            <p className="text-sm text-slate-400">
              {language === 'pl'
                ? 'Wybierz tryb, arenę i poziom AI botów. Graj lokalnie z botami albo utwórz pokój na własnym serwerze Node.js WebSocket.'
                : 'Choose mode, arena, and Bot AI difficulty. Play locally with bots or host an online room on our Node.js WebSocket server.'}
            </p>
          </div>

          {/* 6 Game Mode Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {MODES.map((m) => {
              const active = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMode(m.id)}
                  className={`text-left p-4 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    active
                      ? 'bg-[#1F2631] border-amber-500/80 shadow-[0_0_24px_rgba(245,158,11,0.12)]'
                      : 'bg-[#181D26]/90 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {renderModeIcon(m.id)}
                      <span className="font-display text-sm font-bold text-slate-100 leading-snug">
                        {language === 'pl' ? m.namePl : m.nameEn}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-amber-400 tabular-nums shrink-0 pt-0.5">
                      {m.tag}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-300">
                    {language === 'pl' ? m.descPl : m.descEn}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Arena & Bot Difficulty Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#181D26]/90 border border-slate-800 rounded-lg p-4">
            <div data-testid="arena-list">
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                {t(language, 'arenaLabel')}
              </label>
              <div
                className={`grid gap-2 ${
                  availableArenas.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                }`}
              >
                {availableArenas.map((a) => {
                  const active = selectedArenaId === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      data-testid={`arena-option-${a.id}`}
                      onClick={() => selectArena(a.id)}
                      className={`px-3 py-2 rounded text-xs font-medium text-left transition-colors border cursor-pointer truncate ${
                        active
                          ? 'bg-[#262F3E] border-amber-500/70 text-amber-200'
                          : 'bg-[#0E1116]/80 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {language === 'pl' ? a.namePl : a.nameEn}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span>{t(language, 'botDiffLabel')}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['recruit', 'veteran', 'warlord'] as BotDifficulty[]).map((diff) => {
                  const active = botDifficulty === diff;
                  const label =
                    diff === 'recruit'
                      ? t(language, 'diffRecruit')
                      : diff === 'veteran'
                      ? t(language, 'diffVeteran')
                      : t(language, 'diffWarlord');
                  return (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setBotDifficulty(diff)}
                      className={`px-3 py-2 rounded text-xs font-semibold transition-colors border cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-red-600/20 border-red-500 text-red-200'
                          : 'bg-[#0E1116]/80 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {language === 'pl'
                  ? 'Boty Weteran i Watażka używają parowań, zmyłek (feintów), wspinaczki po drabinach oraz taktycznego przejmowania stref.'
                  : 'Veteran and Warlord bots perform timed parries, heavy feints, ladder climbing, and zone tactics.'}
              </p>
            </div>
          </div>

          {/* Launch Bar: Local + Bots OR Custom Node.js Online Room */}
          <div className="bg-[#181D26] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t(language, 'playerNameLabel')}</span>
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0E1116] border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleEnterLocalLobby}
                  className="px-5 py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-[#0E1116] font-bold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  <span>{t(language, 'playLocalBots')}</span>
                </button>

                <button
                  type="button"
                  disabled={joining}
                  onClick={handleCreateOnlineRoom}
                  className="px-5 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 disabled:opacity-60"
                >
                  <Server className="w-4 h-4" />
                  <span>{joining ? t(language, 'connectingServer') : t(language, 'createLobby')}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                  placeholder={t(language, 'joinRoomPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 bg-[#0E1116] border border-slate-700 rounded text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="button"
                disabled={joining || !roomInput.trim()}
                onClick={() => handleJoinOnlineRoom(roomInput)}
                className="px-4 py-2 rounded bg-[#262F3E] hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40"
              >
                {t(language, 'joinRoom')}
              </button>
            </div>

            {networkError && (
              <div className="bg-red-500/15 border border-red-500/40 rounded px-3 py-2 text-xs text-red-200">
                {networkError}
              </div>
            )}

            {/* Live Server Room Browser */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t(language, 'activeRoomsTitle')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => networkClient.refreshRoomList()}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{t(language, 'refreshRooms')}</span>
                </button>
              </div>

              {activeRooms.length === 0 ? (
                <div className="text-[11px] text-slate-500 py-1">
                  {t(language, 'noActiveRooms')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeRooms.map((r) => {
                    const modeObj = MODES.find((m) => m.id === r.mode);
                    const canJoinInProgress =
                      r.phase === 'PLAYING' && r.botCount > 0 && r.humanCount < r.maxPlayers;
                    const canJoin =
                      (r.phase === 'LOBBY' && r.humanCount < r.maxPlayers) || canJoinInProgress;
                    return (
                      <div
                        key={r.roomCode}
                        data-testid={`room-card-${r.roomCode}`}
                        className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0E1116] border border-slate-800 rounded text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-amber-300 flex items-center gap-2">
                            <span>{r.roomCode}</span>
                            <span className="text-[10px] text-slate-400 font-sans font-normal truncate">
                              {r.hostName} · {modeObj ? modeObj.tag : r.mode}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono tabular-nums flex items-center gap-1.5">
                            <span>
                              {r.humanCount}/{r.maxPlayers} HUMAN · {r.botCount} BOT ·
                            </span>
                            <span
                              className={
                                r.phase === 'PLAYING'
                                  ? 'text-amber-300 font-semibold'
                                  : 'text-emerald-300'
                              }
                            >
                              {r.phase === 'PLAYING'
                                ? t(language, 'roomPhasePlaying')
                                : t(language, 'roomPhaseLobby')}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid={`room-join-${r.roomCode}`}
                          disabled={joining || !canJoin}
                          onClick={() => handleJoinOnlineRoom(r.roomCode)}
                          className="px-2.5 py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/50 text-emerald-200 text-[11px] font-semibold cursor-pointer shrink-0 disabled:opacity-40"
                        >
                          {t(language, 'joinNow')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Art of Battle 2D Controls & Guard Choice */}
        <aside className="lg:col-span-4 bg-[#181D26]/95 border border-slate-800 rounded-lg p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Shield className="w-4 h-4 text-amber-400" />
            <h2 className="font-display text-base font-bold text-slate-100">
              {t(language, 'controlsTitle')}
            </h2>
          </div>

          {/* Guard & Attack Scheme Switcher */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400">
              {t(language, 'controlSchemeLabel')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setControlScheme('mouse')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded border text-xs font-semibold cursor-pointer transition-colors ${
                  controlScheme === 'mouse'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                    : 'bg-[#0E1116] border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <Mouse className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t(language, 'schemeMouse')}</span>
              </button>
              <button
                type="button"
                onClick={() => setControlScheme('keyboard')}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded border text-xs font-semibold cursor-pointer transition-colors ${
                  controlScheme === 'keyboard'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                    : 'bg-[#0E1116] border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t(language, 'schemeKeyboard')}</span>
              </button>
            </div>
          </div>

          {/* True Closed 3-Direction Guard Triangle Diagram */}
          <div className="bg-[#0E1116] border border-slate-800 rounded p-4 flex items-center justify-between gap-4">
            <svg viewBox="0 0 100 90" className="w-20 h-20 shrink-0">
              <polygon
                points="16,18 84,18 50,78"
                fill="rgba(14, 17, 22, 0.7)"
                stroke="rgba(148, 163, 184, 0.25)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <line x1="16" y1="18" x2="84" y2="18" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
              <line x1="16" y1="18" x2="50" y2="78" stroke="#3B82F6" strokeWidth="6" strokeLinecap="round" />
              <line x1="84" y1="18" x2="50" y2="78" stroke="#EF4444" strokeWidth="6" strokeLinecap="round" />
              <text x="50" y="11" fill="#FDE68A" fontSize="8.5" textAnchor="middle" fontWeight="bold">
                {controlScheme === 'mouse' ? 'MOUSE ▲' : 'TOP (I / ↑)'}
              </text>
              <text x="14" y="65" fill="#93C5FD" fontSize="8.5" textAnchor="middle" fontWeight="bold">
                {controlScheme === 'mouse' ? '◀' : 'J / ←'}
              </text>
              <text x="86" y="65" fill="#FCA5A5" fontSize="8.5" textAnchor="middle" fontWeight="bold">
                {controlScheme === 'mouse' ? '▶' : 'L / →'}
              </text>
            </svg>
            <p className="text-xs text-slate-300 leading-relaxed">
              {language === 'pl'
                ? 'Ustaw gardę zgodnie z kierunkiem ciosu wroga, aby zablokować, lub wciśnij Parowanie w złotym błysku i odpowiedz Kontrą!'
                : 'Match incoming strike direction to Block, or press Parry on the golden flash to unlock an unblockable Counter Riposte!'}
            </p>
          </div>

          <ul className="space-y-2.5 text-xs">
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{t(language, 'ctrlMove')}</span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-slate-200 shrink-0">A D / S</kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{t(language, 'ctrlJump')}</span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-slate-200 shrink-0">W / Space</kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{t(language, 'ctrlDash')}</span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-slate-200 shrink-0">Shift</kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{t(language, 'ctrlLockOn')}</span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-amber-300 shrink-0">Alt</kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{t(language, 'ctrlSwitchTarget')}</span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-sky-300 shrink-0">Tab</kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">
                {controlScheme === 'mouse' ? t(language, 'ctrlGuardMouse') : t(language, 'ctrlGuardKeyboard')}
              </span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-amber-300 shrink-0">
                {controlScheme === 'mouse' ? 'Mouse' : 'I J L / ↑ ← →'}
              </kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">
                {controlScheme === 'mouse' ? t(language, 'ctrlLightMouse') : t(language, 'ctrlLightKeyboard')}
              </span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-slate-200 shrink-0">
                {controlScheme === 'mouse' ? 'LMB' : 'K / U'}
              </kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">
                {controlScheme === 'mouse' ? t(language, 'ctrlHeavyMouse') : t(language, 'ctrlHeavyKeyboard')}
              </span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-orange-300 shrink-0">
                {controlScheme === 'mouse' ? 'RMB' : 'O / Enter'}
              </kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{t(language, 'ctrlParry')}</span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-amber-300 shrink-0">R</kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{t(language, 'ctrlCounter')}</span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-emerald-300 shrink-0">F</kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{t(language, 'ctrlFeint')}</span>
              <kbd className="px-2 py-1 bg-[#0E1116] border border-slate-700 rounded font-mono text-slate-200 shrink-0">E</kbd>
            </li>
          </ul>

          {/* Xbox Controller Plug & Play Panel */}
          <div className="bg-[#0E1116] border border-slate-800 rounded p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                <Gamepad2
                  className={`w-4 h-4 ${
                    gamepadConnected ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                />
                <span>{t(language, 'xboxTitle')}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                  gamepadConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {gamepadConnected ? t(language, 'xboxConnected') : 'PLUG & PLAY'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1 leading-snug">
              <div>{t(language, 'xboxStickMove')}</div>
              <div>{t(language, 'xboxStickGuard')}</div>
              <div className="text-amber-300/90">{t(language, 'xboxAttacks')}</div>
              <div>{t(language, 'xboxActions')}</div>
            </div>
          </div>

          {/* Mobile Touch Overlay Selector */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              <span>{t(language, 'touchControlsLabel')}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['auto', 'on', 'off'] as TouchControlsMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTouchControlsMode(mode)}
                  className={`px-2 py-1.5 rounded border text-[11px] font-semibold cursor-pointer transition-colors ${
                    touchControlsMode === mode
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-[#0E1116] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {mode === 'auto'
                    ? t(language, 'touchAuto')
                    : mode === 'on'
                    ? t(language, 'touchOn')
                    : t(language, 'touchOff')}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Globe,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Swords,
  Trash2,
  Users,
} from 'lucide-react';
import { HERO_LIST, HEROES } from '../game/heroes';
import { spriteCache } from '../game/SpriteCache';
import { ARENAS } from '../game/arenas/arenas';
import { MODES, t } from '../i18n/translations';
import { useAppStore } from '../store/useAppStore';
import { networkClient } from '../game/net/networkClient';
import { RoomStatePayload } from '../game/net/protocol';
import { BotDifficulty, HeroId, LobbyParticipant, TeamId } from '../game/types';
import { soundEngine } from '../game/audio/soundEngine';
import { useMobileFullscreen } from '../utils/mobileFullscreen';

type PreviewAnimKey = 'idle' | 'run' | 'attackLight' | 'attackHeavy';

const HeroSpritePreview: React.FC<{
  heroId: HeroId;
  skinIndex: number;
  language: 'pl' | 'en';
}> = ({ heroId, skinIndex, language }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewAnim, setPreviewAnim] = useState<PreviewAnimKey>('idle');
  const previewAnimRef = useRef<PreviewAnimKey>('idle');
  previewAnimRef.current = previewAnim;

  useEffect(() => {
    let raf = 0;
    let frame = 0;
    let animElapsedMs = 0;
    let lastTime = performance.now();
    let activeKey: PreviewAnimKey = previewAnimRef.current;

    const loop = (now: number) => {
      const dtMs = Math.min(80, Math.max(1, now - lastTime));
      lastTime = now;

      if (activeKey !== previewAnimRef.current) {
        activeKey = previewAnimRef.current;
        frame = 0;
        animElapsedMs = 0;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const hero = HEROES[heroId];
          const skin = hero.skins[skinIndex % hero.skins.length];
          const anim = hero.sprites[activeKey];
          const img = spriteCache.get(anim.src);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = false;

          // Subtle 60fps ambient forge glow & shadow pulse
          const breath = Math.sin(now * 0.0036);
          const grad = ctx.createRadialGradient(
            canvas.width / 2,
            canvas.height * 0.56,
            10,
            canvas.width / 2,
            canvas.height * 0.56,
            105
          );
          grad.addColorStop(0, `${skin.trailHex}22`);
          grad.addColorStop(1, 'rgba(14, 17, 22, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.beginPath();
          ctx.ellipse(
            canvas.width / 2,
            canvas.height - 22,
            44 + breath * 2.5,
            9,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();

          if (img && img.complete && img.naturalWidth > 0) {
            const frameDurationMs =
              activeKey === 'idle'
                ? Math.max(75, anim.hold * 11)
                : activeKey === 'run'
                ? Math.max(55, anim.hold * 12)
                : Math.max(60, anim.hold * 13);

            animElapsedMs += dtMs;
            while (animElapsedMs >= frameDurationMs) {
              animElapsedMs -= frameDurationMs;
              if (frame < anim.frames - 1) {
                frame += 1;
              } else if (anim.loop !== false) {
                frame = 0;
              } else {
                // Return smoothly to idle once attack animation completes
                previewAnimRef.current = 'idle';
                activeKey = 'idle';
                frame = 0;
                setPreviewAnim('idle');
                break;
              }
            }

            const tinted = spriteCache.getTinted(anim.src, skin.canvasFilter) || img;
            const fw = tinted.width / anim.frames;
            const scale = 2.05;
            const dw = fw * scale;
            const dh = tinted.height * scale;
            const bobY = activeKey === 'idle' ? breath * 2.4 : 0;

            ctx.drawImage(
              tinted,
              frame * fw,
              0,
              fw,
              tinted.height,
              Math.round(canvas.width / 2 - dw / 2),
              Math.round(canvas.height / 2 - dh / 2 + 12 + bobY),
              dw,
              dh
            );
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [heroId, skinIndex]);

  const animOptions: Array<{ id: PreviewAnimKey; label: string }> = [
    { id: 'idle', label: t(language, 'previewIdle') },
    { id: 'run', label: t(language, 'previewRun') },
    { id: 'attackLight', label: t(language, 'previewLight') },
    { id: 'attackHeavy', label: t(language, 'previewHeavy') },
  ];

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={260}
        height={210}
        onClick={() => setPreviewAnim((prev) => (prev === 'attackLight' ? 'attackHeavy' : 'attackLight'))}
        className="w-full h-44 bg-[#0E1116] border border-slate-800 rounded cursor-pointer"
      />
      <div className="grid grid-cols-4 gap-1.5">
        {animOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setPreviewAnim(opt.id)}
            className={`py-1 px-2 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
              previewAnim === opt.id
                ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                : 'bg-[#0E1116] border-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export const WarRoomLobby: React.FC = () => {
  const {
    language,
    setLanguage,
    selectedMode,
    selectedArenaId,
    botDifficulty,
    setBotDifficulty,
    selectMode,
    selectArena,
    playerName,
    localHeroId,
    localSkinIndex,
    localTeam,
    localPlayerId,
    setLocalSelection,
    networkStatus,
    roomCode,
    bots,
    setBots,
    autoFillBots,
    addSingleBot,
    removeBot,
    swapLocalTeamAndRebalance,
    setScreen,
    setAudioModalOpen,
  } = useAppStore();

  const [copied, setCopied] = useState(false);
  const [targetBotId, setTargetBotId] = useState<string | null>(null);
  const { isMobileDevice, isFullscreen, toggleFullscreen } = useMobileFullscreen();
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(() =>
    networkClient.getRoomState()
  );

  const isOnline = networkStatus === 'online';
  const isHost = isOnline ? roomState?.hostId === localPlayerId : true;

  const syncRef = useRef({
    selectedMode,
    selectedArenaId,
    botDifficulty,
    localHeroId,
    localSkinIndex,
    localTeam,
    localPlayerId,
  });
  syncRef.current = {
    selectedMode,
    selectedArenaId,
    botDifficulty,
    localHeroId,
    localSkinIndex,
    localTeam,
    localPlayerId,
  };

  // Sync room state from WebSocket server when online (stable subscription)
  useEffect(() => {
    if (!isOnline) {
      setRoomState(null);
      return;
    }

    const applyRoom = (room: RoomStatePayload | null) => {
      setRoomState(room);
      if (!room) return;
      const cur = syncRef.current;
      if (room.mode !== cur.selectedMode) selectMode(room.mode);
      if (room.arenaId !== cur.selectedArenaId) selectArena(room.arenaId);
      if (room.difficulty !== cur.botDifficulty) setBotDifficulty(room.difficulty);
      setBots(room.bots);

      const me = room.humans.find((h) => h.id === cur.localPlayerId);
      if (me) {
        if (
          me.heroId !== cur.localHeroId ||
          me.skinIndex !== cur.localSkinIndex ||
          me.team !== cur.localTeam
        ) {
          setLocalSelection({
            heroId: me.heroId,
            skinIndex: me.skinIndex,
            team: me.team,
          });
        }
      }

      if (room.phase === 'PLAYING' && me?.inMatch) {
        soundEngine.playMusic('battle');
        setScreen('PLAYING');
      }
    };

    applyRoom(networkClient.getRoomState());
    return networkClient.subscribeRoomState(applyRoom);
  }, [isOnline, selectMode, selectArena, setBotDifficulty, setBots, setLocalSelection, setScreen]);

  const humanPlayers: LobbyParticipant[] = isOnline && roomState
    ? roomState.humans.map((h) => ({ ...h, isLocal: h.id === localPlayerId }))
    : [
        {
          id: localPlayerId,
          name: playerName || (language === 'pl' ? 'Gracz 1' : 'Player 1'),
          isBot: false,
          isLocal: true,
          team: localTeam,
          heroId: localHeroId,
          skinIndex: localSkinIndex,
          ready: true,
        },
      ];

  const activeBots = isOnline && roomState ? roomState.bots : bots;
  const activeMode = isOnline && roomState ? roomState.mode : selectedMode;
  const activeArenaId = isOnline && roomState ? roomState.arenaId : selectedArenaId;
  const activeDifficulty = isOnline && roomState ? roomState.difficulty : botDifficulty;

  const modeMeta = MODES.find((m) => m.id === activeMode) || MODES[0];
  const arena = ARENAS[activeArenaId] || ARENAS.shattered_bridge;

  const handleSelectHero = (heroId: HeroId) => {
    setLocalSelection({ heroId });
    if (isOnline) networkClient.setMyLobbySelection(heroId, localSkinIndex, localTeam);
  };

  const handleSelectSkin = (skinIndex: number) => {
    setLocalSelection({ skinIndex });
    if (isOnline) networkClient.setMyLobbySelection(localHeroId, skinIndex, localTeam);
  };

  const meInRoom = isOnline && roomState
    ? roomState.humans.find((h) => h.id === localPlayerId)
    : undefined;
  const isLiveJoinPending = Boolean(
    isOnline && roomState?.phase === 'PLAYING' && !meInRoom?.inMatch
  );
  const canEditLobby = isHost && !isLiveJoinPending && (!isOnline || roomState?.phase !== 'PLAYING');

  const effectiveTargetBotId = isLiveJoinPending
    ? (targetBotId && activeBots.some((b) => b.id === targetBotId)
        ? targetBotId
        : activeBots.find((b) => b.team === localTeam)?.id ?? activeBots[0]?.id ?? null)
    : null;

  const handleSelectBotSlot = (bot: LobbyParticipant) => {
    setTargetBotId(bot.id);
    if (bot.team !== localTeam) {
      setLocalSelection({ team: bot.team });
      if (isOnline) networkClient.setMyLobbySelection(localHeroId, localSkinIndex, bot.team);
    }
  };

  const handleSwapTeam = () => {
    const nextTeam: TeamId = localTeam === 'iron' ? 'crimson' : 'iron';
    if (isLiveJoinPending) {
      const nextBot = activeBots.find((b) => b.team === nextTeam);
      if (!nextBot) return;
      setTargetBotId(nextBot.id);
    }
    if (!isOnline) {
      swapLocalTeamAndRebalance();
      return;
    }
    // In online pre-match lobby, do not exceed mode teamSize human cap on destination team
    const destHumans = humanPlayers.filter((h) => h.team === nextTeam).length;
    if (!isLiveJoinPending && destHumans >= modeMeta.teamSize) {
      return;
    }
    setLocalSelection({ team: nextTeam });
    networkClient.setMyLobbySelection(localHeroId, localSkinIndex, nextTeam);
  };

  const handleAutoFill = () => {
    if (isOnline) {
      networkClient.requestAutoFillBots();
    } else {
      const ironHumans = humanPlayers.filter((h) => h.team === 'iron').length;
      const crimsonHumans = humanPlayers.filter((h) => h.team === 'crimson').length;
      autoFillBots({ iron: ironHumans, crimson: crimsonHumans });
    }
  };

  const handleAddBot = (team: TeamId) => {
    if (isOnline) networkClient.requestAddBot(team);
    else addSingleBot(team);
  };

  const handleRemoveBot = (id: string) => {
    if (isOnline) networkClient.requestRemoveBot(id);
    else removeBot(id);
  };

  const handleDifficultyChange = (diff: BotDifficulty) => {
    setBotDifficulty(diff);
    if (isOnline && isHost) {
      networkClient.pushHostRoomConfig({ difficulty: diff });
    }
  };

  const handleCopyRoomCode = () => {
    const code = roomState?.roomCode || roomCode;
    if (!code) return;
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleStartMatch = () => {
    if (isOnline) {
      networkClient.requestStartMatch();
    } else {
      soundEngine.playMusic('battle');
      setScreen('PLAYING');
    }
  };

  const handleJoinLiveGame = () => {
    if (!isOnline) return;
    networkClient.requestJoinLiveMatch(effectiveTargetBotId ?? undefined);
  };

  const visibleHumans = isLiveJoinPending
    ? humanPlayers.filter((h) => h.inMatch !== false)
    : humanPlayers;
  const allRoster = [...visibleHumans, ...activeBots];
  const ironRoster = allRoster.filter((p) => p.team === 'iron');
  const crimsonRoster = allRoster.filter((p) => p.team === 'crimson');
  const activeHero = HEROES[localHeroId];

  const ironTitle =
    activeMode === 'stronghold'
      ? `${t(language, 'teamIron')} (${t(language, 'attackers')})`
      : t(language, 'teamIron');
  const crimsonTitle =
    activeMode === 'stronghold'
      ? `${t(language, 'teamCrimson')} (${t(language, 'defenders')})`
      : t(language, 'teamCrimson');

  const displayCode = roomState?.roomCode || roomCode || 'LOCAL';

  return (
    <div className="h-screen w-screen bg-[#0E1116] text-slate-100 flex flex-col overflow-y-auto">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 sm:gap-6 px-3 sm:px-6 lg:px-10 py-3 sm:py-4 border-b border-slate-800 bg-[#131820]">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={() => {
              networkClient.disconnectRoom();
              setScreen('MENU');
            }}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold bg-[#181D26] hover:bg-[#1F2631] border border-slate-700 rounded text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t(language, 'backToModes')}</span>
          </button>

          <h1 className="hidden sm:block font-display text-lg lg:text-xl font-bold text-slate-100 whitespace-nowrap truncate">
            {t(language, 'lobbyTitle')}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 font-mono tabular-nums">
            <span className={isOnline ? 'text-emerald-400' : 'text-slate-300'}>
              {isOnline ? t(language, 'serverLiveBadge') : t(language, 'soloLocalBadge')}
            </span>
            <span className="text-slate-600">·</span>
            <span data-testid="lobby-room-code" className="text-amber-400 font-bold">
              {displayCode}
            </span>
          </div>

          {isOnline && (
            <button
              type="button"
              onClick={handleCopyRoomCode}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold bg-[#181D26] hover:bg-[#1F2631] border border-slate-700 rounded text-amber-300 cursor-pointer whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t(language, 'copied') : t(language, 'copyCode')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setLanguage(language === 'pl' ? 'en' : 'pl')}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold bg-[#181D26] hover:bg-[#1F2631] border border-slate-700 rounded text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>{language.toUpperCase()}</span>
          </button>

          {isMobileDevice && (
            <button
              type="button"
              data-testid="mobile-fullscreen-btn"
              onClick={() => toggleFullscreen()}
              aria-label={t(language, isFullscreen ? 'fullscreenExit' : 'fullscreenEnter')}
              title={t(language, isFullscreen ? 'fullscreenExit' : 'fullscreenEnter')}
              className={`p-1.5 sm:p-2 bg-[#181D26] hover:bg-[#1F2631] border rounded cursor-pointer ${
                isFullscreen
                  ? 'border-amber-400 text-amber-300'
                  : 'border-slate-700 text-slate-200'
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
            data-testid="settings-modal-btn"
            onClick={() => setAudioModalOpen(true)}
            aria-label={t(language, 'audioModalTitle')}
            title={t(language, 'audioModalTitle')}
            className="p-1.5 sm:p-2 bg-[#181D26] hover:bg-[#1F2631] border border-slate-700 rounded text-slate-200 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-200" />
          </button>
        </div>
      </header>

      {/* Lobby Body */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 lg:px-10 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Hero & Color Variant Selector */}
        <section className="lg:col-span-5 bg-[#181D26] border border-slate-800 rounded-lg p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-100">
              {t(language, 'selectHero')}
            </h2>
            <span className="text-xs font-mono text-amber-400 tabular-nums">
              {language === 'pl' ? modeMeta.namePl : modeMeta.nameEn} · {language === 'pl' ? arena.namePl : arena.nameEn}
            </span>
          </div>

          <HeroSpritePreview
            heroId={localHeroId}
            skinIndex={localSkinIndex}
            language={language}
          />

          {/* Hero Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            {HERO_LIST.map((h) => {
              const active = localHeroId === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleSelectHero(h.id)}
                  className={`p-2.5 rounded border text-left transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    active
                      ? 'bg-[#262F3E] border-amber-500 text-slate-100'
                      : 'bg-[#0E1116] border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <img
                    src={h.avatarSrc}
                    alt={h.name}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded object-cover border border-slate-700"
                  />
                  <span className="font-display text-xs font-bold text-slate-100">{h.name}</span>
                  <span className="text-[10px] text-slate-400 text-center leading-tight">
                    {language === 'pl' ? h.classPl : h.classEn}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Hero Lore & Combat Stats */}
          <div className="bg-[#0E1116] border border-slate-800 rounded p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-amber-300">
                {activeHero.name} — {language === 'pl' ? activeHero.titlePl : activeHero.titleEn}
              </span>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                HP {activeHero.maxHp} · DMG {activeHero.lightDamage}/{activeHero.heavyDamage}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {language === 'pl' ? activeHero.lorePl : activeHero.loreEn}
            </p>
          </div>

          {/* 4 Color Variant Swatches */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold">{t(language, 'selectSkin')}</span>
              <span className="text-slate-200">
                {language === 'pl'
                  ? activeHero.skins[localSkinIndex].namePl
                  : activeHero.skins[localSkinIndex].nameEn}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {activeHero.skins.map((skin, idx) => {
                const active = localSkinIndex === idx;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => handleSelectSkin(idx)}
                    className={`flex items-center justify-center gap-2 py-2 px-2 rounded border text-xs cursor-pointer transition-all ${
                      active
                        ? 'bg-[#262F3E] border-amber-500 text-slate-100'
                        : 'bg-[#0E1116] border-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                      style={{ backgroundColor: skin.swatchHex }}
                    />
                    <span className="truncate text-[11px]">#{idx + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Teams, Bot Management & Start */}
        <section className="lg:col-span-7 flex flex-col gap-5">
          {/* Toolbar */}
          <div className="bg-[#181D26] border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSwapTeam}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0E1116] hover:bg-[#1F2631] border border-slate-700 rounded text-slate-200 cursor-pointer whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>{t(language, 'swapTeam')}</span>
              </button>

              {canEditLobby && (
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0E1116] hover:bg-[#1F2631] border border-slate-700 rounded text-amber-300 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t(language, 'fillBots')}</span>
                </button>
              )}
            </div>

            {canEditLobby && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{t(language, 'botDiffLabel')}:</span>
                <select
                  value={activeDifficulty}
                  onChange={(e) => handleDifficultyChange(e.target.value as BotDifficulty)}
                  className="bg-[#0E1116] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="recruit">{t(language, 'diffRecruit')}</option>
                  <option value="veteran">{t(language, 'diffVeteran')}</option>
                  <option value="warlord">{t(language, 'diffWarlord')}</option>
                </select>
              </div>
            )}

            {isLiveJoinPending && (
              <div
                data-testid="live-join-hint"
                className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-1"
              >
                {t(language, 'liveMatchLobbyHint')}
              </div>
            )}
          </div>

          {/* Two Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* IRON LEGION */}
            <div className="bg-[#181D26] border border-blue-500/30 rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <h3 className="font-display text-sm font-bold text-blue-200">{ironTitle}</h3>
                </div>
                {canEditLobby && ironRoster.length < 4 && (
                  <button
                    type="button"
                    onClick={() => handleAddBot('iron')}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/40 rounded text-blue-200 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t(language, 'addBot')}</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {ironRoster.map((p) => {
                  const isReplacingThisBot = isLiveJoinPending && p.isBot && p.id === effectiveTargetBotId;
                  const isSelectableBot = isLiveJoinPending && p.isBot;
                  const displayHero = isReplacingThisBot ? HEROES[localHeroId] : HEROES[p.heroId];
                  const content = (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={displayHero.avatarSrc}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded object-cover border border-blue-500/40 shrink-0"
                        />
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {isReplacingThisBot
                              ? `${playerName || (language === 'pl' ? 'Wojownik' : 'Warrior')} (${t(language, 'youLabel')})`
                              : `${p.name} ${p.isLocal ? `(${t(language, 'youLabel')})` : ''}`}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            {p.isBot && !isReplacingThisBot && <Bot className="w-3 h-3 text-amber-400 shrink-0" />}
                            {isReplacingThisBot ? (
                              <span className="text-emerald-300 font-semibold leading-tight">
                                {displayHero.name} · {t(language, 'replacingBotBadge')}: {p.name}
                              </span>
                            ) : (
                              <span className="truncate">
                                {displayHero.name} · {p.isBot ? t(language, 'botLabel') : 'HUMAN'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelectableBot && !isReplacingThisBot && (
                        <span className="text-[11px] font-semibold text-amber-300 shrink-0 whitespace-nowrap">
                          {t(language, 'clickBotToReplace')}
                        </span>
                      )}

                      {p.isBot && canEditLobby && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBot(p.id)}
                          aria-label={t(language, 'removeBot')}
                          className="p-1.5 text-slate-400 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  );

                  if (isSelectableBot) {
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-testid={`bot-slot-${p.id}`}
                        onClick={() => handleSelectBotSlot(p)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded border transition-colors cursor-pointer ${
                          isReplacingThisBot
                            ? 'bg-emerald-500/15 border-emerald-400'
                            : 'bg-[#0E1116] border-slate-800 hover:border-amber-500/60'
                        }`}
                      >
                        {content}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0E1116] border border-slate-800 rounded"
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CRIMSON DAWN */}
            <div className="bg-[#181D26] border border-red-500/30 rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red-400" />
                  <h3 className="font-display text-sm font-bold text-red-200">{crimsonTitle}</h3>
                </div>
                {canEditLobby && crimsonRoster.length < 4 && (
                  <button
                    type="button"
                    onClick={() => handleAddBot('crimson')}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 rounded text-red-200 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t(language, 'addBot')}</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {crimsonRoster.map((p) => {
                  const isReplacingThisBot = isLiveJoinPending && p.isBot && p.id === effectiveTargetBotId;
                  const isSelectableBot = isLiveJoinPending && p.isBot;
                  const displayHero = isReplacingThisBot ? HEROES[localHeroId] : HEROES[p.heroId];
                  const content = (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={displayHero.avatarSrc}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded object-cover border border-red-500/40 shrink-0"
                        />
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {isReplacingThisBot
                              ? `${playerName || (language === 'pl' ? 'Wojownik' : 'Warrior')} (${t(language, 'youLabel')})`
                              : `${p.name} ${p.isLocal ? `(${t(language, 'youLabel')})` : ''}`}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            {p.isBot && !isReplacingThisBot && <Bot className="w-3 h-3 text-amber-400 shrink-0" />}
                            {isReplacingThisBot ? (
                              <span className="text-emerald-300 font-semibold leading-tight">
                                {displayHero.name} · {t(language, 'replacingBotBadge')}: {p.name}
                              </span>
                            ) : (
                              <span className="truncate">
                                {displayHero.name} · {p.isBot ? t(language, 'botLabel') : 'HUMAN'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelectableBot && !isReplacingThisBot && (
                        <span className="text-[11px] font-semibold text-amber-300 shrink-0 whitespace-nowrap">
                          {t(language, 'clickBotToReplace')}
                        </span>
                      )}

                      {p.isBot && canEditLobby && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBot(p.id)}
                          aria-label={t(language, 'removeBot')}
                          className="p-1.5 text-slate-400 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  );

                  if (isSelectableBot) {
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-testid={`bot-slot-${p.id}`}
                        onClick={() => handleSelectBotSlot(p)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded border transition-colors cursor-pointer ${
                          isReplacingThisBot
                            ? 'bg-emerald-500/15 border-emerald-400'
                            : 'bg-[#0E1116] border-slate-800 hover:border-amber-500/60'
                        }`}
                      >
                        {content}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0E1116] border border-slate-800 rounded"
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Launch Match Bar */}
          <div className="bg-[#181D26] border border-slate-800 rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="text-xs text-slate-300 font-mono tabular-nums">
              {ironRoster.length} vs {crimsonRoster.length} · {language === 'pl' ? arena.namePl : arena.nameEn}
            </div>

            {isLiveJoinPending ? (
              <button
                type="button"
                data-testid="join-live-game-btn"
                disabled={activeBots.length === 0}
                onClick={handleJoinLiveGame}
                className="px-7 py-3 rounded bg-emerald-500 hover:bg-emerald-400 text-[#0E1116] font-bold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 disabled:opacity-40"
              >
                <Swords className="w-4 h-4" />
                <span>{t(language, 'joinGameBtn')}</span>
              </button>
            ) : isHost ? (
              <button
                type="button"
                disabled={ironRoster.length === 0 || crimsonRoster.length === 0}
                onClick={handleStartMatch}
                className="px-7 py-3 rounded bg-amber-500 hover:bg-amber-400 text-[#0E1116] font-bold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 disabled:opacity-40"
              >
                <Swords className="w-4 h-4" />
                <span>{t(language, 'startMatch')}</span>
              </button>
            ) : (
              <span className="text-xs font-semibold text-amber-300">
                {t(language, 'waitingHost')}
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

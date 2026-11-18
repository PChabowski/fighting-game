import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Crosshair,
  Gamepad2,
  Keyboard,
  LogOut,
  Maximize2,
  Minimize2,
  Mouse,
  RotateCcw,
  Settings,
  Shield,
  Smartphone,
  Swords,
} from 'lucide-react';
import { GameSimulation, emptyInput } from '../game/GameSimulation';
import { CanvasRenderer } from '../game/CanvasRenderer';
import { HEROES } from '../game/heroes';
import {
  clampVirtualCursor,
  cycleLockTarget,
  resolveGuardFromVector,
  resolveValidLockTarget,
  toggleFocusTarget,
} from '../game/combat/targeting';
import {
  findActiveGamepad,
  pollXboxGamepad,
  triggerGamepadRumble,
} from '../game/input/gamepadDriver';
import { NetPredictor } from '../game/net/netPredictor';
import { networkClient } from '../game/net/networkClient';
import { RoomStatePayload } from '../game/net/protocol';
import { soundEngine } from '../game/audio/soundEngine';
import { t } from '../i18n/translations';
import { useAppStore } from '../store/useAppStore';
import { useMobileFullscreen } from '../utils/mobileFullscreen';
import { MobileTouchControls, MobileTouchHandlers } from './MobileTouchControls';
import {
  GuardDirection,
  LobbyParticipant,
  PlayerInputState,
  WorldSnapshot,
} from '../game/types';

const ArenaCanvas = React.memo(
  React.forwardRef<HTMLCanvasElement, { hideCursor: boolean }>(({ hideCursor }, ref) => (
    <canvas
      ref={ref}
      data-testid="arena-canvas"
      className={`block w-full h-full touch-none ${hideCursor ? 'cursor-none' : 'cursor-default'}`}
    />
  ))
);

export const GameArenaView: React.FC = () => {
  const {
    language,
    selectedMode,
    selectedArenaId,
    botDifficulty,
    controlScheme,
    setControlScheme,
    touchControlsMode,
    setTouchControlsMode,
    gamepadConnected,
    setGamepadStatus,
    playerName,
    localHeroId,
    localSkinIndex,
    localTeam,
    localPlayerId,
    networkStatus,
    bots,
    matchRunId,
    triggerRematch,
    setNetworkConnection,
    setScreen,
    audioModalOpen,
    setAudioModalOpen,
    snapshot,
    setSnapshot,
  } = useAppStore();

  const arenaRootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<GameSimulation | null>(null);
  const predictorRef = useRef<NetPredictor>(new NetPredictor(localPlayerId));
  const rendererRef = useRef<CanvasRenderer>(new CanvasRenderer());
  const isOnline = networkStatus === 'online';
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(() =>
    networkClient.getRoomState()
  );
  const isHost = isOnline ? roomState?.hostId === localPlayerId : true;

  const { isMobileDevice, isFullscreen, toggleFullscreen } = useMobileFullscreen();
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);
  const [touchGuardDir, setTouchGuardDir] = useState<GuardDirection>('top');

  const keysHeld = useRef<Set<string>>(new Set());
  const lastHorizDirRef = useRef<number>(0);
  const touchMoveXRef = useRef<number>(0);
  const touchUpRef = useRef<boolean>(false);
  const touchDownRef = useRef<boolean>(false);
  const prevGamepadButtonsRef = useRef<boolean[]>([]);
  const pendingInput = useRef<PlayerInputState>({ ...emptyInput() });
  const virtualCursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lockedTargetRef = useRef<string | null>(null);
  const latestSnapshotRef = useRef<WorldSnapshot | null>(null);
  const seenCalloutIdRef = useRef<number>(0);
  const prevFighterActionRef = useRef<Record<string, string>>({});
  const seqRef = useRef<number>(1);
  const schemeRef = useRef(controlScheme);
  schemeRef.current = controlScheme;
  const modalOpenRef = useRef(audioModalOpen);
  modalOpenRef.current = audioModalOpen;

  const showTouch =
    touchControlsMode === 'on' || (touchControlsMode === 'auto' && isMobileDevice);

  // Reset centered mouse cursor vector when switching control scheme
  useEffect(() => {
    virtualCursorRef.current = { x: 0, y: 0 };
    if (controlScheme !== 'mouse' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore
      }
    }
  }, [controlScheme]);

  // Release pointer lock cleanly when modal opens or match ends
  useEffect(() => {
    if ((audioModalOpen || snapshot?.phase === 'ended') && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore
      }
    }
  }, [audioModalOpen, snapshot?.phase]);

  // Subscribe to online room state transitions (e.g., host migration, rematch votes, or return to LOBBY)
  useEffect(() => {
    if (!isOnline) return;
    setRoomState(networkClient.getRoomState());
    return networkClient.subscribeRoomState((room) => {
      if (!room) {
        setRoomState(null);
        setScreen('MENU');
        return;
      }
      setRoomState(room);
      if (room.phase === 'LOBBY') {
        soundEngine.playMusic('menu');
        setScreen('LOBBY');
      }
    });
  }, [isOnline, setScreen]);

  // Initialize local simulation (when local) or bind NetPredictor + WS stream (when online)
  useEffect(() => {
    lockedTargetRef.current = null;
    setLockedTargetId(null);
    virtualCursorRef.current = { x: 0, y: 0 };
    seenCalloutIdRef.current = 0;
    prevFighterActionRef.current = {};
    lastHorizDirRef.current = 0;
    touchMoveXRef.current = 0;
    touchUpRef.current = false;
    touchDownRef.current = false;
    predictorRef.current.reset(localPlayerId);

    if (!isOnline) {
      const roster: LobbyParticipant[] = [
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
        ...bots,
      ];

      simRef.current = new GameSimulation(
        selectedMode,
        selectedArenaId,
        botDifficulty,
        roster
      );
      const initSnap = simRef.current.getSnapshot();
      latestSnapshotRef.current = initSnap;
      setSnapshot({ ...initSnap });
      return () => {
        simRef.current = null;
      };
    }

    simRef.current = null;
    const existingSnap = networkClient.getLatestSnapshot();
    if (existingSnap) {
      predictorRef.current.onServerSnapshot(existingSnap);
      latestSnapshotRef.current = existingSnap;
      setSnapshot({ ...existingSnap });
    }

    const unsubSnap = networkClient.subscribeSnapshots((snap) => {
      if (snap.phase === 'countdown' && snap.callouts.length === 0) {
        seenCalloutIdRef.current = 0;
      }
      predictorRef.current.onServerSnapshot(snap);
      for (const f of snap.fighters) {
        const prevAct = prevFighterActionRef.current[f.id];
        if (prevAct !== f.actionState) {
          if (f.actionState === 'active_light') soundEngine.playSwing(false);
          else if (f.actionState === 'active_heavy' || f.actionState === 'active_counter') {
            soundEngine.playSwing(true);
          }
          prevFighterActionRef.current[f.id] = f.actionState;
        }
      }
      for (const c of snap.callouts) {
        if (c.id <= seenCalloutIdRef.current) continue;
        seenCalloutIdRef.current = Math.max(seenCalloutIdRef.current, c.id);
        if (c.textEn === 'PARRY!') {
          soundEngine.playParry();
          triggerGamepadRumble(0.85, 160);
        } else if (c.textEn === 'COUNTER!') {
          soundEngine.playCounterHit();
          triggerGamepadRumble(0.9, 140);
        } else if (c.textEn === 'BLOCK') {
          soundEngine.playBlock();
          triggerGamepadRumble(0.35, 70);
        } else if (c.textEn.includes('CAPTURED')) {
          soundEngine.playZoneCapture();
        } else if (c.textEn.startsWith('-')) {
          soundEngine.playHit(false);
          triggerGamepadRumble(0.45, 90);
        }
      }
    });

    return () => {
      unsubSnap();
      simRef.current = null;
      if (document.pointerLockElement) {
        try {
          document.exitPointerLock();
        } catch {
          // ignore
        }
      }
    };
  }, [
    matchRunId,
    isOnline,
    selectedMode,
    selectedArenaId,
    botDifficulty,
    localPlayerId,
    playerName,
    localTeam,
    localHeroId,
    localSkinIndex,
    bots,
    language,
    setSnapshot,
  ]);

  const computeCurrentMoveX = (): number => {
    if (modalOpenRef.current) return 0;
    const a = keysHeld.current.has('KeyA');
    const d = keysHeld.current.has('KeyD');
    if (a && d) return lastHorizDirRef.current || 0;
    if (a) return -1;
    if (d) return 1;
    return touchMoveXRef.current;
  };

  const flushImmediateOnlinePulse = () => {
    if (!isOnline) return;
    const pulse: PlayerInputState = {
      ...pendingInput.current,
      moveX: computeCurrentMoveX(),
      upHeld:
        !modalOpenRef.current &&
        (keysHeld.current.has('KeyW') || touchUpRef.current),
      downHeld:
        !modalOpenRef.current &&
        (keysHeld.current.has('KeyS') ||
          keysHeld.current.has('ArrowDown') ||
          touchDownRef.current),
      lockedTargetId: lockedTargetRef.current,
      seq: seqRef.current++,
    };
    networkClient.sendPlayerInput(pulse);
  };

  const toggleFocus = () => {
    const snap = latestSnapshotRef.current;
    const me = snap?.fighters.find((f) => f.id === localPlayerId);
    if (snap && me && me.alive) {
      const nextId = toggleFocusTarget(me, snap.fighters, lockedTargetRef.current);
      lockedTargetRef.current = nextId;
      setLockedTargetId(nextId);
      flushImmediateOnlinePulse();
    }
  };

  const cycleFocusTarget = () => {
    const snap = latestSnapshotRef.current;
    const me = snap?.fighters.find((f) => f.id === localPlayerId);
    if (snap && me && me.alive) {
      const nextId = cycleLockTarget(me, snap.fighters, lockedTargetRef.current);
      lockedTargetRef.current = nextId;
      setLockedTargetId(nextId);
      flushImmediateOnlinePulse();
    }
  };

  // Keyboard & Centered Mouse Input Listeners + Alt Lock-On (with instant WS flush)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (modalOpenRef.current) return;
      const code = e.code;
      const firstPress = !keysHeld.current.has(code);
      keysHeld.current.add(code);

      if (code === 'KeyA') lastHorizDirRef.current = -1;
      if (code === 'KeyD') lastHorizDirRef.current = 1;

      if (
        ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft', 'AltRight'].includes(
          code
        )
      ) {
        e.preventDefault();
      }

      let changed = false;

      if (firstPress && (code === 'AltLeft' || code === 'AltRight')) {
        toggleFocus();
      }

      if (firstPress && code === 'Tab') {
        cycleFocusTarget();
      }

      if (firstPress && code === 'KeyC') {
        lockedTargetRef.current = null;
        setLockedTargetId(null);
        changed = true;
      }

      if (code === 'KeyI' || code === 'ArrowUp') {
        if (pendingInput.current.guardDir !== 'top') changed = true;
        pendingInput.current.guardDir = 'top';
        setTouchGuardDir('top');
      }
      if (code === 'KeyJ' || code === 'ArrowLeft') {
        if (pendingInput.current.guardDir !== 'left') changed = true;
        pendingInput.current.guardDir = 'left';
        setTouchGuardDir('left');
      }
      if (code === 'KeyL' || code === 'ArrowRight') {
        if (pendingInput.current.guardDir !== 'right') changed = true;
        pendingInput.current.guardDir = 'right';
        setTouchGuardDir('right');
      }

      if (firstPress) {
        if (code === 'KeyA' || code === 'KeyD' || code === 'KeyS' || code === 'ArrowDown') {
          changed = true;
        }
        if (code === 'KeyW' || code === 'Space') {
          pendingInput.current.jumpPressed = true;
          changed = true;
        }
        if (code === 'ShiftLeft' || code === 'ShiftRight') {
          pendingInput.current.dashPressed = true;
          changed = true;
        }
        if (code === 'KeyK' || code === 'KeyU') {
          pendingInput.current.lightPressed = true;
          changed = true;
        }
        if (code === 'KeyO' || code === 'Enter') {
          pendingInput.current.heavyPressed = true;
          changed = true;
        }
        if (code === 'KeyR') {
          pendingInput.current.parryPressed = true;
          changed = true;
        }
        if (code === 'KeyE') {
          pendingInput.current.feintPressed = true;
          changed = true;
        }
        if (code === 'KeyF') {
          pendingInput.current.counterPressed = true;
          changed = true;
        }
      }

      if (changed) flushImmediateOnlinePulse();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.current.delete(e.code);
      if (e.code === 'KeyA' && keysHeld.current.has('KeyD')) lastHorizDirRef.current = 1;
      else if (e.code === 'KeyD' && keysHeld.current.has('KeyA')) lastHorizDirRef.current = -1;
      else if (e.code === 'KeyA' || e.code === 'KeyD') lastHorizDirRef.current = 0;

      if (
        e.code === 'KeyA' ||
        e.code === 'KeyD' ||
        e.code === 'KeyW' ||
        e.code === 'KeyS' ||
        e.code === 'ArrowDown'
      ) {
        flushImmediateOnlinePulse();
      }
    };

    const onWindowBlur = () => {
      keysHeld.current.clear();
      lastHorizDirRef.current = 0;
      touchMoveXRef.current = 0;
      touchUpRef.current = false;
      touchDownRef.current = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (modalOpenRef.current || schemeRef.current !== 'mouse') return;

      let nextDir: GuardDirection | null = null;
      if (document.pointerLockElement === canvasRef.current) {
        const nextVec = clampVirtualCursor(
          virtualCursorRef.current.x + e.movementX,
          virtualCursorRef.current.y + e.movementY,
          26
        );
        virtualCursorRef.current = nextVec;
        nextDir = resolveGuardFromVector(nextVec.x, nextVec.y, 7);
      } else {
        const pos = rendererRef.current.getLocalFighterScreenPos();
        const clamped = clampVirtualCursor(e.clientX - pos.x, e.clientY - pos.y, 26);
        virtualCursorRef.current = clamped;
        nextDir = resolveGuardFromVector(e.clientX - pos.x, e.clientY - pos.y, 10);
      }
      if (nextDir && nextDir !== pendingInput.current.guardDir) {
        pendingInput.current.guardDir = nextDir;
        flushImmediateOnlinePulse();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (modalOpenRef.current || schemeRef.current !== 'mouse') return;
      if ((e.target as HTMLElement)?.tagName !== 'CANVAS') return;

      if (
        canvasRef.current &&
        document.pointerLockElement !== canvasRef.current &&
        latestSnapshotRef.current?.phase !== 'ended'
      ) {
        try {
          const maybePromise = canvasRef.current.requestPointerLock?.() as unknown as Promise<void> | undefined;
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch(() => {});
          }
        } catch {
          // sandbox fallback uses relative player-center vector + cursor-none
        }
      }

      if (e.button === 0) {
        pendingInput.current.lightPressed = true;
        flushImmediateOnlinePulse();
      }
      if (e.button === 2) {
        pendingInput.current.heavyPressed = true;
        flushImmediateOnlinePulse();
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'CANVAS') e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, [localPlayerId, isOnline]);

  // Smooth 60fps simulation / NetPredictor + Xbox Gamepad polling loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    document.addEventListener('fullscreenchange', handleResize);

    let raf = 0;
    let lastTime = performance.now();
    let netSendTimer = 0;
    let hudTimer = 0;
    let lastPhase = '';
    let lastSentContinuous = '';

    const tick = (now: number) => {
      const rawDelta = Math.max(1, now - lastTime);
      const frameDelta = Math.min(200, rawDelta);
      lastTime = now;

      // Poll Xbox / standard Gamepad every frame
      const padRes = pollXboxGamepad(findActiveGamepad(), prevGamepadButtonsRef.current);
      if (padRes.connected) {
        prevGamepadButtonsRef.current = padRes.nextButtons;
        if (padRes.menuTogglePressed) {
          setAudioModalOpen(!modalOpenRef.current);
        }
        if (!modalOpenRef.current) {
          if (padRes.lockTogglePressed) toggleFocus();
          if (padRes.lockCyclePressed) cycleFocusTarget();
          if (padRes.lockClearPressed) {
            lockedTargetRef.current = null;
            setLockedTargetId(null);
          }
          if (padRes.guardDir) {
            pendingInput.current.guardDir = padRes.guardDir;
          }
          if (padRes.jumpPressed) pendingInput.current.jumpPressed = true;
          if (padRes.dashPressed) pendingInput.current.dashPressed = true;
          if (padRes.lightPressed) pendingInput.current.lightPressed = true;
          if (padRes.heavyPressed) pendingInput.current.heavyPressed = true;
          if (padRes.parryPressed) pendingInput.current.parryPressed = true;
          if (padRes.feintPressed) pendingInput.current.feintPressed = true;
          if (padRes.counterPressed) pendingInput.current.counterPressed = true;
        }
      }

      const kbMoveX = computeCurrentMoveX();
      const finalMoveX = kbMoveX !== 0 ? kbMoveX : padRes.connected && !modalOpenRef.current ? padRes.moveX : 0;
      const upHeld =
        !modalOpenRef.current &&
        (keysHeld.current.has('KeyW') ||
          touchUpRef.current ||
          (padRes.connected && padRes.upHeld));
      const downHeld =
        !modalOpenRef.current &&
        (keysHeld.current.has('KeyS') ||
          keysHeld.current.has('ArrowDown') ||
          touchDownRef.current ||
          (padRes.connected && padRes.downHeld));

      const stepInput: PlayerInputState = {
        ...pendingInput.current,
        moveX: finalMoveX,
        upHeld,
        downHeld,
        lockedTargetId: lockedTargetRef.current,
        seq: seqRef.current++,
      };

      const hasActionPulse =
        stepInput.jumpPressed ||
        stepInput.dashPressed ||
        stepInput.lightPressed ||
        stepInput.heavyPressed ||
        stepInput.parryPressed ||
        stepInput.feintPressed ||
        stepInput.counterPressed;

      pendingInput.current.jumpPressed = false;
      pendingInput.current.dashPressed = false;
      pendingInput.current.lightPressed = false;
      pendingInput.current.heavyPressed = false;
      pendingInput.current.parryPressed = false;
      pendingInput.current.feintPressed = false;
      pendingInput.current.counterPressed = false;

      let activeSnap: WorldSnapshot | null = null;

      if (!isOnline && simRef.current) {
        const subSteps = Math.max(1, Math.ceil(frameDelta / 20));
        const subDt = frameDelta / subSteps;

        for (let s = 0; s < subSteps; s++) {
          const inputs: Record<string, PlayerInputState> = {
            [localPlayerId]:
              s === 0
                ? stepInput
                : {
                    ...stepInput,
                    jumpPressed: false,
                    dashPressed: false,
                    lightPressed: false,
                    heavyPressed: false,
                    parryPressed: false,
                    feintPressed: false,
                    counterPressed: false,
                  },
          };
          simRef.current.step(subDt, inputs);
        }

        activeSnap = simRef.current.getSnapshot();
      } else {
        netSendTimer += frameDelta;
        const contKey = `${stepInput.moveX}:${stepInput.upHeld}:${stepInput.downHeld}:${stepInput.guardDir}:${stepInput.lockedTargetId ?? ''}`;
        if (hasActionPulse || contKey !== lastSentContinuous || netSendTimer >= 32) {
          netSendTimer = 0;
          lastSentContinuous = contKey;
          networkClient.sendPlayerInput(stepInput);
        }

        predictorRef.current.predictLocalStep(frameDelta, stepInput);
        activeSnap = predictorRef.current.buildRenderSnapshot(frameDelta);
      }

      if (activeSnap) {
        latestSnapshotRef.current = activeSnap;

        const me = activeSnap.fighters.find((f) => f.id === localPlayerId);
        const validLock = resolveValidLockTarget(me, activeSnap.fighters, lockedTargetRef.current);
        if (validLock !== lockedTargetRef.current) {
          lockedTargetRef.current = validLock;
          setLockedTargetId(validLock);
        }

        rendererRef.current.render(
          ctx,
          canvas,
          activeSnap,
          localPlayerId,
          language,
          frameDelta,
          lockedTargetRef.current,
          schemeRef.current,
          schemeRef.current === 'mouse' ? virtualCursorRef.current : null
        );

        hudTimer += frameDelta;
        if (hudTimer >= 160 || activeSnap.phase !== lastPhase || activeSnap.phase === 'ended') {
          hudTimer = 0;
          lastPhase = activeSnap.phase;
          setSnapshot({ ...activeSnap });
          if (me) setTouchGuardDir(me.guardDir);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, [isOnline, localPlayerId, language, setSnapshot, setAudioModalOpen, setGamepadStatus]);

  const handleLeaveMatch = () => {
    if (isOnline) {
      networkClient.disconnectRoom();
      setNetworkConnection('idle', '', localPlayerId);
      setSnapshot(null);
      soundEngine.playMusic('menu');
      setScreen('MENU');
      return;
    }
    soundEngine.playMusic('menu');
    setScreen('LOBBY');
  };

  const handleReturnLobby = () => {
    if (isOnline) {
      if (isHost) {
        networkClient.requestReturnLobby();
      } else {
        networkClient.disconnectRoom();
        setNetworkConnection('idle', '', localPlayerId);
        setSnapshot(null);
        soundEngine.playMusic('menu');
        setScreen('MENU');
      }
      return;
    }
    soundEngine.playMusic('menu');
    setScreen('LOBBY');
  };

  const handleRematch = () => {
    if (isOnline) {
      networkClient.requestRematch();
    } else {
      triggerRematch();
    }
  };

  const rematchVotes = isOnline ? roomState?.rematchVotes ?? [] : [];
  const rematchEligibleCount = isOnline
    ? roomState?.rematchEligibleCount ??
      roomState?.humans.filter((h) => h.inMatch !== false).length ??
      1
    : 1;
  const isRematchVoteMode = isOnline && rematchEligibleCount > 1;
  const hasVotedRematch = rematchVotes.includes(localPlayerId);

  const localFighter = snapshot?.fighters.find((f) => f.id === localPlayerId);
  const lockedFighter = lockedTargetId
    ? snapshot?.fighters.find((f) => f.id === lockedTargetId && f.alive)
    : undefined;

  const touchHandlers = useMemo<MobileTouchHandlers>(
    () => ({
      onMoveX: (mx) => {
        touchMoveXRef.current = mx;
        flushImmediateOnlinePulse();
      },
      onUpHeld: (held) => {
        touchUpRef.current = held;
      },
      onDownHeld: (held) => {
        touchDownRef.current = held;
      },
      onJump: () => {
        pendingInput.current.jumpPressed = true;
        flushImmediateOnlinePulse();
      },
      onDash: () => {
        pendingInput.current.dashPressed = true;
        flushImmediateOnlinePulse();
      },
      onGuard: (dir) => {
        pendingInput.current.guardDir = dir;
        setTouchGuardDir(dir);
        flushImmediateOnlinePulse();
      },
      onLight: () => {
        pendingInput.current.lightPressed = true;
        flushImmediateOnlinePulse();
      },
      onHeavy: () => {
        pendingInput.current.heavyPressed = true;
        flushImmediateOnlinePulse();
      },
      onParry: () => {
        pendingInput.current.parryPressed = true;
        flushImmediateOnlinePulse();
      },
      onCounter: () => {
        pendingInput.current.counterPressed = true;
        flushImmediateOnlinePulse();
      },
      onFeint: () => {
        pendingInput.current.feintPressed = true;
        flushImmediateOnlinePulse();
      },
      onToggleFocus: () => {
        toggleFocus();
      },
      onCycleTarget: () => {
        cycleFocusTarget();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOnline, localPlayerId]
  );

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hideCursor =
    controlScheme === 'mouse' && !showTouch && !audioModalOpen && snapshot?.phase !== 'ended';

  return (
    <div
      ref={arenaRootRef}
      data-testid="arena-root"
      data-phase={snapshot?.phase ?? 'loading'}
      data-locked-target={lockedTargetId ?? ''}
      className="fixed inset-0 bg-[#0E1116] overflow-hidden select-none touch-none"
    >
      <ArenaCanvas ref={canvasRef} hideCursor={hideCursor} />

      {/* Top HUD Bar */}
      {snapshot && (
        <div className="pointer-events-none fixed top-0 inset-x-0 z-20 flex items-start justify-between px-2 sm:px-4 lg:px-8 pt-2 sm:pt-3 gap-1.5 sm:gap-4">
          <div className="bg-[#0E1116]/85 border border-blue-500/40 rounded px-2 sm:px-4 py-1 sm:py-2 [@media(max-height:520px)]:px-2 [@media(max-height:520px)]:py-1 min-w-[78px] sm:min-w-[140px]">
            <div className="text-[10px] sm:text-[11px] font-semibold text-blue-300 flex items-center justify-between gap-1 sm:gap-2">
              <span className="truncate max-w-[72px] sm:max-w-none">{t(language, 'teamIron')}</span>
              {snapshot.breakingTeam === 'iron' && (
                <span className="text-red-400 font-bold">{t(language, 'breakingAlert')}</span>
              )}
            </div>
            <div className="font-mono text-sm sm:text-xl [@media(max-height:520px)]:text-sm font-bold text-slate-100 tabular-nums leading-tight">
              {Math.round(snapshot.ironScore)}
              <span className="text-[10px] sm:text-xs text-slate-400 font-normal"> / {snapshot.scoreLimit}</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 sm:gap-2 min-w-0">
            <div className="bg-[#0E1116]/90 border border-slate-700/80 rounded px-2.5 sm:px-5 py-0.5 sm:py-1.5 text-center">
              <div className="font-mono text-sm sm:text-lg font-bold text-amber-300 tabular-nums">
                {formatClock(snapshot.matchTimerSec)}
              </div>
              {(selectedMode === 'duel_1v1' || selectedMode === 'brawl_2v2') && (
                <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono tabular-nums">
                  {t(language, 'round')} {snapshot.currentRound}
                </div>
              )}
            </div>

            {snapshot.zones.length > 0 && (
              <div className="flex items-center gap-1 sm:gap-2 bg-[#0E1116]/85 border border-slate-800 rounded px-1.5 sm:px-2.5 py-0.5 sm:py-1">
                {snapshot.zones.map((z) => {
                  const bg =
                    z.owner === 'iron'
                      ? 'bg-blue-600/80 border-blue-400 text-white'
                      : z.owner === 'crimson'
                      ? 'bg-red-600/80 border-red-400 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-300';
                  return (
                    <div
                      key={z.id}
                      className={`px-1.5 sm:px-2 py-0.5 rounded border text-[10px] sm:text-xs font-mono font-bold tabular-nums ${bg}`}
                    >
                      {z.id} {z.contested ? '⚔' : z.boosted ? '+★' : ''}
                    </div>
                  );
                })}
              </div>
            )}

            {snapshot.gate && (
              <div className="bg-[#0E1116]/90 border border-amber-500/40 rounded px-2.5 sm:px-3 py-1 sm:py-1.5 w-36 sm:w-60">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-amber-200 mb-1 font-mono tabular-nums">
                  <span>{t(language, 'gateLabel')}</span>
                  <span>
                    {Math.round(snapshot.gate.hp)} / {snapshot.gate.maxHp}
                  </span>
                </div>
                <div className="w-full h-1.5 sm:h-2 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${(snapshot.gate.hp / snapshot.gate.maxHp) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-1.5 sm:gap-2">
            <div className="bg-[#0E1116]/85 border border-red-500/40 rounded px-2 sm:px-4 py-1 sm:py-2 [@media(max-height:520px)]:px-2 [@media(max-height:520px)]:py-1 min-w-[78px] sm:min-w-[140px] text-right">
              <div className="text-[10px] sm:text-[11px] font-semibold text-red-300 flex items-center justify-between gap-1 sm:gap-2">
                {snapshot.breakingTeam === 'crimson' && (
                  <span className="text-amber-400 font-bold">{t(language, 'breakingAlert')}</span>
                )}
                <span className="ml-auto truncate max-w-[72px] sm:max-w-none">{t(language, 'teamCrimson')}</span>
              </div>
              <div className="font-mono text-sm sm:text-xl [@media(max-height:520px)]:text-sm font-bold text-slate-100 tabular-nums leading-tight">
                {Math.round(snapshot.crimsonScore)}
                <span className="text-[10px] sm:text-xs text-slate-400 font-normal"> / {snapshot.scoreLimit}</span>
              </div>
            </div>

            <div className="pointer-events-auto flex flex-col [@media(max-height:520px)]:grid [@media(max-height:520px)]:grid-cols-2 gap-1 sm:gap-1.5 shrink-0">
              {isMobileDevice && (
                <button
                  type="button"
                  data-testid="mobile-fullscreen-btn"
                  onClick={() => toggleFullscreen(arenaRootRef.current)}
                  aria-label={t(language, isFullscreen ? 'fullscreenExit' : 'fullscreenEnter')}
                  title={t(language, isFullscreen ? 'fullscreenExit' : 'fullscreenEnter')}
                  className={`p-1.5 sm:p-2 bg-[#0E1116]/90 hover:bg-[#1F2631] border rounded cursor-pointer ${
                    isFullscreen
                      ? 'border-amber-400 text-amber-300'
                      : 'border-slate-700 text-slate-200'
                  }`}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                data-testid="settings-modal-btn"
                onClick={() => setAudioModalOpen(true)}
                aria-label={t(language, 'audioModalTitle')}
                title={t(language, 'audioModalTitle')}
                className="p-1.5 sm:p-2 bg-[#0E1116]/90 hover:bg-[#1F2631] border border-slate-700 rounded text-slate-200 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setControlScheme(controlScheme === 'mouse' ? 'keyboard' : 'mouse')
                }
                aria-label={t(language, 'controlSchemeLabel')}
                title={t(language, 'controlSchemeLabel')}
                className="p-1.5 sm:p-2 bg-[#0E1116]/90 hover:bg-[#1F2631] border border-slate-700 rounded text-amber-300 cursor-pointer"
              >
                {controlScheme === 'mouse' ? (
                  <Mouse className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <Keyboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setTouchControlsMode(showTouch ? 'off' : 'on')}
                aria-label={t(language, 'touchControlsLabel')}
                title={t(language, 'touchControlsLabel')}
                className={`p-1.5 sm:p-2 bg-[#0E1116]/90 hover:bg-[#1F2631] border rounded cursor-pointer ${
                  showTouch
                    ? 'border-sky-400 text-sky-300'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              {gamepadConnected && (
                <div
                  title={t(language, 'xboxTitle')}
                  className="p-1.5 sm:p-2 bg-[#0E1116]/90 border border-emerald-500/60 rounded text-emerald-400 flex items-center justify-center"
                >
                  <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              )}
              <button
                type="button"
                data-testid="leave-match-btn"
                onClick={handleLeaveMatch}
                aria-label={t(language, 'leaveMatch')}
                title={t(language, 'leaveMatch')}
                className="p-1.5 sm:p-2 bg-[#0E1116]/90 hover:bg-red-950 border border-slate-700 rounded text-slate-200 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Countdown Banner */}
      {snapshot && snapshot.phase === 'countdown' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <div className="font-display text-6xl font-extrabold text-amber-400 drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)] tabular-nums">
            {snapshot.countdownSec > 0 ? snapshot.countdownSec : 'FIGHT!'}
          </div>
        </div>
      )}

      {/* Local Fighter Status Card (auto-shifts upward when Mobile Touch Controls are active so thumbs never collide!) */}
      {localFighter && (
        <div
          className={`pointer-events-none fixed z-20 bg-[#0E1116]/90 border border-slate-700/80 rounded-lg p-2 sm:p-3 space-y-1 sm:space-y-2 ${
            showTouch
              ? 'top-20 sm:top-20 left-2 sm:left-3 w-44 sm:w-60 [@media(max-height:520px)]:top-[60px] [@media(max-height:520px)]:left-2 [@media(max-height:520px)]:w-44 [@media(max-height:520px)]:p-1.5 [@media(max-height:520px)]:space-y-1'
              : 'bottom-4 left-4 w-64'
          }`}
        >
          <div className="flex items-center justify-between text-xs [@media(max-height:520px)]:text-[11px]">
            <span className="font-display font-bold text-slate-100">
              {HEROES[localFighter.heroId].name}
            </span>
            <span className="font-mono text-amber-300 font-bold">
              {t(language, 'guard')}:{' '}
              {localFighter.guardDir === 'top'
                ? t(language, 'guardTop')
                : localFighter.guardDir === 'left'
                ? t(language, 'guardLeft')
                : t(language, 'guardRight')}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] [@media(max-height:520px)]:text-[10px] font-mono tabular-nums text-slate-300">
              <span>{t(language, 'hp')}</span>
              <span>
                {Math.round(localFighter.hp)} / {localFighter.maxHp}
              </span>
            </div>
            <div className="w-full h-2 [@media(max-height:520px)]:h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${(localFighter.hp / localFighter.maxHp) * 100}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] [@media(max-height:520px)]:text-[10px] font-mono tabular-nums text-slate-300 pt-0.5 sm:pt-1">
              <span>{t(language, 'stamina')}</span>
              <span className={localFighter.oosExhausted ? 'text-red-400 font-bold' : ''}>
                {localFighter.oosExhausted
                  ? t(language, 'oosWarning')
                  : `${Math.round(localFighter.stamina)} / ${localFighter.maxStamina}`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full ${
                  localFighter.oosExhausted ? 'bg-red-500' : 'bg-slate-200'
                }`}
                style={{ width: `${(localFighter.stamina / localFighter.maxStamina) * 100}%` }}
              />
            </div>
          </div>

          {/* Focused Opponent Indicator */}
          <div className="flex items-center justify-between text-[10px] font-mono border-t border-slate-800 pt-1 text-slate-300">
            <span className="flex items-center gap-1 text-amber-300 truncate">
              <Crosshair className="w-3 h-3 shrink-0" />
              {lockedFighter
                ? `${lockedFighter.name} (${Math.round(lockedFighter.hp)} HP)`
                : showTouch
                ? language === 'pl'
                  ? 'Fokus: dotknij'
                  : 'Focus: tap'
                : gamepadConnected
                ? language === 'pl'
                  ? 'LB: fokus · klik RS: cel'
                  : 'LB: focus · RS click: target'
                : language === 'pl'
                ? 'Alt: fokus · Tab: cel'
                : 'Alt: focus · Tab: target'}
            </span>
            <span className="text-slate-400 shrink-0 ml-2">
              {gamepadConnected
                ? 'XBOX PAD'
                : showTouch
                ? 'TOUCH'
                : controlScheme === 'mouse'
                ? 'Mouse / LMB'
                : 'IJL / KO'}
            </span>
          </div>

          {localFighter.counterReadyTimerMs > 0 && (
            <div className="text-center py-1 bg-amber-500/20 border border-amber-500 rounded text-[11px] font-bold text-amber-300">
              {t(language, 'counterReady')}
            </div>
          )}

          {!localFighter.alive && localFighter.respawnTimerMs < 60000 && (
            <div className="text-center py-1 bg-red-500/20 border border-red-500/50 rounded text-[11px] font-mono tabular-nums text-red-200">
              {t(language, 'respawnIn')} {Math.ceil(localFighter.respawnTimerMs / 1000)}s
            </div>
          )}
        </div>
      )}

      {/* Dedicated Multi-Touch Mobile Controls Overlay */}
      {showTouch && snapshot?.phase !== 'ended' && (
        <MobileTouchControls
          language={language}
          activeGuard={localFighter?.guardDir ?? touchGuardDir}
          counterReady={Boolean(localFighter && localFighter.counterReadyTimerMs > 0)}
          handlers={touchHandlers}
        />
      )}

      {/* Match Summary Modal */}
      {snapshot?.phase === 'ended' && snapshot.summary && (
        <div className="fixed inset-0 z-30 bg-[#0E1116]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-[#181D26] border border-slate-700 rounded-lg p-6 lg:p-8 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="font-display text-3xl font-extrabold text-amber-400">
                {snapshot.summary.winnerTeam === 'draw'
                  ? t(language, 'draw')
                  : snapshot.summary.winnerTeam === localFighter?.team
                  ? t(language, 'victory')
                  : t(language, 'defeat')}
              </h2>
              <p className="text-sm text-slate-300">
                {language === 'pl' ? snapshot.summary.reasonPl : snapshot.summary.reasonEn}
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0E1116] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">{t(language, 'statPlayer')}</th>
                    <th className="py-2.5 px-3 text-right">{t(language, 'statKills')}</th>
                    <th className="py-2.5 px-3 text-right">{t(language, 'statDeaths')}</th>
                    <th className="py-2.5 px-3 text-right">{t(language, 'statParries')}</th>
                    <th className="py-2.5 px-3 text-right">{t(language, 'statCounters')}</th>
                    <th className="py-2.5 px-3 text-right">{t(language, 'statCaptures')}</th>
                    <th className="py-2.5 px-3 text-right">{t(language, 'statDamage')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {snapshot.fighters.map((f) => (
                    <tr
                      key={f.id}
                      className={f.id === localPlayerId ? 'bg-amber-500/10' : ''}
                    >
                      <td className="py-2 px-3 font-medium flex items-center gap-2">
                        {f.team === 'iron' ? (
                          <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        ) : (
                          <Swords className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="text-slate-100">
                          {f.name} ({HEROES[f.heroId].name})
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{f.kills}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{f.deaths}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-300">{f.parries}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-300">{f.counters}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{f.captures}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{f.damageDealt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isRematchVoteMode && (
              <div
                data-testid="rematch-vote-status"
                className="text-center text-xs font-mono text-slate-300 tabular-nums"
              >
                {t(language, 'rematchVoteStatus')}:{' '}
                <span className="text-amber-300 font-bold">
                  {rematchVotes.length}/{rematchEligibleCount}
                </span>{' '}
                {t(language, 'rematchPlayersReady')}
              </div>
            )}

            <div className="flex items-center justify-center gap-4">
              {(isRematchVoteMode || isHost) && (
                <button
                  type="button"
                  data-testid="play-again-btn"
                  onClick={handleRematch}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded font-bold text-sm cursor-pointer whitespace-nowrap transition-colors ${
                    isRematchVoteMode && hasVotedRematch
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-[#0E1116]'
                      : 'bg-amber-500 hover:bg-amber-400 text-[#0E1116]'
                  }`}
                >
                  {isRematchVoteMode && hasVotedRematch ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span>
                    {isRematchVoteMode
                      ? hasVotedRematch
                        ? `${t(language, 'rematchVoted')} (${rematchVotes.length}/${rematchEligibleCount})`
                        : `${t(language, 'playAgain')} (${rematchVotes.length}/${rematchEligibleCount})`
                      : t(language, 'playAgain')}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReturnLobby}
                className="flex items-center gap-2 px-6 py-2.5 rounded bg-[#262F3E] hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 cursor-pointer whitespace-nowrap"
              >
                <span>{t(language, 'returnLobby')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

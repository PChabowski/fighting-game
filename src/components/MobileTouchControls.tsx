import React, { useRef, useState } from 'react';
import { Crosshair, Shield, Swords, Target, Zap } from 'lucide-react';
import { GuardDirection, Language } from '../game/types';
import { t } from '../i18n/translations';

export interface MobileTouchHandlers {
  onMoveX: (moveX: number) => void;
  onUpHeld: (held: boolean) => void;
  onDownHeld: (held: boolean) => void;
  onJump: () => void;
  onDash: () => void;
  onGuard: (dir: GuardDirection) => void;
  onLight: () => void;
  onHeavy: () => void;
  onParry: () => void;
  onCounter: () => void;
  onFeint: () => void;
  onToggleFocus: () => void;
  onCycleTarget: () => void;
}

interface MobileTouchControlsProps {
  language: Language;
  activeGuard: GuardDirection;
  counterReady: boolean;
  handlers: MobileTouchHandlers;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  language,
  activeGuard,
  counterReady,
  handlers,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeMovePointer = useRef<number | null>(null);
  const activeGuardPointer = useRef<number | null>(null);
  const wasUpRef = useRef<boolean>(false);

  const updateMoveFromPointer = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const maxR = Math.max(24, rect.width * 0.36);
    const dist = Math.hypot(dx, dy);
    const scale = dist > maxR ? maxR / dist : 1;
    setKnobOffset({ x: dx * scale, y: dy * scale });

    if (dx < -14) handlers.onMoveX(-1);
    else if (dx > 14) handlers.onMoveX(1);
    else handlers.onMoveX(0);

    if (dy < -22) {
      handlers.onUpHeld(true);
      if (!wasUpRef.current) {
        wasUpRef.current = true;
        handlers.onJump();
      }
    } else if (dy > -14) {
      wasUpRef.current = false;
      handlers.onUpHeld(false);
    }

    handlers.onDownHeld(dy > 24);
  };

  const resetMoveStick = () => {
    activeMovePointer.current = null;
    wasUpRef.current = false;
    setKnobOffset({ x: 0, y: 0 });
    handlers.onMoveX(0);
    handlers.onUpHeld(false);
    handlers.onDownHeld(false);
  };

  const resolveGuardTouch = (el: HTMLDivElement, clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.45;
    const dx = clientX - cx;
    const dy = clientY - cy;
    if (dy < -8 && Math.abs(dy) >= Math.abs(dx) * 0.72) {
      handlers.onGuard('top');
    } else {
      handlers.onGuard(dx < 0 ? 'left' : 'right');
    }
  };

  return (
    <div
      data-testid="mobile-touch-controls"
      className="fixed inset-x-0 bottom-2.5 sm:bottom-4 [@media(max-height:520px)]:bottom-1.5 z-20 px-2.5 sm:px-6 [@media(max-height:520px)]:px-3 flex items-end justify-between pointer-events-none select-none touch-none"
    >
      {/* Left Thumb Cluster: Sliding D-Stick (Up = Jump / Climb) + Dodge */}
      <div className="pointer-events-auto flex items-end gap-1.5 sm:gap-2.5 touch-none">
        <div
          ref={padRef}
          data-testid="touch-move-stick"
          role="slider"
          aria-label={t(language, 'ctrlMove')}
          aria-valuenow={knobOffset.x > 10 ? 1 : knobOffset.x < -10 ? -1 : 0}
          tabIndex={-1}
          onPointerDown={(e) => {
            e.preventDefault();
            activeMovePointer.current = e.pointerId;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            updateMoveFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (activeMovePointer.current !== e.pointerId) return;
            updateMoveFromPointer(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (activeMovePointer.current === e.pointerId) resetMoveStick();
          }}
          onPointerCancel={(e) => {
            if (activeMovePointer.current === e.pointerId) resetMoveStick();
          }}
          className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[#0E1116]/75 border-2 border-slate-600/80 flex items-center justify-center touch-none shadow-lg"
        >
          <span className="absolute top-1.5 sm:top-2 text-[10px] sm:text-xs font-bold text-amber-300/85">▲</span>
          <span className="absolute left-2 sm:left-2.5 text-[10px] sm:text-xs font-bold text-slate-400">◀</span>
          <span className="absolute right-2 sm:right-2.5 text-[10px] sm:text-xs font-bold text-slate-400">▶</span>
          <span className="absolute bottom-1.5 sm:bottom-2 text-[9px] sm:text-[10px] font-bold text-slate-500">▼</span>
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500/85 border-2 border-amber-200 shadow-md pointer-events-none transition-transform duration-75"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            handlers.onDash();
          }}
          aria-label={t(language, 'touchDodge')}
          className="w-11 h-11 sm:w-13 sm:h-12 rounded-lg bg-[#181D26]/90 active:bg-sky-500 active:text-[#0E1116] border border-sky-500/60 text-sky-200 font-bold text-[9px] sm:text-[10px] flex flex-col items-center justify-center touch-none shadow-md"
        >
          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{t(language, 'touchDodge')}</span>
        </button>
      </div>

      {/* Right Thumb Cluster: Interactive 3-Way Guard Triangle + Combat Arc */}
      <div className="pointer-events-auto flex flex-col sm:flex-row items-end gap-1.5 sm:gap-3 touch-none">
        {/* Combat Actions */}
        <div className="order-2 sm:order-1 flex flex-col items-end gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handlers.onToggleFocus();
              }}
              aria-label={t(language, 'touchFocus')}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[#181D26]/90 active:bg-amber-500 active:text-[#0E1116] border border-amber-500/60 text-amber-300 text-[10px] sm:text-[11px] font-bold flex items-center gap-1 touch-none shadow-md"
            >
              <Crosshair className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{t(language, 'touchFocus')}</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handlers.onCycleTarget();
              }}
              aria-label={t(language, 'touchTarget')}
              title={t(language, 'touchTarget')}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[#181D26]/90 active:bg-sky-500 active:text-[#0E1116] border border-sky-500/60 text-sky-300 text-[10px] sm:text-[11px] font-bold flex items-center gap-1 touch-none shadow-md"
            >
              <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{t(language, 'touchTarget')}</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handlers.onFeint();
              }}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[#181D26]/90 active:bg-slate-600 border border-slate-600 text-slate-200 text-[10px] sm:text-[11px] font-bold touch-none shadow-md"
            >
              {t(language, 'touchFeint')}
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handlers.onParry();
              }}
              className="w-13 h-10 sm:w-14 sm:h-12 rounded-lg bg-sky-700/85 active:bg-sky-500 border border-sky-400 text-white text-[9px] sm:text-[10px] font-bold flex flex-col items-center justify-center touch-none shadow-md"
            >
              <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{t(language, 'touchParry')}</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handlers.onCounter();
              }}
              className={`w-15 h-10 sm:w-16 sm:h-12 rounded-lg border text-[9px] sm:text-[10px] font-bold flex flex-col items-center justify-center touch-none shadow-md ${
                counterReady
                  ? 'bg-amber-400 border-amber-200 text-[#0E1116] animate-pulse'
                  : 'bg-[#181D26]/90 active:bg-amber-500 border-amber-500/50 text-amber-300'
              }`}
            >
              <Swords className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{t(language, 'touchCounter')}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handlers.onLight();
              }}
              className="w-15 h-11 sm:w-16 sm:h-13 rounded-xl bg-slate-700/90 active:bg-slate-500 border border-slate-400 text-white text-[11px] sm:text-xs font-bold touch-none shadow-md"
            >
              {t(language, 'touchLight')}
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                handlers.onHeavy();
              }}
              className="w-15 h-11 sm:w-16 sm:h-13 rounded-xl bg-orange-600/90 active:bg-orange-400 border border-orange-300 text-white text-[11px] sm:text-xs font-bold touch-none shadow-md"
            >
              {t(language, 'touchHeavy')}
            </button>
          </div>
        </div>

        {/* Interactive Swipeable 3-Way Guard Triangle Pad */}
        <div
          aria-label={t(language, 'guard')}
          onPointerDown={(e) => {
            e.preventDefault();
            activeGuardPointer.current = e.pointerId;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            resolveGuardTouch(e.currentTarget, e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (activeGuardPointer.current !== e.pointerId) return;
            resolveGuardTouch(e.currentTarget, e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (activeGuardPointer.current === e.pointerId) activeGuardPointer.current = null;
          }}
          onPointerCancel={(e) => {
            if (activeGuardPointer.current === e.pointerId) activeGuardPointer.current = null;
          }}
          className="order-1 sm:order-2 relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#0E1116]/80 border border-slate-700 flex items-center justify-center touch-none shadow-lg"
        >
          <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24 pointer-events-none">
            <polygon
              points="16,20 84,20 50,82"
              fill="rgba(24, 29, 38, 0.7)"
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <line
              x1="16"
              y1="20"
              x2="84"
              y2="20"
              stroke={activeGuard === 'top' ? '#FACC15' : 'rgba(148,163,184,0.4)'}
              strokeWidth={activeGuard === 'top' ? '8' : '4'}
              strokeLinecap="round"
            />
            <line
              x1="16"
              y1="20"
              x2="50"
              y2="82"
              stroke={activeGuard === 'left' ? '#38BDF8' : 'rgba(148,163,184,0.4)'}
              strokeWidth={activeGuard === 'left' ? '8' : '4'}
              strokeLinecap="round"
            />
            <line
              x1="84"
              y1="20"
              x2="50"
              y2="82"
              stroke={activeGuard === 'right' ? '#F87171' : 'rgba(148,163,184,0.4)'}
              strokeWidth={activeGuard === 'right' ? '8' : '4'}
              strokeLinecap="round"
            />
            <text x="50" y="13" fill="#FDE68A" fontSize="9" fontWeight="bold" textAnchor="middle">
              ▲
            </text>
            <text x="16" y="66" fill="#93C5FD" fontSize="9" fontWeight="bold" textAnchor="middle">
              ◀
            </text>
            <text x="84" y="66" fill="#FCA5A5" fontSize="9" fontWeight="bold" textAnchor="middle">
              ▶
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};

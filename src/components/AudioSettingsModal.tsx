import React from 'react';
import { Gamepad2, Keyboard, Mouse, Settings, Smartphone, Volume2, VolumeX, X } from 'lucide-react';
import { t } from '../i18n/translations';
import { useAppStore } from '../store/useAppStore';
import { TouchControlsMode } from '../game/types';

export const AudioSettingsModal: React.FC = () => {
  const {
    language,
    audioMixer,
    audioModalOpen,
    setAudioModalOpen,
    updateAudioMixer,
    toggleMute,
    controlScheme,
    setControlScheme,
    touchControlsMode,
    setTouchControlsMode,
    gamepadConnected,
    gamepadName,
  } = useAppStore();

  if (!audioModalOpen) return null;

  const sliders: Array<{
    key: 'master' | 'music' | 'sfx' | 'ambient';
    label: string;
    value: number;
  }> = [
    { key: 'master', label: t(language, 'volMaster'), value: audioMixer.master },
    { key: 'music', label: t(language, 'volMusic'), value: audioMixer.music },
    { key: 'sfx', label: t(language, 'volSfx'), value: audioMixer.sfx },
    { key: 'ambient', label: t(language, 'volAmbient'), value: audioMixer.ambient },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0E1116]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setAudioModalOpen(false)}
    >
      <div
        className="w-full max-w-md bg-[#181D26] border border-slate-700 rounded-lg p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold text-slate-100">
              {t(language, 'audioModalTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setAudioModalOpen(false)}
            aria-label={t(language, 'closeModal')}
            className="p-1.5 rounded bg-[#0E1116] hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Volume Sliders */}
        <div className="space-y-4">
          {sliders.map((s) => (
            <div key={s.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-medium">{s.label}</span>
                <span className="font-mono text-amber-300 tabular-nums">
                  {audioMixer.muted ? '0%' : `${Math.round(s.value * 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(s.value * 100)}
                onChange={(e) =>
                  updateAudioMixer({
                    [s.key]: Number(e.target.value) / 100,
                    muted: false,
                  })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          ))}
        </div>

        {/* Guard & Attack Control Scheme Selector */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="text-xs font-semibold text-slate-300">
            {t(language, 'controlSchemeLabel')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setControlScheme('mouse')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded border text-xs font-semibold cursor-pointer transition-colors ${
                controlScheme === 'mouse'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                  : 'bg-[#0E1116] border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Mouse className="w-3.5 h-3.5" />
              <span>{t(language, 'schemeMouse')}</span>
            </button>
            <button
              type="button"
              onClick={() => setControlScheme('keyboard')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded border text-xs font-semibold cursor-pointer transition-colors ${
                controlScheme === 'keyboard'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                  : 'bg-[#0E1116] border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>{t(language, 'schemeKeyboard')}</span>
            </button>
          </div>

          {/* Mobile Touch Overlay Mode */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              <span>{t(language, 'touchControlsLabel')}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['auto', 'on', 'off'] as TouchControlsMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTouchControlsMode(mode)}
                  className={`px-2.5 py-2 rounded border text-xs font-semibold cursor-pointer transition-colors ${
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

          {/* Xbox Controller Plug & Play Status */}
          <div className="bg-[#0E1116] border border-slate-800 rounded p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Gamepad2
                className={`w-4 h-4 shrink-0 ${
                  gamepadConnected ? 'text-emerald-400' : 'text-slate-500'
                }`}
              />
              <div className="min-w-0">
                <div className="font-semibold text-slate-200 truncate">
                  {t(language, 'xboxTitle')}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {gamepadConnected ? gamepadName : t(language, 'xboxDisconnected')}
                </div>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                gamepadConnected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {gamepadConnected ? t(language, 'xboxConnected') : 'OFF'}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-3">
          <button
            type="button"
            onClick={toggleMute}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#0E1116] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            {audioMixer.muted ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>{t(language, 'unmuteAll')}</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-red-400" />
                <span>{t(language, 'muteAll')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAudioModalOpen(false)}
            className="px-5 py-2 rounded bg-amber-500 hover:bg-amber-400 text-[#0E1116] font-bold text-xs cursor-pointer"
          >
            {t(language, 'closeModal')}
          </button>
        </div>
      </div>
    </div>
  );
};

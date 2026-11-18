import React, { useEffect } from 'react';
import { spriteCache } from '../game/SpriteCache';
import { soundEngine } from '../game/audio/soundEngine';
import { useAppStore } from '../store/useAppStore';
import { t } from '../i18n/translations';

export const PreloaderOverlay: React.FC = () => {
  const language = useAppStore((s) => s.language);
  const progress = useAppStore((s) => s.preloadProgress);
  const setProgress = useAppStore((s) => s.setPreloadProgress);
  const setScreen = useAppStore((s) => s.setScreen);

  useEffect(() => {
    let active = true;
    soundEngine.init();
    spriteCache.preloadAll((pct) => {
      if (active) setProgress(pct);
    }).then(() => {
      if (!active) return;
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        const store = useAppStore.getState();
        store.autoFillBots({
          iron: store.localTeam === 'iron' ? 1 : 0,
          crimson: store.localTeam === 'crimson' ? 1 : 0,
        });
        setScreen('PLAYING');
        return;
      }
      setTimeout(() => {
        if (active) setScreen('MENU');
      }, 220);
    });
    return () => {
      active = false;
    };
  }, [setProgress, setScreen]);

  return (
    <div className="fixed inset-0 bg-[#0E1116] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#181D26] border border-slate-700/40 rounded-lg p-8 text-center">
        <h1 className="font-display text-3xl font-bold tracking-wide text-slate-100 mb-2">
          {t(language, 'brand')}
        </h1>
        <p className="text-sm text-slate-400 mb-6">{t(language, 'preloadTitle')}</p>

        <div className="w-full h-2.5 bg-[#0E1116] rounded overflow-hidden border border-slate-700/50 mb-3">
          <div
            className="h-full bg-amber-500 transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
          <span>{t(language, 'preloadSub')}</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import useGameStore from '../store/useGameStore';
import { AI_DIFFICULTY_ORDER, getAIDifficultyLabel } from '../engine/utils/aiProfiles';

function VolumeSlider({ label, value, onChange }) {
  return (
    <label className="settings-slider-row">
      <span>{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        onChange={onChange}
      />
      <strong>{value}%</strong>
    </label>
  );
}

export default function SettingsMenu({ onBack }) {
  const audioSettings = useGameStore((state) => state.audioSettings);
  const setAudioSettings = useGameStore((state) => state.setAudioSettings);
  const aiDifficulty = useGameStore((state) => state.aiDifficulty);
  const setAiDifficulty = useGameStore((state) => state.setAiDifficulty);

  return (
    <div className="settings-menu">
      <div>SETTINGS</div>

      <label className="settings-slider-row settings-select-row">
        <span>AI Difficulty (Arcade)</span>
        <select
          value={aiDifficulty}
          onChange={(event) => setAiDifficulty(event.target.value)}
          className="settings-select"
          aria-label="AI Difficulty"
        >
          {AI_DIFFICULTY_ORDER.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {getAIDifficultyLabel(difficulty)}
            </option>
          ))}
        </select>
      </label>

      <VolumeSlider
        label="Master Volume"
        value={audioSettings.masterVolume}
        onChange={(event) => setAudioSettings({ masterVolume: Number(event.target.value) })}
      />

      <VolumeSlider
        label="Menu Music Volume"
        value={audioSettings.menuMusicVolume}
        onChange={(event) => setAudioSettings({ menuMusicVolume: Number(event.target.value) })}
      />

      <VolumeSlider
        label="Battle Music Volume"
        value={audioSettings.musicVolume}
        onChange={(event) => setAudioSettings({ musicVolume: Number(event.target.value) })}
      />

      <VolumeSlider
        label="Sound Effects"
        value={audioSettings.sfxVolume}
        onChange={(event) => setAudioSettings({ sfxVolume: Number(event.target.value) })}
      />

      <button className="button menu-button" onClick={onBack}>
        BACK
      </button>
    </div>
  );
}

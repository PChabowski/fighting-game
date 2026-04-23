import React from 'react';
import useGameStore from '../store/useGameStore';

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

  return (
    <div className="settings-menu">
      <div>SETTINGS</div>

      <VolumeSlider
        label="Master Volume"
        value={audioSettings.masterVolume}
        onChange={(event) => setAudioSettings({ masterVolume: Number(event.target.value) })}
      />

      <VolumeSlider
        label="Music Volume"
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

export class AudioManager {
    constructor() {
        this.currentTrack = null;
        this.currentTrackName = null;
        this.currentCategory = null;
        this.masterVolume = 1;
        this.musicVolume = 0.1;
        this.sfxVolume = 0.3;
        
        this.tracks = {
            'menu_1': new Audio('assets/music/menu_1.ogg'),
            'menu_2': new Audio('assets/music/menu_2.ogg'),
            'battle_1': new Audio('assets/music/battle_1.ogg'),
            'battle_2': new Audio('assets/music/battle_2.ogg')
        };

        this.categories = {
            'menu': ['menu_1', 'menu_2'],
            'battle': ['battle_1', 'battle_2']
        };

        // Initialize track settings
        for (const [name, audio] of Object.entries(this.tracks)) {
            audio.loop = true;
            audio.volume = 0.10;
        }

        // Initialize sound effects
        this.sfx = {
            attack: []
        };
        for (let i = 1; i <= 8; i++) {
            this.sfx.attack.push(new Audio(`assets/sound-effect/swoshes/swosh-${i}.flac`));
        }

        this.applyVolumeSettings();
    }

    normalizeVolumeInput(value, fallback = 1) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        const normalized = numeric > 1 ? numeric / 100 : numeric;
        return Math.max(0, Math.min(1, normalized));
    }

    applyVolumeSettings() {
        const trackVolume = this.masterVolume * this.musicVolume;
        for (const audio of Object.values(this.tracks)) {
            audio.volume = trackVolume;
        }

        if (this.currentTrack) {
            this.currentTrack.volume = trackVolume;
        }
    }

    setMasterVolume(value) {
        this.masterVolume = this.normalizeVolumeInput(value, this.masterVolume);
        this.applyVolumeSettings();
    }

    setMusicVolume(value) {
        this.musicVolume = this.normalizeVolumeInput(value, this.musicVolume);
        this.applyVolumeSettings();
    }

    setSfxVolume(value) {
        this.sfxVolume = this.normalizeVolumeInput(value, this.sfxVolume);
    }

    setVolumes({ masterVolume, musicVolume, sfxVolume } = {}) {
        if (masterVolume !== undefined) {
            this.masterVolume = this.normalizeVolumeInput(masterVolume, this.masterVolume);
        }
        if (musicVolume !== undefined) {
            this.musicVolume = this.normalizeVolumeInput(musicVolume, this.musicVolume);
        }
        if (sfxVolume !== undefined) {
            this.sfxVolume = this.normalizeVolumeInput(sfxVolume, this.sfxVolume);
        }
        this.applyVolumeSettings();
    }

    playSoundEffect(type) {
        if (!this.sfx[type] || this.sfx[type].length === 0) return;

        const sounds = this.sfx[type];
        const randomIndex = Math.floor(Math.random() * sounds.length);
        const soundToPlay = sounds[randomIndex].cloneNode(); // Clone to allow overlapping sounds
        soundToPlay.volume = this.masterVolume * this.sfxVolume;
        
        soundToPlay.play().catch(e => {
            // Ignore autoplay errors for SFX, as they usually happen before user interaction
        });
    }

    playCategory(category) {
        // If we are already playing a track from this category, we don't switch 
        // to avoid restarting the track constantly while navigating menus.
        if (this.currentCategory === category && this.currentTrack) {
            // Ensure it's playing in case it was blocked
            this.currentTrack.play().catch(() => {});
            return;
        }

        this.currentCategory = category;
        const availableTracks = this.categories[category];
        const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
        
        this.play(randomTrack);
    }

    play(trackName, options = {}) {
        if (!this.tracks[trackName]) {
            console.warn(`Audio track '${trackName}' not found.`);
            return;
        }

        const trackToPlay = this.tracks[trackName];
        const seekTime = Number.isFinite(options.seekTime) ? Math.max(0, options.seekTime) : null;
        const wasSameTrack = this.currentTrack === trackToPlay;

        // If something is already playing, stop it
        if (this.currentTrack && this.currentTrack !== trackToPlay) {
            this.currentTrack.pause();
            this.currentTrack.currentTime = 0;
        }

        this.currentTrack = trackToPlay;
        this.currentTrackName = trackName;
        this.currentTrack.volume = this.masterVolume * this.musicVolume;

        if (seekTime !== null) {
            try {
                const drift = Math.abs(this.currentTrack.currentTime - seekTime);
                if (!wasSameTrack || drift > 0.2) {
                    this.currentTrack.currentTime = seekTime;
                }
            } catch (error) {
                // Ignore seek errors when metadata is not yet ready.
            }
        }

        // Autoplay policy handling:
        const playPromise = trackToPlay.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn(`Autoplay prevented for track '${trackName}'. Awaiting user interaction.`);
                
                const startAudioOnInteraction = () => {
                    if (this.currentTrack) {
                        this.currentTrack.play().catch(e => console.error("Still blocked:", e));
                    }
                    window.removeEventListener('click', startAudioOnInteraction);
                    window.removeEventListener('keydown', startAudioOnInteraction);
                    window.removeEventListener('touchstart', startAudioOnInteraction);
                };
                
                window.addEventListener('click', startAudioOnInteraction);
                window.addEventListener('keydown', startAudioOnInteraction);
                window.addEventListener('touchstart', startAudioOnInteraction);
            });
        }
    }

    getCurrentTrackState() {
        return {
            trackName: this.currentTrackName,
            currentTime: this.currentTrack ? this.currentTrack.currentTime : 0,
            currentCategory: this.currentCategory,
        };
    }

    isTrackInCategory(category, trackName) {
        const list = this.categories[category] || [];
        return list.includes(trackName);
    }

    stop() {
        if (this.currentTrack) {
            this.currentTrack.pause();
            this.currentTrack.currentTime = 0;
            this.currentTrack = null;
            this.currentTrackName = null;
            this.currentCategory = null;
        }
    }
}

export const globalAudioManager = new AudioManager();
window.audioManager = globalAudioManager;

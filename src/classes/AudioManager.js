export class AudioManager {
    constructor() {
        this.currentTrack = null;
        this.tracks = {
            'stage_1': new Audio('assets/music/stage_1.ogg'),
            'boss_fight': new Audio('assets/music/boss_fight.ogg')
        };

        // Initialize track settings
        for (const [name, audio] of Object.entries(this.tracks)) {
            audio.loop = true;
            audio.volume = 0.5; // default volume
        }
    }

    play(trackName) {
        if (!this.tracks[trackName]) {
            console.warn(`Audio track '${trackName}' not found.`);
            return;
        }

        const trackToPlay = this.tracks[trackName];

        // If something is already playing, stop it
        if (this.currentTrack && this.currentTrack !== trackToPlay) {
            this.currentTrack.pause();
            this.currentTrack.currentTime = 0;
        }

        // Set current track BEFORE playing to ensure the interaction handler plays the most recent one
        this.currentTrack = trackToPlay;

        // Autoplay policy handling:
        // Play returns a promise that may be rejected if user hasn't interacted
        const playPromise = trackToPlay.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn(`Autoplay prevented for track '${trackName}'. Awaiting user interaction.`, error);
                
                // Add a one-time global event listener to start audio on the first interaction
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

    stop() {
        if (this.currentTrack) {
            this.currentTrack.pause();
            this.currentTrack.currentTime = 0;
            this.currentTrack = null;
        }
    }
}

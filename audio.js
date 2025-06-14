export class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = new Map();
        this.volume = 0.7;
        this.isInitialized = false;
        this.soundBank = {
            click: { frequency: 800, duration: 0.1, type: 'square' },
            shoot: { frequency: 200, duration: 0.3, type: 'sawtooth' },
            hit: { frequency: 150, duration: 0.2, type: 'square' },
            explosion: { frequency: 80, duration: 0.8, type: 'sawtooth' },
            powerup: { frequency: 400, duration: 0.5, type: 'sine' },
            victory: { frequency: 600, duration: 1.0, type: 'sine' },
            defeat: { frequency: 200, duration: 1.5, type: 'sawtooth' },
            'battle-start': { frequency: 300, duration: 0.8, type: 'square' },
            save: { frequency: 500, duration: 0.3, type: 'sine' }
        };
    }

    async init() {
        try {
            // Create audio context on first user interaction
            this.isInitialized = true;
            console.log('Audio manager initialized');
        } catch (error) {
            console.error('Failed to initialize audio:', error);
        }
    }

    async createAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        }
        return this.audioContext;
    }

    async playSound(soundName, options = {}) {
        if (!this.isInitialized) return;

        try {
            const context = await this.createAudioContext();
            const soundConfig = this.soundBank[soundName];
            
            if (!soundConfig) {
                console.warn(`Sound '${soundName}' not found`);
                return;
            }

            const { frequency, duration, type } = soundConfig;
            const { pitch = 1, volume = 1 } = options;

            // Create oscillator
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(context.destination);

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency * pitch, context.currentTime);

            // Create envelope
            const now = context.currentTime;
            const attackTime = 0.01;
            const decayTime = duration * 0.3;
            const sustainLevel = 0.3;
            const releaseTime = duration * 0.7;

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(this.volume * volume, now + attackTime);
            gainNode.gain.linearRampToValueAtTime(this.volume * volume * sustainLevel, now + attackTime + decayTime);
            gainNode.gain.linearRampToValueAtTime(0, now + duration);

            oscillator.start(now);
            oscillator.stop(now + duration);

            // Haptic feedback for certain sounds
            if (['shoot', 'hit', 'explosion'].includes(soundName) && navigator.vibrate) {
                const vibrationPattern = this.getVibrationPattern(soundName);
                navigator.vibrate(vibrationPattern);
            }

        } catch (error) {
            console.error('Failed to play sound:', error);
        }
    }

    getVibrationPattern(soundName) {
        const patterns = {
            shoot: [20],
            hit: [50],
            explosion: [100, 50, 100],
            click: [10]
        };
        return patterns[soundName] || [10];
    }

    playMusic(trackName) {
        // For now, we'll create ambient background tones
        if (!this.isInitialized) return;

        try {
            // Create a simple ambient background
            this.createAmbientBackground();
        } catch (error) {
            console.error('Failed to play music:', error);
        }
    }

    async createAmbientBackground() {
        const context = await this.createAudioContext();
        
        // Create multiple oscillators for a rich ambient sound
        const frequencies = [220, 165, 110]; // A3, E3, A2
        const oscillators = [];
        const gainNodes = [];

        frequencies.forEach((freq, index) => {
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            const filterNode = context.createBiquadFilter();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, context.currentTime);
            
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(800, context.currentTime);
            filterNode.Q.setValueAtTime(1, context.currentTime);

            oscillator.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(context.destination);

            // Very low volume for ambient
            gainNode.gain.setValueAtTime(this.volume * 0.1, context.currentTime);

            // Add slight modulation
            const lfo = context.createOscillator();
            const lfoGain = context.createGain();
            lfo.frequency.setValueAtTime(0.5 + index * 0.2, context.currentTime);
            lfoGain.gain.setValueAtTime(5, context.currentTime);
            lfo.connect(lfoGain);
            lfoGain.connect(oscillator.frequency);

            oscillator.start();
            lfo.start();

            oscillators.push(oscillator);
            gainNodes.push(gainNode);
        });

        // Store references for cleanup
        this.ambientOscillators = oscillators;
        this.ambientGainNodes = gainNodes;
    }

    stopAmbientBackground() {
        if (this.ambientOscillators) {
            this.ambientOscillators.forEach(osc => {
                try {
                    osc.stop();
                } catch (e) {
                    // Oscillator might already be stopped
                }
            });
            this.ambientOscillators = null;
            this.ambientGainNodes = null;
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        
        // Update ambient background volume
        if (this.ambientGainNodes) {
            this.ambientGainNodes.forEach(gainNode => {
                gainNode.gain.setValueAtTime(this.volume * 0.1, this.audioContext.currentTime);
            });
        }
    }

    // Haptic feedback methods
    vibrate(pattern) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }

    vibrateShort() {
        this.vibrate(50);
    }

    vibrateLong() {
        this.vibrate(200);
    }

    vibratePattern(pattern) {
        this.vibrate(pattern);
    }

    // Spatial audio for game events
    playSpatialSound(soundName, x, y, listenerX, listenerY, options = {}) {
        const distance = Math.sqrt(Math.pow(x - listenerX, 2) + Math.pow(y - listenerY, 2));
        const maxDistance = 1000;
        const volume = Math.max(0, 1 - (distance / maxDistance));
        
        // Simple panning calculation
        const pan = Math.max(-1, Math.min(1, (x - listenerX) / 500));
        
        this.playSound(soundName, {
            ...options,
            volume: volume,
            pan: pan
        });
    }

    cleanup() {
        this.stopAmbientBackground();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}


export class AudioSystem {
    constructor(game) {
        this.game = game;
        
        // Audio context and nodes
        this.audioContext = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        
        // Audio buffers and sources
        this.audioBuffers = new Map();
        this.activeSources = [];
        
        // Audio state
        this.isMuted = false;
        this.musicVolume = 0.3;
        this.sfxVolume = 0.7;
        this.currentMusic = null;
        
        // Spatial audio
        this.listenerPosition = { x: 0, y: 0 };
        
        // Audio file definitions
        this.audioFiles = {
            music: {
                background: '/audio/background-music.mp3',
                victory: '/audio/victory.mp3',
                defeat: '/audio/defeat.mp3'
            },
            sfx: {
                attack: '/audio/attack.wav',
                probe: '/audio/probe-launch.wav',
                colonize: '/audio/colonize.wav',
                victory: '/audio/territory-captured.wav',
                defeat: '/audio/territory-lost.wav',
                notification: '/audio/notification.wav',
                discovery: '/audio/discovery.wav',
                explosion: '/audio/explosion.wav',
                transfer: '/audio/ship-transfer.wav'
            }
        };
        
        this.initializeAudio();
    }

    // Initialize Web Audio API
    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create gain nodes for volume control
            this.masterGain = this.audioContext.createGain();
            this.musicGain = this.audioContext.createGain();
            this.sfxGain = this.audioContext.createGain();
            
            // Connect audio graph
            this.musicGain.connect(this.masterGain);
            this.sfxGain.connect(this.masterGain);
            this.masterGain.connect(this.audioContext.destination);
            
            // Set initial volumes
            this.musicGain.gain.value = this.musicVolume;
            this.sfxGain.gain.value = this.sfxVolume;
            this.masterGain.gain.value = this.isMuted ? 0 : 1;
            
            // Load essential audio files
            await this.loadEssentialAudio();
            
            console.log('Audio system initialized successfully');
        } catch (error) {
            console.warn('Audio system initialization failed:', error);
            // Gracefully degrade without audio
        }
    }

    // Load essential audio files
    async loadEssentialAudio() {
        const essentialFiles = [
            'sfx.attack',
            'sfx.probe', 
            'sfx.colonize',
            'sfx.notification'
        ];
        
        const loadPromises = essentialFiles.map(async (fileKey) => {
            try {
                await this.loadAudioFile(fileKey);
            } catch (error) {
                console.warn(`Failed to load audio file ${fileKey}:`, error);
            }
        });
        
        await Promise.allSettled(loadPromises);
    }

    // Load audio file and decode
    async loadAudioFile(fileKey) {
        const [category, name] = fileKey.split('.');
        const url = this.audioFiles[category]?.[name];
        
        if (!url || this.audioBuffers.has(fileKey)) {
            return; // Already loaded or invalid key
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.audioBuffers.set(fileKey, audioBuffer);
            console.log(`Audio loaded: ${fileKey}`);
        } catch (error) {
            console.warn(`Failed to load audio ${fileKey}:`, error);
            // Create silent buffer as fallback
            this.audioBuffers.set(fileKey, this.createSilentBuffer(0.1));
        }
    }

    // Create silent audio buffer for fallback
    createSilentBuffer(duration) {
        const sampleRate = this.audioContext.sampleRate;
        const bufferLength = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferLength, sampleRate);
        return buffer;
    }

    // Play sound effect with spatial positioning
    playSFX(soundKey, position = null, volume = 1.0, pitch = 1.0) {
        if (!this.audioContext || this.isMuted) return null;
        
        const buffer = this.audioBuffers.get(`sfx.${soundKey}`);
        if (!buffer) {
            // Try to load on demand
            this.loadAudioFile(`sfx.${soundKey}`);
            return null;
        }
        
        try {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            let pannerNode = null;
            
            source.buffer = buffer;
            source.playbackRate.value = pitch;
            
            // Apply spatial audio if position provided
            if (position && this.game.camera) {
                pannerNode = this.audioContext.createPanner();
                pannerNode.panningModel = 'HRTF';
                pannerNode.distanceModel = 'exponential';
                pannerNode.maxDistance = 2000;
                pannerNode.rolloffFactor = 1;
                
                // Convert world position to audio space
                const screenPos = this.game.camera.worldToScreen(position.x, position.y);
                const normalizedX = (screenPos.x / this.game.canvas.width) * 2 - 1; // -1 to 1
                const normalizedY = (screenPos.y / this.game.canvas.height) * 2 - 1; // -1 to 1
                
                pannerNode.setPosition(normalizedX, normalizedY, 0);
                
                source.connect(pannerNode);
                pannerNode.connect(gainNode);
            } else {
                source.connect(gainNode);
            }
            
            gainNode.connect(this.sfxGain);
            gainNode.gain.value = volume;
            
            // Track active sources for cleanup
            this.activeSources.push(source);
            
            source.onended = () => {
                const index = this.activeSources.indexOf(source);
                if (index > -1) {
                    this.activeSources.splice(index, 1);
                }
            };
            
            source.start();
            return source;
        } catch (error) {
            console.warn(`Failed to play SFX ${soundKey}:`, error);
            return null;
        }
    }

    // Play background music with looping
    async playMusic(musicKey, fadeInDuration = 2.0) {
        if (!this.audioContext || this.isMuted) return;
        
        // Stop current music
        this.stopMusic();
        
        // Load music if needed
        await this.loadAudioFile(`music.${musicKey}`);
        
        const buffer = this.audioBuffers.get(`music.${musicKey}`);
        if (!buffer) return;
        
        try {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = buffer;
            source.loop = true;
            
            // Fade in effect
            gainNode.gain.value = 0;
            gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + fadeInDuration);
            
            source.connect(gainNode);
            gainNode.connect(this.musicGain);
            
            source.start();
            this.currentMusic = { source, gainNode };
            
            console.log(`Music started: ${musicKey}`);
        } catch (error) {
            console.warn(`Failed to play music ${musicKey}:`, error);
        }
    }

    // Stop current music with fade out
    stopMusic(fadeOutDuration = 1.0) {
        if (!this.currentMusic) return;
        
        try {
            const { source, gainNode } = this.currentMusic;
            
            // Fade out
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + fadeOutDuration);
            
            // Stop after fade out
            setTimeout(() => {
                if (source) {
                    source.stop();
                }
            }, fadeOutDuration * 1000);
            
            this.currentMusic = null;
        } catch (error) {
            console.warn('Failed to stop music:', error);
        }
    }

    // Game event audio handlers
    onTerritoryAttack(fromPos, toPos, isSuccess) {
        if (isSuccess) {
            this.playSFX('victory', toPos, 0.8);
        } else {
            this.playSFX('defeat', toPos, 0.6);
        }
        this.playSFX('attack', fromPos, 0.5);
    }

    onProbeColonization(position, success) {
        if (success) {
            this.playSFX('colonize', position, 0.7);
            this.playSFX('discovery', position, 0.5, 1.2); // Higher pitch
        } else {
            this.playSFX('explosion', position, 0.8);
        }
    }

    onShipTransfer(fromPos, toPos) {
        this.playSFX('transfer', fromPos, 0.4, 0.9);
    }

    onProduceLaunch(position) {
        this.playSFX('probe', position, 0.6, 1.1);
    }

    onNotification() {
        this.playSFX('notification', null, 0.5);
    }

    onGameVictory() {
        this.stopMusic(0.5);
        setTimeout(() => {
            this.playMusic('victory', 1.0);
        }, 500);
    }

    onGameDefeat() {
        this.stopMusic(0.5);
        setTimeout(() => {
            this.playMusic('defeat', 1.0);
        }, 500);
    }

    // Volume and mute controls
    setMuted(muted) {
        this.isMuted = muted;
        if (this.masterGain) {
            this.masterGain.gain.value = muted ? 0 : 1;
        }
    }

    toggleMute() {
        this.setMuted(!this.isMuted);
        return this.isMuted;
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.musicGain) {
            this.musicGain.gain.value = this.musicVolume;
        }
    }

    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        if (this.sfxGain) {
            this.sfxGain.gain.value = this.sfxVolume;
        }
    }

    // Update listener position for spatial audio
    updateListenerPosition(cameraX, cameraY) {
        if (!this.audioContext || !this.audioContext.listener) return;
        
        this.listenerPosition.x = cameraX;
        this.listenerPosition.y = cameraY;
        
        // Update audio listener orientation
        try {
            this.audioContext.listener.setPosition(0, 0, 0);
            this.audioContext.listener.setOrientation(0, 0, -1, 0, 1, 0);
        } catch (error) {
            // Fallback for older browsers
            if (this.audioContext.listener.positionX) {
                this.audioContext.listener.positionX.value = 0;
                this.audioContext.listener.positionY.value = 0;
                this.audioContext.listener.positionZ.value = 0;
            }
        }
    }

    // Cleanup and resource management
    stopAllSounds() {
        // Stop all active sound effects
        this.activeSources.forEach(source => {
            try {
                source.stop();
            } catch (error) {
                // Source may already be stopped
            }
        });
        this.activeSources = [];
        
        // Stop music
        this.stopMusic(0.1);
    }

    // Resume audio context (required for user interaction)
    async resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('Audio context resumed');
            } catch (error) {
                console.warn('Failed to resume audio context:', error);
            }
        }
    }

    // Get audio system stats
    getStats() {
        return {
            audioContextState: this.audioContext?.state || 'none',
            buffersLoaded: this.audioBuffers.size,
            activeSources: this.activeSources.length,
            isMuted: this.isMuted,
            musicVolume: this.musicVolume,
            sfxVolume: this.sfxVolume,
            currentMusic: this.currentMusic ? 'playing' : 'none'
        };
    }

    // Cleanup
    destroy() {
        this.stopAllSounds();
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.audioBuffers.clear();
        this.activeSources = [];
        this.currentMusic = null;
    }
}
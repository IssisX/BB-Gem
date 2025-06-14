import { GameEngine } from './game.js';
import { AudioManager } from './audio.js';
import { StorageManager } from './storage.js';
import { BotBuilder } from './bot-builder.js';

class App {
    constructor() {
        this.currentScreen = 'loading-screen';
        this.gameEngine = null;
        this.botBuilder = null;
        this.audioManager = new AudioManager();
        this.storageManager = new StorageManager();
        this.settings = {
            quality: 'medium',
            framerate: 60,
            hapticFeedback: true,
            sensitivity: 1.0,
            volume: 0.7
        };
        
        this.init();
    }

    async init() {
        try {
            // Initialize storage
            await this.storageManager.init();
            
            // Load saved settings
            const savedSettings = await this.storageManager.getSettings();
            if (savedSettings) {
                this.settings = { ...this.settings, ...savedSettings };
            }
            
            // Initialize audio
            await this.audioManager.init();
            this.audioManager.setVolume(this.settings.volume);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Go directly to the main menu
            this.showScreen('main-menu');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showScreen('main-menu');
        }
    }

    setupEventListeners() {
        // Menu button handlers
        document.addEventListener('click', this.handleClick.bind(this));
        
        // Settings handlers
        this.setupSettingsHandlers();
        
        // Prevent context menu on long press
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 100);
        });
        
        // Handle visibility changes for battery optimization
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseGame();
            }
        });
    }

    setupSettingsHandlers() {
        const qualitySelect = document.getElementById('quality-setting');
        const framerateSelect = document.getElementById('framerate-setting');
        const hapticCheckbox = document.getElementById('haptic-setting');
        const sensitivitySlider = document.getElementById('sensitivity-setting');
        const volumeSlider = document.getElementById('volume-setting');

        if (qualitySelect) {
            qualitySelect.value = this.settings.quality;
            qualitySelect.addEventListener('change', (e) => {
                this.settings.quality = e.target.value;
                this.saveSettings();
            });
        }

        if (framerateSelect) {
            framerateSelect.value = this.settings.framerate;
            framerateSelect.addEventListener('change', (e) => {
                this.settings.framerate = parseInt(e.target.value);
                this.saveSettings();
            });
        }

        if (hapticCheckbox) {
            hapticCheckbox.checked = this.settings.hapticFeedback;
            hapticCheckbox.addEventListener('change', (e) => {
                this.settings.hapticFeedback = e.target.checked;
                this.saveSettings();
            });
        }

        if (sensitivitySlider) {
            sensitivitySlider.value = this.settings.sensitivity;
            sensitivitySlider.addEventListener('input', (e) => {
                this.settings.sensitivity = parseFloat(e.target.value);
                this.saveSettings();
            });
        }

        if (volumeSlider) {
            volumeSlider.value = this.settings.volume;
            volumeSlider.addEventListener('input', (e) => {
                this.settings.volume = parseFloat(e.target.value);
                this.audioManager.setVolume(this.settings.volume);
                this.saveSettings();
            });
        }
    }

    async saveSettings() {
        await this.storageManager.saveSettings(this.settings);
    }

    handleClick(event) {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        this.audioManager.playSound('click');

        // Haptic feedback for button presses
        if (this.settings.hapticFeedback && navigator.vibrate) {
            navigator.vibrate(10);
        }

        switch (action) {
            case 'quick-battle':
                this.startQuickBattle();
                break;
            case 'bot-builder':
                this.showScreen('bot-builder');
                break;
            case 'settings':
                this.showScreen('settings');
                break;
            case 'back':
                this.showScreen('main-menu');
                break;
            case 'save-bot':
                this.saveBotDesign();
                break;
            case 'play-again':
                this.startQuickBattle();
                break;
            case 'main-menu':
                this.showScreen('main-menu');
                break;
        }
    }

    showScreen(screenId) {
        // Hide current screen
        const currentScreen = document.getElementById(this.currentScreen);
        if (currentScreen) {
            currentScreen.classList.remove('active');
        }
        
        // Show new screen
        const newScreen = document.getElementById(screenId);
        if (newScreen) {
            newScreen.classList.add('active');
            this.currentScreen = screenId;
        }
        
        // Handle screen-specific logic
        if (screenId === 'game-arena') {
            this.initializeGame();
        } else if (screenId === 'bot-builder') {
            this.initializeBotBuilder();
        }
    }

    async startQuickBattle() {
        this.showScreen('game-arena');
        this.audioManager.playSound('battle-start');
    }

    async initializeGame() {
        if (this.gameEngine) {
            this.gameEngine.destroy();
        }
        
        const canvas = document.getElementById('game-canvas');
        this.gameEngine = new GameEngine(canvas, {
            quality: this.settings.quality,
            framerate: this.settings.framerate,
            hapticFeedback: this.settings.hapticFeedback,
            sensitivity: this.settings.sensitivity,
            audioManager: this.audioManager,
            storageManager: this.storageManager
        });
        
        await this.gameEngine.init();
        this.gameEngine.start();
        
        // Setup game event listeners
        this.gameEngine.on('gameOver', (result) => {
            this.handleGameOver(result);
        });
        
        this.gameEngine.on('pause', () => {
            this.pauseGame();
        });
    }

    initializeBotBuilder() {
        if (this.botBuilder) {
            this.botBuilder.setupCanvas();
            this.botBuilder.render();
            return;
        }
        const canvas = document.getElementById('builder-canvas');
        if (canvas) {
            this.botBuilder = new BotBuilder(canvas, this.settings);
        }
    }

    handleGameOver(result) {
        const gameOverScreen = document.getElementById('game-over');
        const resultText = document.getElementById('result-text');
        const finalTime = document.getElementById('final-time');
        const damageDealt = document.getElementById('damage-dealt');
        const accuracy = document.getElementById('accuracy');
        
        // Update result display
        resultText.textContent = result.victory ? 'VICTORY!' : 'DEFEAT!';
        resultText.className = `result-text ${result.victory ? 'victory' : 'defeat'}`;
        
        // Update stats
        finalTime.textContent = result.time;
        damageDealt.textContent = result.damage;
        accuracy.textContent = result.accuracy + '%';
        
        // Save game stats
        this.storageManager.saveGameResult(result);
        
        // Show game over screen
        this.showScreen('game-over');
        
        // Play appropriate sound
        this.audioManager.playSound(result.victory ? 'victory' : 'defeat');
    }

    pauseGame() {
        if (this.gameEngine) {
            this.gameEngine.pause();
        }
    }

    resumeGame() {
        if (this.gameEngine) {
            this.gameEngine.resume();
        }
    }

    async saveBotDesign() {
        if (this.botBuilder) {
            const botDesign = this.botBuilder.getBotDesign();
            await this.storageManager.saveBotDesign(botDesign);
        }
        this.audioManager.playSound('save');
        
        // Show confirmation
        const saveBtn = document.querySelector('[data-action="save-bot"]');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            saveBtn.disabled = true;
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }, 1500);
        }
    }

    handleOrientationChange() {
        // Update canvas size and controls layout
        if (this.gameEngine) {
            this.gameEngine.handleResize();
        }
        
        // Update UI layouts
        document.body.classList.toggle('landscape', window.innerWidth > window.innerHeight);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Handle service worker for offline functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
import { GameEngine } from './game.js';
import { AudioManager } from './audio.js';
import { StorageManager } from './storage.js';
import { BotBuilder } from './bot-builder.js'; // Assuming BotBuilder is separate
import DataManager from './src/DataManager.js';
import { ControlsManager } from './controls.js';

class App {
    constructor() {
        this.currentScreen = 'loading-screen';
        this.gameEngine = null;
        this.botBuilder = null; // Assuming BotBuilder is separate and initialized as needed
        this.audioManager = new AudioManager();
        this.storageManager = new StorageManager();
        this.dataManager = new DataManager();
        // Pass the actual method bound to 'this' for the callback
        this.controlsManager = new ControlsManager(null, {}, this.updateControlSchemeVisuals.bind(this));

        this.settings = {
            quality: 'medium',
            framerate: 60,
            hapticFeedback: true,
            sensitivity: 1.0,
            volume: 0.7
            // Add any other default settings your app uses
        };
        this.isGamePaused = false;
        this.cameFromPauseMenu = false;

        this.tutorialSteps = [
            { title: "Movement", text: "Use the joystick (or WASD keys) to move your bot." },
            { title: "Firing", text: "Tap the Fire button (or Spacebar) to shoot." },
            { title: "Special Ability", text: "Use the Special button (or E key / Swipe Up) for a powerful move!" }
        ];
        this.currentTutorialStep = 0;
        this.isTutorialActive = false;

        this.init(); // Call init
    }

    async init() {
        document.getElementById('loading-screen').classList.add('active');
        this.currentScreen = 'loading-screen';

        try {
            await this.storageManager.init();
            const savedSettings = await this.storageManager.getSettings();
            if (savedSettings) {
                this.settings = { ...this.settings, ...savedSettings };
            }

            // Pass current settings to ControlsManager if it has an updateOptions method
            if (this.controlsManager && typeof this.controlsManager.updateOptions === 'function') {
                 this.controlsManager.updateOptions({
                     sensitivity: this.settings.sensitivity,
                     hapticFeedback: this.settings.hapticFeedback
                     // Pass other relevant settings if ControlsManager uses them
                 });
            }

            await this.dataManager.loadAllData(); // CRITICAL: Load all game data
            
            await this.audioManager.init();
            this.audioManager.setVolume(this.settings.volume);
            
            this.setupEventListeners(); // Setup global event listeners
            this.setupSettingsHandlers(); // Setup listeners for settings screen elements
            this.setupTutorialEventHandlers(); // Setup listeners for tutorial buttons

            this.updateControlSchemeVisuals(); // Initial UI update for controls

            const tutorialCompleted = await this.storageManager.getSetting('tutorialCompleted');
            if (!tutorialCompleted) {
                this.startTutorial();
            } else {
                this.showScreen('main-menu');
            }
            // Loading screen removal is handled by showScreen
        } catch (error) {
            console.error('Failed to initialize app:', error);
            alert('Critical error during app initialization. Please try refreshing.');
            document.getElementById('loading-screen').classList.remove('active');
            // Attempt to show a fallback or simple error message if main-menu itself is problematic
        }
    }

    setupEventListeners() {
        // Menu button handlers
        document.addEventListener('click', this.handleClick.bind(this));
        
        // Settings handlers (already called in init)
        // this.setupSettingsHandlers();
        
        // Prevent context menu on long press
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 100);
        });
        
        // Handle visibility changes for battery optimization
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.gameEngine && !this.gameEngine.isPaused && this.currentScreen === 'game-arena') {
                // Only pause if game is running and not already paused
                this.gameEngine.togglePause();
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
                this.saveSettingsAndUpdateGame();
            });
        }

        if (framerateSelect) {
            framerateSelect.value = this.settings.framerate;
            framerateSelect.addEventListener('change', (e) => {
                this.settings.framerate = parseInt(e.target.value);
                this.saveSettingsAndUpdateGame();
            });
        }

        if (hapticCheckbox) {
            hapticCheckbox.checked = this.settings.hapticFeedback;
            hapticCheckbox.addEventListener('change', (e) => {
                this.settings.hapticFeedback = e.target.checked;
                this.saveSettingsAndUpdateGame();
            });
        }

        if (sensitivitySlider) {
            sensitivitySlider.value = this.settings.sensitivity;
            sensitivitySlider.addEventListener('input', (e) => {
                this.settings.sensitivity = parseFloat(e.target.value);
                // No need to call saveSettingsAndUpdateGame() on every input, maybe on 'change'
            });
            sensitivitySlider.addEventListener('change', (e) => { // Save on release
                this.settings.sensitivity = parseFloat(e.target.value);
                this.saveSettingsAndUpdateGame();
            });
        }

        if (volumeSlider) {
            volumeSlider.value = this.settings.volume;
            volumeSlider.addEventListener('input', (e) => {
                this.settings.volume = parseFloat(e.target.value);
                this.audioManager.setVolume(this.settings.volume);
                // No need to call saveSettingsAndUpdateGame() on every input, maybe on 'change'
            });
            volumeSlider.addEventListener('change', (e) => { // Save on release
                 this.settings.volume = parseFloat(e.target.value);
                this.saveSettingsAndUpdateGame(); // Persist volume
            });
        }
    }

    async saveSettingsAndUpdateGame() {
        await this.storageManager.saveSettings(this.settings);
        // Update ControlsManager if settings affecting it changed
        if (this.controlsManager && typeof this.controlsManager.updateOptions === 'function') {
            this.controlsManager.updateOptions({
                sensitivity: this.settings.sensitivity,
                hapticFeedback: this.settings.hapticFeedback
            });
        }
        // Update GameEngine if settings affecting it changed (e.g., quality)
        if (this.gameEngine && typeof this.gameEngine.updateOptions === 'function') {
            this.gameEngine.updateOptions({
                quality: this.settings.quality,
                framerate: this.settings.framerate,
                hapticFeedback: this.settings.hapticFeedback,
                sensitivity: this.settings.sensitivity
            });
        }
    }


    async saveSettings() { // Kept for direct calls if needed, but prefer saveSettingsAndUpdateGame
        await this.storageManager.saveSettings(this.settings);
    }

    handleClick(event) {
        const target = event.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;

        if (action !== 'tutorial-next' && action !== 'tutorial-skip') {
             this.audioManager.playSound('ui_click');
        }
        if (this.settings.hapticFeedback && navigator.vibrate) navigator.vibrate(10);

        switch (action) {
            case 'quick-battle': this.startQuickBattle(); break;
            case 'bot-builder': this.showScreen('bot-builder'); break;
            case 'settings':
                this.cameFromPauseMenu = (this.currentScreen === 'game-arena' && this.gameEngine && this.gameEngine.isPaused);
                this.showScreen('settings');
                break;
            case 'back': // From Settings or Bot Builder
                if (this.currentScreen === 'settings' && this.cameFromPauseMenu) {
                    this.showScreen('game-arena');
                    const pauseMenu = document.getElementById('pause-menu');
                    if(this.gameEngine && this.gameEngine.isPaused && pauseMenu) {
                        pauseMenu.classList.add('active');
                        pauseMenu.style.display = 'flex';
                        pauseMenu.style.opacity = '1';
                        pauseMenu.style.visibility = 'visible';
                    }
                } else {
                    this.showScreen('main-menu');
                }
                this.cameFromPauseMenu = false;
                break;
            case 'save-bot': this.saveBotDesign(); break;
            case 'play-again': this.startQuickBattle(); break;
            case 'main-menu': this.showScreen('main-menu'); break; // From Game Over
            case 'resume-game':
                if(this.gameEngine) this.gameEngine.resume();
                break;
            case 'quit-to-main-menu':
                if(this.gameEngine) {
                     this.gameEngine.destroy();
                     this.gameEngine = null;
                }
                this.isGamePaused = false;
                this.showScreen('main-menu');
                break;
            case 'tutorial-next': this.handleTutorialNext(); break;
            case 'tutorial-skip': this.endTutorial(); break;
            default: console.warn(`Unhandled action: ${action}`);
        }
    }

    showScreen(screenId) {
        const oldScreenElement = document.getElementById(this.currentScreen);
        const newScreenElement = document.getElementById(screenId);

        if (oldScreenElement) {
            oldScreenElement.classList.remove('active');
            oldScreenElement.style.display = 'none';
        }

        if (newScreenElement) {
            newScreenElement.style.display = 'flex';
            newScreenElement.classList.add('active');
            this.currentScreen = screenId;
        } else {
            console.error(`Screen element not found for ID: ${screenId}`);
            return;
        }
        
        if (screenId !== 'loading-screen' && document.getElementById('loading-screen').classList.contains('active')) {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('loading-screen').classList.remove('active');
        }

        if (screenId === 'game-arena') {
            if (!this.gameEngine || (this.gameEngine && typeof this.gameEngine.isDestroyed === 'function' && this.gameEngine.isDestroyed())) {
                this.initializeGame();
            } else if (this.gameEngine && this.gameEngine.isPaused) {
                // GameEngine.resume() or togglePause() should handle pause menu visibility.
            }
        } else if (screenId === 'bot-builder') {
            this.initializeBotBuilder();
        } else if (screenId === 'main-menu') {
            if (this.gameEngine && typeof this.gameEngine.destroy === 'function' && (typeof this.gameEngine.isDestroyed !== 'function' || !this.gameEngine.isDestroyed())) {
                this.gameEngine.destroy();
                this.gameEngine = null;
            }
            this.isGamePaused = false;
            this.cameFromPauseMenu = false;
        }

        this.updateControlSchemeVisuals();
    }

    async startQuickBattle() {
        this.showScreen('game-arena'); // initializeGame will be called by showScreen
        // this.audioManager.playSound('battle-start'); // Sound might be better timed after game loads or countdown
    }

    async initializeGame() {
        if (this.gameEngine && typeof this.gameEngine.destroy === 'function' && (typeof this.gameEngine.isDestroyed !== 'function' || !this.gameEngine.isDestroyed())) {
            this.gameEngine.destroy();
            this.gameEngine = null;
        }
        
        const canvas = document.getElementById('game-canvas');
        if (!this.dataManager || !this.dataManager.mapsById || !this.dataManager.mapsById.size > 0) {
            console.error("DataManager not ready or no data loaded before starting game!");
            alert("Error: Game data failed to load. Please refresh.");
            this.showScreen('main-menu');
            return;
        }

        this.gameEngine = new GameEngine(
            canvas,
            {
                quality: this.settings.quality,
                framerate: this.settings.framerate,
                hapticFeedback: this.settings.hapticFeedback,
                sensitivity: this.settings.sensitivity,
                audioManager: this.audioManager,
                // onInputTypeChange: this.updateControlSchemeVisuals.bind(this) // Pass if GameEngine creates its own ControlsManager
            },
            this.dataManager,
            this.audioManager,
            this.controlsManager
        );
        
        try {
            // gameEngine.init() in the provided snippet calls loadLevel.
            // gameEngine.start() calls startMatchCountdown.
            // No need to await init() if it's not returning a promise that needs to be waited on here.
            // However, if gameEngine.init() itself is async (e.g. loads assets specific to the engine instance), then await it.
            // Assuming GameEngine.init() might be async due to level loading.
            await this.gameEngine.init();
            this.gameEngine.start();

            this.gameEngine.on('gameOver', (result) => this.handleGameOver(result));
            this.gameEngine.on('pause', (isPaused) => {
                this.isGamePaused = isPaused;
                // Pause menu visibility is handled by GameEngine.togglePause()
            });
            this.audioManager.playSound('battle-start'); // Play start sound after engine is ready
        } catch (error) {
            console.error("Error initializing GameEngine:", error);
            alert("Failed to start game. Returning to main menu.");
            this.showScreen('main-menu');
        }
    }

    initializeBotBuilder() {
        // Ensure BotBuilder is correctly initialized or re-initialized if needed
        if (!this.botBuilder) {
            const canvas = document.getElementById('builder-canvas');
            if (canvas && typeof BotBuilder === 'function') { // Check if BotBuilder is defined
                this.botBuilder = new BotBuilder(canvas, this.settings, this.dataManager, this.audioManager); // Pass DataManager
            } else {
                console.error("BotBuilder canvas not found or BotBuilder class not available.");
                return;
            }
        }
        // Potentially refresh or update BotBuilder if it has such methods
        if (this.botBuilder && typeof this.botBuilder.refresh === 'function') {
            this.botBuilder.refresh();
        } else if (this.botBuilder && typeof this.botBuilder.render === 'function') {
             this.botBuilder.setupCanvas(); // Ensure canvas is setup if returning to screen
            this.botBuilder.render();
        }
    }

    handleGameOver(result) {
        // Ensure game over screen elements exist
        const gameOverScreen = document.getElementById('game-over-screen'); // Corrected ID if necessary
        const resultText = document.getElementById('result-text');
        const finalTime = document.getElementById('final-time');
        const damageDealt = document.getElementById('damage-dealt');
        const accuracy = document.getElementById('accuracy');

        if (!gameOverScreen || !resultText || !finalTime || !damageDealt || !accuracy) {
            console.error("Game Over screen elements not found!");
            this.showScreen('main-menu'); // Fallback
            return;
        }
        
        resultText.textContent = result.victory ? 'VICTORY!' : 'DEFEAT!';
        resultText.className = `result-text ${result.victory ? 'victory' : 'defeat'}`;
        
        finalTime.textContent = result.time || 'N/A';
        damageDealt.textContent = result.damage !== undefined ? result.damage : 'N/A';
        accuracy.textContent = (result.accuracy !== undefined ? result.accuracy : 'N/A') + '%';
        
        this.storageManager.saveGameResult(result);
        this.showScreen('game-over-screen'); // Use correct ID
        this.audioManager.playSound(result.victory ? 'victory' : 'defeat');
    }

    // pauseGame and resumeGame are effectively handled by GameEngine.togglePause() or GameEngine.resume()
    // which are called from handleClick for 'resume-game' or by GameEngine itself.
    // App.isGamePaused state is updated via the 'pause' event from GameEngine.

    async saveBotDesign() {
        if (this.botBuilder && typeof this.botBuilder.getBotDesign === 'function') {
            const botDesign = this.botBuilder.getBotDesign();
            if (botDesign) {
                 await this.storageManager.saveBotDesign(botDesign); // Assuming this returns a promise
                 this.audioManager.playSound('save');

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
            } else {
                console.warn("No bot design to save or getBotDesign failed.");
                // Optionally provide UI feedback for failure
            }
        } else {
            console.error("BotBuilder not available or getBotDesign method missing.");
        }
    }

    handleOrientationChange() {
        if (this.gameEngine && typeof this.gameEngine.handleResize === 'function') {
            this.gameEngine.handleResize();
        }
        if (this.botBuilder && typeof this.botBuilder.handleResize === 'function') {
            this.botBuilder.handleResize();
        }
        this.updateControlSchemeVisuals(); // Re-check control display based on new orientation/size
        document.body.classList.toggle('landscape', window.innerWidth > window.innerHeight);
    }

    updateControlSchemeVisuals() {
        if (!this.controlsManager) return;

        const currentInputType = this.controlsManager.getActiveInputType();
        const instructionsElement = document.getElementById('kb-gp-instructions');
        const touchControlsElement = document.getElementById('touch-controls'); // Assuming this is the main container for touch UI

        if (currentInputType === 'touch') {
            document.body.classList.add('touch-active');
            document.body.classList.remove('keyboard-active', 'gamepad-active');
            if (instructionsElement) instructionsElement.style.display = 'none';
            if (touchControlsElement && this.currentScreen === 'game-arena') touchControlsElement.style.display = 'flex'; // Or 'block'
        } else if (currentInputType === 'gamepad') {
            document.body.classList.add('gamepad-active');
            document.body.classList.remove('touch-active', 'keyboard-active');
            if (instructionsElement) instructionsElement.style.display = 'block';
            if (touchControlsElement) touchControlsElement.style.display = 'none';
        } else { // keyboard or unknown
            document.body.classList.add('keyboard-active');
            document.body.classList.remove('touch-active', 'gamepad-active');
            if (instructionsElement) instructionsElement.style.display = 'block';
            if (touchControlsElement) touchControlsElement.style.display = 'none';
        }
    }

    // Tutorial Methods
    setupTutorialEventHandlers() {
        const nextBtn = document.getElementById('tutorial-next-btn');
        const skipBtn = document.getElementById('tutorial-skip-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => this.handleTutorialNext()); // Use bound method or arrow
        if (skipBtn) skipBtn.addEventListener('click', () => this.endTutorial());
    }

    startTutorial() {
        this.isTutorialActive = true;
        this.currentTutorialStep = 0;
        this.displayTutorialStep();
        this.showScreen('tutorial-screen');
        this.audioManager.playSound('ui_modal_open'); // Or a specific tutorial start sound
    }

    displayTutorialStep() {
        if (!this.isTutorialActive || this.currentTutorialStep >= this.tutorialSteps.length) {
            this.endTutorial();
            return;
        }
        const step = this.tutorialSteps[this.currentTutorialStep];
        const titleElement = document.getElementById('tutorial-title');
        const textElement = document.getElementById('tutorial-text');
        // const imageElement = document.getElementById('tutorial-image'); // If you have images

        if (titleElement) titleElement.textContent = step.title;
        if (textElement) textElement.textContent = step.text;
        // if (imageElement && step.image) imageElement.src = step.image;

        const nextBtn = document.getElementById('tutorial-next-btn');
        if (nextBtn) {
            if (this.currentTutorialStep === this.tutorialSteps.length - 1) {
                nextBtn.textContent = 'Finish';
            } else {
                nextBtn.textContent = 'Next';
            }
        }
    }

    handleTutorialNext() {
        this.audioManager.playSound('ui_click_subtle'); // A softer click for next
        this.currentTutorialStep++;
        if (this.currentTutorialStep >= this.tutorialSteps.length) {
            this.endTutorial();
        } else {
            this.displayTutorialStep();
        }
    }

    async endTutorial() {
        this.isTutorialActive = false;
        await this.storageManager.saveSetting('tutorialCompleted', true);
        this.showScreen('main-menu');
        this.audioManager.playSound('ui_modal_close');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Handle service worker for offline functionality (no changes from original)
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
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
        // Simplified init
        document.getElementById('loading-screen').classList.add('active');
        this.currentScreen = 'loading-screen';
        console.log('[APP_DEBUG] Simplified App.init() started.');

        try {
            await this.storageManager.init();
            console.log('[APP_DEBUG] StorageManager initialized.');
            const savedSettings = await this.storageManager.getSettings();
            if (savedSettings) {
                this.settings = { ...this.settings, ...savedSettings };
                console.log('[APP_DEBUG] Settings loaded from storage.');
            } else {
                console.log('[APP_DEBUG] No saved settings found, using defaults.');
            }
            
            await this.dataManager.loadAllData();
            console.log('[APP_DEBUG] DataManager.loadAllData() awaited.');

            await this.audioManager.init();
            this.audioManager.setVolume(this.settings.volume);
            console.log('[APP_DEBUG] AudioManager initialized and volume set.');
            
            this.setupEventListeners(); // This will now be the simplified version
            console.log('[APP_DEBUG] Simplified event listeners set up.');

            // Comment out non-essential UI updates for this debug session
            // this.setupSettingsHandlers();
            // this.setupTutorialEventHandlers();
            // this.updateControlSchemeVisuals();

            // Directly show main menu after loading
            const loadingScreen = document.getElementById('loading-screen');
            const mainMenuScreen = document.getElementById('main-menu');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
                loadingScreen.classList.remove('active');
            }
            if (mainMenuScreen) {
                mainMenuScreen.style.display = 'flex'; // Or 'block'
                mainMenuScreen.classList.add('active');
                this.currentScreen = 'main-menu';
                console.log('[APP_DEBUG] Main menu forced to display after init.');
            } else {
                console.error('[APP_DEBUG] Main menu screen not found in init!');
            }

        } catch (error) {
            console.error('[APP_DEBUG] CRITICAL ERROR during simplified App.init():', error);
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
                loadingScreen.classList.remove('active');
            }
            // Maybe display a static error message on the page if main-menu itself is the issue
            const errorDisplay = document.createElement('div');
            errorDisplay.textContent = 'Critical error during initialization. Check console.';
            errorDisplay.style.color = 'red';
            errorDisplay.style.padding = '20px';
            document.body.appendChild(errorDisplay);
        }
    }

    setupEventListeners() {
        // Simplified event listeners - ONLY for Quick Battle button
        console.log('[APP_DEBUG] Setting up TARGETED event listener for Quick Battle button.');
        // document.addEventListener('click', this.handleClick.bind(this)); // Commented out general click handler
        
        const quickBattleButton = document.querySelector('[data-action="quick-battle"]');
        if (quickBattleButton) {
            quickBattleButton.addEventListener('click', (event) => {
                console.log("[APP_DEBUG] Quick Battle button CLICKED!");
                event.stopPropagation(); // Prevent other listeners if any were accidentally left
                this.audioManager.playSound('ui_click');
                if (this.settings.hapticFeedback && navigator.vibrate) {
                    navigator.vibrate(10);
                }
                this.startQuickBattle();
            });
            console.log('[APP_DEBUG] Event listener for Quick Battle button ADDED.');
        } else {
            console.error('[APP_DEBUG] Quick Battle button [data-action="quick-battle"] NOT FOUND in setupEventListeners!');
        }

        // Comment out other listeners for this debug session
        // document.addEventListener('contextmenu', (e) => e.preventDefault());
        // window.addEventListener('orientationchange', () => {
        //     setTimeout(() => this.handleOrientationChange(), 100);
        // });
        // document.addEventListener('visibilitychange', () => {
        //     if (document.hidden && this.gameEngine && !this.gameEngine.isPaused && this.currentScreen === 'game-arena') {
        //         this.gameEngine.togglePause();
        //     }
        // });
    }

    // setupSettingsHandlers() { // COMMENTED OUT FOR DEBUGGING
    //     const qualitySelect = document.getElementById('quality-setting');
    //     const framerateSelect = document.getElementById('framerate-setting');
    //     const hapticCheckbox = document.getElementById('haptic-setting');
    //     const sensitivitySlider = document.getElementById('sensitivity-setting');
    //     const volumeSlider = document.getElementById('volume-setting');

    //     if (qualitySelect) {
    //         qualitySelect.value = this.settings.quality;
    //         qualitySelect.addEventListener('change', (e) => {
    //             this.settings.quality = e.target.value;
    //             this.saveSettingsAndUpdateGame();
    //         });
    //     }

    //     if (framerateSelect) {
    //         framerateSelect.value = this.settings.framerate;
    //         framerateSelect.addEventListener('change', (e) => {
    //             this.settings.framerate = parseInt(e.target.value);
    //             this.saveSettingsAndUpdateGame();
    //         });
    //     }

    //     if (hapticCheckbox) {
    //         hapticCheckbox.checked = this.settings.hapticFeedback;
    //         hapticCheckbox.addEventListener('change', (e) => {
    //             this.settings.hapticFeedback = e.target.checked;
    //             this.saveSettingsAndUpdateGame();
    //         });
    //     }

    //     if (sensitivitySlider) {
    //         sensitivitySlider.value = this.settings.sensitivity;
    //         sensitivitySlider.addEventListener('input', (e) => {
    //             this.settings.sensitivity = parseFloat(e.target.value);
    //             // No need to call saveSettingsAndUpdateGame() on every input, maybe on 'change'
    //         });
    //         sensitivitySlider.addEventListener('change', (e) => { // Save on release
    //             this.settings.sensitivity = parseFloat(e.target.value);
    //             this.saveSettingsAndUpdateGame();
    //         });
    //     }

    //     if (volumeSlider) {
    //         volumeSlider.value = this.settings.volume;
    //         volumeSlider.addEventListener('input', (e) => {
    //             this.settings.volume = parseFloat(e.target.value);
    //             this.audioManager.setVolume(this.settings.volume);
    //             // No need to call saveSettingsAndUpdateGame() on every input, maybe on 'change'
    //         });
    //         volumeSlider.addEventListener('change', (e) => { // Save on release
    //              this.settings.volume = parseFloat(e.target.value);
    //             this.saveSettingsAndUpdateGame(); // Persist volume
    //         });
    //     }
    // }

    // async saveSettingsAndUpdateGame() { // COMMENTED OUT FOR DEBUGGING
    //     await this.storageManager.saveSettings(this.settings);
    //     if (this.controlsManager && typeof this.controlsManager.updateOptions === 'function') {
    //         this.controlsManager.updateOptions({
    //             sensitivity: this.settings.sensitivity,
    //             hapticFeedback: this.settings.hapticFeedback
    //         });
    //     }
    //     if (this.gameEngine && typeof this.gameEngine.updateOptions === 'function') {
    //         this.gameEngine.updateOptions({
    //             quality: this.settings.quality,
    //             framerate: this.settings.framerate,
    //             hapticFeedback: this.settings.hapticFeedback,
    //             sensitivity: this.settings.sensitivity
    //         });
    //     }
    // }

    // async saveSettings() { // COMMENTED OUT FOR DEBUGGING
    //     await this.storageManager.saveSettings(this.settings);
    // }

    // handleClick(event) { // COMMENTED OUT FOR DEBUGGING - Replaced by targeted listener
    //     console.log('[APP] handleClick triggered');
    //     const target = event.target.closest('[data-action]');
    //     if (!target) {
    //         console.log('[APP] No data-action target found for click.');
    //         return;
    //     }
    //     const action = target.dataset.action;
    //     console.log(`[APP] Action: ${action}`);
    //     // ... rest of original handleClick
    // }

    showScreen(screenId) {
        // Drastically simplified showScreen for debugging
        console.log(`[APP_DEBUG] showScreen('${screenId}') called. Current: ${this.currentScreen}`);

        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => {
            s.style.display = 'none';
            s.classList.remove('active');
        });

        const newScreenElement = document.getElementById(screenId);

        if (newScreenElement) {
            newScreenElement.style.display = 'flex'; // Assuming 'flex'
            newScreenElement.classList.add('active');
            this.currentScreen = screenId;
            console.log(`[APP_DEBUG] Screen '${screenId}' activated.`);
        } else {
            console.error(`[APP_DEBUG] Screen element not found for ID: ${screenId}!`);
            return; // Important to stop if screen not found
        }
        
        if (screenId === 'game-arena') {
            console.log("[APP_DEBUG] 'game-arena' screen selected, calling initializeGame().");
            this.initializeGame();
        } else if (screenId === 'main-menu') {
            console.log("[APP_DEBUG] 'main-menu' screen selected. Destroying gameEngine if exists.");
            if (this.gameEngine && typeof this.gameEngine.destroy === 'function') {
                if (typeof this.gameEngine.isDestroyed !== 'function' || !this.gameEngine.isDestroyed()) {
                    this.gameEngine.destroy();
                }
                this.gameEngine = null;
                console.log("[APP_DEBUG] Game engine destroyed for main menu.");
            }
            this.isGamePaused = false;
            this.cameFromPauseMenu = false;
        }
        // No other screen logic for this hyper-focused debug

        const loadingScreen = document.getElementById('loading-screen');
        if (screenId !== 'loading-screen' && loadingScreen && loadingScreen.classList.contains('active')) {
            loadingScreen.style.display = 'none';
            loadingScreen.classList.remove('active');
            console.log("[APP_DEBUG] Loading screen explicitly hidden by showScreen.");
        }
        console.log(`[APP_DEBUG] Current screen is now: ${this.currentScreen}`);
    }

    async startQuickBattle() {
        console.log('[APP_DEBUG] startQuickBattle() called.');
        this.showScreen('game-arena');
        // this.audioManager.playSound('battle-start'); // Keep audio minimal for now
    }

    async initializeGame() {
        console.log('[APP_DEBUG] initializeGame() called.');
        if (this.gameEngine && typeof this.gameEngine.destroy === 'function' && (typeof this.gameEngine.isDestroyed !== 'function' || !this.gameEngine.isDestroyed())) {
            this.gameEngine.destroy();
            this.gameEngine = null;
        }
        
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('[APP_DEBUG] initializeGame: Canvas element not found!');
            alert("Error: Game canvas not found. Cannot start game.");
            this.showScreen('main-menu'); // Fallback
            return;
        }
        console.log('[APP_DEBUG] initializeGame: Canvas element found.');

        if (!this.dataManager || !this.dataManager.mapsById || !this.dataManager.mapsById.size === 0) {
            console.error("[APP_DEBUG] initializeGame: DataManager not ready or no map data loaded!");
            alert("Error: Game data (maps) failed to load. Please refresh and check console.");
            this.showScreen('main-menu'); // Fallback
            return;
        }
        console.log('[APP_DEBUG] initializeGame: DataManager seems ready with map data.');

        try {
            console.log('[APP_DEBUG] initializeGame: Instantiating GameEngine...');
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
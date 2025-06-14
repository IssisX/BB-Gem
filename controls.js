import nipplejs from 'nipplejs';

export class ControlsManager {
    constructor(gameEngine, settings, onInputTypeChangeCallback = null) { // Added callback
        this.gameEngine = gameEngine;
        this.settings = settings;
        this.onInputTypeChange = onInputTypeChangeCallback; // Store the callback
        this.joystick = null;
        this.targetingActive = false;
        this.lastTargetPosition = { x: 0, y: 0 };
        this.touchStartPositions = new Map();
        this.gestureStartDistance = 0;
        this.currentZoom = 1.0;
        this.minZoom = 0.5;
        this.maxZoom = 3.0;
        
        this.inputState = {
            movement: { x: 0, y: 0 },
            targeting: { x: 0, y: 0 },
            firing: false,
            special: false,
            shield: false,
            // Gesture states
            swipeUp: false,
            swipeDown: false,
            swipeLeft: false,
            swipeRight: false,
            doubleTap: false // Existing double tap can also update this
        };
        this.swipeThreshold = 50; // Minimum distance for a swipe
        this.swipeTimeThreshold = 300; // Maximum time in ms for a swipe
        this.touchStartTime = 0;
        this.touchStartPos = { x: 0, y: 0 };

        // Gamepad properties
        this.gamepad = null;
        this.gamepadPollInterval = null;
        this.gamepadButtonStates = {}; // To track button presses/releases
        this.gamepadAxisDeadZone = 0.2;
        this.gamepadSensitivity = 1.0;

        this.lastInputType = 'keyboard'; // Default or detect initial state
        if (typeof window !== 'undefined' && 'ontouchstart' in window) {
            this.lastInputType = 'touch';
        }
        
        this.init();
    }

    setActiveInputType(newType) {
        if (this.lastInputType !== newType) {
            this.lastInputType = newType;
            if (this.onInputTypeChange) {
                this.onInputTypeChange(newType);
            }
        }
    }

    getActiveInputType() {
        // This method is called by app.js to update UI visuals.
        // It prioritizes gamepad if any activity is detected on it.
        if (this.gamepad) {
            const gp = navigator.getGamepads()[this.gamepad.index];
            if (gp) {
                const isActiveGamepad = gp.buttons.some(b => b.pressed || b.touched) ||
                                      gp.axes.some(a => Math.abs(a) > this.gamepadAxisDeadZone);
                if (isActiveGamepad) {
                    this.setActiveInputType('gamepad'); // Use setter to potentially trigger callback
                    return 'gamepad';
                }
            }
        }
        return this.lastInputType;
    }

    // app.js would have something like:
    // updateControlSchemeVisuals() {
    //   const activeType = this.controlsManager.getActiveInputType();
    //   document.body.classList.remove('touch-controls-active', 'keyboard-controls-active', 'gamepad-controls-active');
    //   const instructionsDiv = document.getElementById('kb-gp-instructions');
    //   instructionsDiv.style.display = 'none';
    //   instructionsDiv.classList.remove('keyboard', 'gamepad');

    //   if (activeType === 'touch') {
    //     document.body.classList.add('touch-controls-active');
    //   } else if (activeType === 'keyboard') {
    //     document.body.classList.add('keyboard-controls-active');
    //     instructionsDiv.textContent = "Use WASD/Arrows to Move, Space to Fire, E for Special, Q for Shield.";
    //     instructionsDiv.classList.add('keyboard');
    //     instructionsDiv.style.display = 'block';
    //   } else if (activeType === 'gamepad') {
    //     document.body.classList.add('gamepad-controls-active');
    //     instructionsDiv.textContent = "Gamepad Connected: Use Left Stick to Move, Buttons to Fire/Use Abilities.";
    //     instructionsDiv.classList.add('gamepad');
    //     instructionsDiv.style.display = 'block';
    //   }
    // }
    // And this method would be called on init and potentially on an event from ControlsManager
    // if lastInputType changes significantly (e.g., from touch to keyboard).

    init() {
        this.setupVirtualJoystick();
        this.setupActionButtons();
        this.setupTargeting();
        this.setupGestureControls();
        this.setupKeyboardControls();
        this.setupGamepadControls(); // Initialize gamepad controls
    }

    setupVirtualJoystick() {
        const joystickElement = document.getElementById('movement-joystick');
        const joystickBase = joystickElement.querySelector('.joystick-base');
        
        this.joystick = nipplejs.create({
            zone: joystickBase,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: '#00ffff',
            size: 80,
            threshold: 0.1,
            restOpacity: 0.7,
            fadeTime: 100
        });

        this.joystick.on('move', (evt, data) => {
            this.setActiveInputType('touch');
            if (data.force < 0.1) {
                this.inputState.movement = { x: 0, y: 0 };
                return;
            }

            // Convert joystick input to movement vector
            const angle = data.angle.radian;
            const force = Math.min(data.force, 1) * this.settings.sensitivity;
            
            this.inputState.movement = {
                x: Math.cos(angle) * force,
                y: -Math.sin(angle) * force // Invert Y for screen coordinates
            };
        });

        this.joystick.on('end', () => {
            this.setActiveInputType('touch');
            this.inputState.movement = { x: 0, y: 0 };
        });
    }

    setupActionButtons() {
        const fireBtn = document.getElementById('fire-btn');
        const specialBtn = document.getElementById('special-btn');
        const shieldBtn = document.getElementById('shield-btn');

        const handleTouchStart = (e, buttonElement, action) => {
            e.preventDefault();
            this.setActiveInputType('touch');
            action();
            this.addButtonPressEffect(buttonElement);
        };

        const handleTouchEnd = (e, buttonElement, action) => {
            e.preventDefault();
            this.setActiveInputType('touch');
            if (action) action();
            this.removeButtonPressEffect(buttonElement);
        };

        // Fire button
        fireBtn.addEventListener('touchstart', (e) => handleTouchStart(e, fireBtn, () => {
            this.inputState.firing = true;
            if (this.gameEngine.audioManager) this.gameEngine.audioManager.playSound('shoot');
        }));
        fireBtn.addEventListener('touchend', (e) => handleTouchEnd(e, fireBtn, () => {
            this.inputState.firing = false;
        }));

        // Special ability button
        specialBtn.addEventListener('touchstart', (e) => handleTouchStart(e, specialBtn, () => {
            if (!this.inputState.special) { // Prevent re-triggering if already active from another source
                this.inputState.special = true;
                if (this.gameEngine.audioManager) this.gameEngine.audioManager.playSound('powerup');
                // Reset after a short delay, PlayerInputSystem will consume it
                setTimeout(() => {
                    this.inputState.special = false;
                    // Check if button is still held for visual effect, though this timeout is for action state
                    if (!e.target.classList.contains('active-persistent')) { // Example class for persistent active look
                         this.removeButtonPressEffect(specialBtn);
                    }
                }, 200);
            }
        }));
        // No specific touchend action for special if it's a one-shot

        // Shield button
        shieldBtn.addEventListener('touchstart', (e) => handleTouchStart(e, shieldBtn, () => {
            this.inputState.shield = !this.inputState.shield; // Toggle shield state
            if (this.inputState.shield) {
                this.addButtonPressEffect(shieldBtn, true); // Make effect persistent if shield is ON
                if (this.gameEngine.audioManager) this.gameEngine.audioManager.playSound('powerup');
            } else {
                this.removeButtonPressEffect(shieldBtn); // Remove persistent effect if shield is OFF
            }
        }));
    }

    setupTargeting() {
        const targetingArea = document.getElementById('targeting-area');
        const gameCanvas = document.getElementById('game-canvas');

        // Targeting area touch
        targetingArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.setActiveInputType('touch');
            this.targetingActive = true;
            this.addButtonPressEffect(targetingArea);
        });

        targetingArea.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.setActiveInputType('touch');
            this.targetingActive = false;
            this.removeButtonPressEffect(targetingArea);
        });

        const tapTargetHandler = (e) => {
            if (e.touches.length === 1) {
                 this.setActiveInputType('touch');
                const touch = e.touches[0];
                const rect = gameCanvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                const gameX = (x / rect.width) * gameCanvas.width; // These are canvas pixel coords
                const gameY = (y / rect.height) * gameCanvas.height;
                
                // Convert to world coordinates
                const cam = this.gameEngine.camera;
                const worldX = (gameX / window.devicePixelRatio - (rect.width / 2)) / cam.zoom + cam.currentX;
                const worldY = (gameY / window.devicePixelRatio - (rect.height / 2)) / cam.zoom + cam.currentY;

                this.inputState.targeting = { x: worldX, y: worldY };
                this.lastTargetPosition = { x: worldX, y: worldY };
                
                this.showTargetingFeedback(x, y);
            }
        };
        // gameCanvas.addEventListener('touchstart', tapTargetHandler); // This might be duplicative with gesture's touchstart

    }

    setupGestureControls() {
        const gameCanvas = document.getElementById('game-canvas');
        let lastTouchTime = 0;
        // gameCanvasSwipeStartX,Y,TouchStartTime are now this.touchStartPos.x, .y and this.touchStartTime
        // to unify swipe detection logic for canvas.

        gameCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.setActiveInputType('touch');
            
            if (e.touches.length === 2) { // Pinch
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                this.gestureStartDistance = this.getTouchDistance(touch1, touch2);
                this.touchStartTime = 0; // Invalidate swipe/tap start time if pinch starts
            } else if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.touchStartPos = { x: touch.clientX, y: touch.clientY };
                this.touchStartTime = Date.now();

                // Double-tap detection
                const currentTime = Date.now();
                if (currentTime - lastTouchTime < this.swipeTimeThreshold) {
                    this.handleDoubleTap(touch);
                    this.inputState.doubleTap = true;
                    this.touchStartTime = 0; // Prevent swipe detection after a double tap
                }
                lastTouchTime = currentTime;
            }
        });

        gameCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.setActiveInputType('touch');
            if (e.touches.length === 2) { // Pinch-zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = this.getTouchDistance(touch1, touch2);
                const zoomDelta = currentDistance / this.gestureStartDistance;
                this.handleZoom(zoomDelta);
                this.gestureStartDistance = currentDistance;
            }
        });
        
        gameCanvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.setActiveInputType('touch');
            if (e.changedTouches.length === 1 && this.touchStartTime > 0) {
                const touch = e.changedTouches[0];
                const swipeEndX = touch.clientX;
                const swipeEndY = touch.clientY;
                const swipeTime = Date.now() - this.touchStartTime;

                const deltaX = swipeEndX - this.touchStartPos.x;
                const deltaY = swipeEndY - this.touchStartPos.y;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                if (swipeTime < this.swipeTimeThreshold && distance > this.swipeThreshold) {
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        if (deltaX > 0) this.inputState.swipeRight = true;
                        else this.inputState.swipeLeft = true;
                    } else {
                        if (deltaY > 0) this.inputState.swipeDown = true;
                        else this.inputState.swipeUp = true;
                    }
                    this.resetGestureStatesAfterDelay();
                }
            }
            this.touchStartTime = 0;
        });

        // Document-level swipe for UI (remains unchanged but shown for context)
        // If game-canvas swipes should also trigger those general gameEngine events,
        // then call this.handleSwipe(deltaX, deltaY) here too.
        // For now, focusing on updating inputState for PlayerInputSystem.
        let docSwipeStartX = 0;
        let docSwipeStartY = 0;
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1 && !e.target.closest('#game-area-container')) { // Only outside game area
                docSwipeStartX = e.touches[0].clientX;
                docSwipeStartY = e.touches[0].clientY;
                this.touchStartTime = Date.now(); // For general swipe time
            }
        });
        document.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1 && !e.target.closest('#game-area-container')) {
                const swipeEndX = e.changedTouches[0].clientX;
                const swipeEndY = e.changedTouches[0].clientY;
                const swipeTime = Date.now() - this.touchStartTime;
                
                const deltaX = swipeEndX - docSwipeStartX;
                const deltaY = swipeEndY - docSwipeStartY;
                
                if (swipeTime < this.swipeTimeThreshold && (Math.abs(deltaX) > this.swipeThreshold || Math.abs(deltaY) > this.swipeThreshold)) {
                     this.handleSwipe(deltaX, deltaY); // This emits gameEngine events
                }
            }
        });
    }

    resetGestureStatesAfterDelay() {
        // Reset swipe flags after a short delay to allow systems to pick them up
        // Alternatively, systems consuming them can reset them.
        setTimeout(() => {
            this.inputState.swipeUp = false;
            this.inputState.swipeDown = false;
            this.inputState.swipeLeft = false;
            this.inputState.swipeRight = false;
            this.inputState.doubleTap = false; // Reset doubleTap too
        }, 50); // 50ms should be enough for one game tick
    }


    setupKeyboardControls() {
        this.activeKeys = new Set();
        this.keyPressProcessed = new Set();

        document.addEventListener('keydown', (e) => {
            this.setActiveInputType('keyboard');
            this.activeKeys.add(e.code);
            if (e.code === 'KeyQ' && !this.keyPressProcessed.has('KeyQ')) {
                this.inputState.shield = !this.inputState.shield;
                this.keyPressProcessed.add('KeyQ');
            }
            if (e.code === 'KeyE' && !this.keyPressProcessed.has('KeyE')) {
                this.inputState.special = true;
                this.keyPressProcessed.add('KeyE');
                setTimeout(() => { this.inputState.special = false; this.keyPressProcessed.delete('KeyE'); }, 200);
            }
            if (e.code === 'Space') e.preventDefault();
        });

        document.addEventListener('keyup', (e) => {
            this.setActiveInputType('keyboard');
            this.activeKeys.delete(e.code);
            this.keyPressProcessed.delete(e.code);
            if (e.code === 'Space') e.preventDefault();
        });

        document.getElementById('game-canvas').addEventListener('mousemove', (e) => {
            if (this.lastInputType === 'keyboard' || !('ontouchstart' in window)) {
                 this.setActiveInputType('keyboard'); // Mouse move implies keyboard/mouse usage
                const rect = e.target.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const gameX = (x / rect.width) * this.gameEngine.canvas.width / window.devicePixelRatio;
                const gameY = (y / rect.height) * this.gameEngine.canvas.height / window.devicePixelRatio;
                const cam = this.gameEngine.camera;
                const worldX = (gameX - (rect.width / 2)) / cam.zoom + cam.currentX;
                const worldY = (gameY - (rect.height / 2)) / cam.zoom + cam.currentY;
                this.inputState.targeting = { x: worldX, y: worldY };
                this.lastTargetPosition = { x: worldX, y: worldY };
            }
        });
        document.getElementById('game-canvas').addEventListener('mousedown', (e) => {
            if (this.lastInputType === 'keyboard' || !('ontouchstart' in window)) {
                this.setActiveInputType('keyboard');
                if (e.button === 0) {
                    this.inputState.firing = true;
                }
            }
        });
        document.getElementById('game-canvas').addEventListener('mouseup', (e) => {
            if (this.lastInputType === 'keyboard' || !('ontouchstart' in window)) {
                 this.setActiveInputType('keyboard');
                if (e.button === 0) {
                    this.inputState.firing = false;
                }
            }
        });
    }

    getTouchDistance(touch1, touch2) {
        return Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
    }

    handleZoom(zoomDelta) {
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom * zoomDelta));
        
        if (newZoom !== this.currentZoom) {
            this.currentZoom = newZoom;
            if (this.gameEngine && typeof this.gameEngine.setZoom === 'function') {
                 this.gameEngine.setZoom(this.currentZoom);
            }
            
            const zoomIndicator = document.getElementById('zoom-indicator');
            if (zoomIndicator) {
                zoomIndicator.textContent = `${this.currentZoom.toFixed(1)}x`;
            }
        }
    }

    handleDoubleTap(touch) {
        // This method is called from canvas touchstart for double tap
        // It sets this.inputState.doubleTap = true;
        // PlayerInputSystem should react to this flag.
        // Visual feedback:
        this.showDoubleTapFeedback(touch.clientX, touch.clientY);
        // The flag is reset in resetGestureStatesAfterDelay
    }

    handleSwipe(deltaX, deltaY) { // This is for document-level swipes (UI navigation)
        // const threshold = 50; // Now this.swipeThreshold
        
        if (Math.abs(deltaX) > this.swipeThreshold || Math.abs(deltaY) > this.swipeThreshold) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 0) this.gameEngine.emit('swipeRight');
                else this.gameEngine.emit('swipeLeft');
            } else {
                if (deltaY > 0) this.gameEngine.emit('swipeDown');
                else this.gameEngine.emit('swipeUp');
            }
        }
    }

    addButtonPressEffect(element, persistent = false) {
        element.style.transform = 'scale(0.95)';
        element.style.boxShadow = '0 0 30px var(--border-glow)';
        
        if (!persistent) {
            element.classList.add('active');
        }
    }

    removeButtonPressEffect(element) {
        element.style.transform = '';
        element.style.boxShadow = '';
        element.classList.remove('active');
    }

    showTargetingFeedback(x, y) {
        const feedback = document.createElement('div');
        feedback.className = 'targeting-feedback';
        feedback.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: 20px;
            height: 20px;
            border: 2px solid #00ffff;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 1000;
            animation: targeting-pulse 0.5s ease-out;
        `;
        
        if (!document.getElementById('targeting-feedback-styles')) {
            const style = document.createElement('style');
            style.id = 'targeting-feedback-styles';
            style.textContent = `
                @keyframes targeting-pulse {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentElement) feedback.parentElement.removeChild(feedback);
        }, 500);
    }

    showDoubleTapFeedback(x, y) {
        const feedback = document.createElement('div');
        feedback.className = 'doubletap-feedback';
        feedback.innerHTML = '⚡';
        feedback.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            font-size: 2rem;
            color: #ffff00;
            text-shadow: 0 0 10px #ffff00;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 1000;
            animation: doubletap-flash 0.8s ease-out;
        `;
        
        if (!document.getElementById('doubletap-feedback-styles')) {
            const style = document.createElement('style');
            style.id = 'doubletap-feedback-styles';
            style.textContent = `
                @keyframes doubletap-flash {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
                    50% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentElement) feedback.parentElement.removeChild(feedback);
        }, 800);
    }

    getInputState() {
        // Update movement from activeKeys (for keyboard)
        // This overwrites joystick movement if keys are pressed.
        // A more sophisticated approach might merge or prioritize.
        let moveX = this.inputState.movement.x; // Preserve joystick input if no keys pressed
        let moveY = this.inputState.movement.y;

        if (this.activeKeys.has('KeyW') || this.activeKeys.has('ArrowUp')) moveY = -1;
        else if (this.activeKeys.has('KeyS') || this.activeKeys.has('ArrowDown')) moveY = 1;
        else if (!this.joystick || this.joystick.get().force < 0.1) moveY = 0; // Stop if no joystick and no key

        if (this.activeKeys.has('KeyA') || this.activeKeys.has('ArrowLeft')) moveX = -1;
        else if (this.activeKeys.has('KeyD') || this.activeKeys.has('ArrowRight')) moveX = 1;
        else if (!this.joystick || this.joystick.get().force < 0.1) moveX = 0;

        const currentInputState = { ...this.inputState };
        currentInputState.movement = { x: moveX, y: moveY };

        // Update actions from activeKeys
        currentInputState.firing = this.inputState.firing || this.activeKeys.has('Space');
        // 'special' and 'shield' are handled by keydown/keyup for one-shot or toggle logic for keyboard.
        // Touch buttons also update this.inputState directly.

        // TODO: Gamepad input would also merge into currentInputState here.
        if (this.gamepad) {
            // Left stick for movement
            const axes = this.gamepad.axes;
            let stickX = axes[0];
            let stickY = axes[1];

            if (Math.abs(stickX) < this.gamepadAxisDeadZone) stickX = 0;
            if (Math.abs(stickY) < this.gamepadAxisDeadZone) stickY = 0;

            // If gamepad movement is active, it might override keyboard/joystick
            // Or, sum them, or prioritize. For now, let's allow override if significant.
            if (stickX !== 0 || stickY !== 0) {
                 currentInputState.movement.x = stickX * this.gamepadSensitivity;
                 currentInputState.movement.y = stickY * this.gamepadSensitivity; // Gamepad Y is often -1 up, 1 down
            }

            // Buttons
            this.gamepad.buttons.forEach((button, index) => {
                // Example mapping: Button 0 (A/X) for firing
                if (index === 0) currentInputState.firing = button.pressed || currentInputState.firing; // Hold to fire

                // Button 1 (B/Circle) for special (one-shot)
                if (index === 1 && button.pressed && !this.gamepadButtonStates[index]) {
                    currentInputState.special = true; // PlayerInputSystem should reset this
                    setTimeout(() => { currentInputState.special = false; }, 200);
                }
                // Button 2 (X/Square) for shield (toggle)
                if (index === 2 && button.pressed && !this.gamepadButtonStates[index]) {
                    currentInputState.shield = !currentInputState.shield;
                }
                this.gamepadButtonStates[index] = button.pressed; // Store current state for next frame
            });
        }


        return currentInputState;
    }

    setupGamepadControls() {
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad);
            this.gamepad = e.gamepad;
            this.lastInputType = 'gamepad';
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('Gamepad disconnected:', e.gamepad);
            if (this.gamepad && this.gamepad.index === e.gamepad.index) {
                this.gamepad = null;
                // Potentially revert to keyboard/touch if this was the active input
                if (this.lastInputType === 'gamepad') {
                    this.lastInputType = ('ontouchstart' in window) ? 'touch' : 'keyboard';
                }
            }
        });

        // Initial check for already connected gamepads
        if (typeof navigator.getGamepads === "function") {
            const gamepads = navigator.getGamepads();
            if (gamepads && gamepads[0]) { // Use the first connected gamepad
                 this.gamepad = gamepads[0];
                 this.lastInputType = 'gamepad';
                 console.log('Gamepad already connected:', this.gamepad);
            }
        }
    }

    getActiveInputType() {
        // Check for recent gamepad activity if a gamepad is connected
        if (this.gamepad) {
            const isActiveGamepad = this.gamepad.buttons.some(b => b.pressed) ||
                                  this.gamepad.axes.some(a => Math.abs(a) > this.gamepadAxisDeadZone * 0.5); // More sensitive check for active use

            if (isActiveGamepad) {
                 this.lastInputType = 'gamepad';
            }
            if (this.lastInputType === 'gamepad') return 'gamepad';
        }
        return this.lastInputType;
    }

    cleanup() {
        if (this.joystick) {
            this.joystick.destroy();
        }
        // Remove gamepad listeners if any were added directly to window for polling
        // (In this setup, connection listeners are on window, polling is in getInputState)
        // No specific interval to clear for gamepad polling as it's integrated.
    }
}


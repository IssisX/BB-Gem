import nipplejs from 'nipplejs';

export class ControlsManager {
    constructor(gameEngine, settings) {
        this.gameEngine = gameEngine;
        this.settings = settings;
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
            shield: false
        };
        
        this.init();
    }

    init() {
        this.setupVirtualJoystick();
        this.setupActionButtons();
        this.setupTargeting();
        this.setupGestureControls();
        this.setupKeyboardControls();
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
            this.inputState.movement = { x: 0, y: 0 };
        });
    }

    setupActionButtons() {
        const fireBtn = document.getElementById('fire-btn');
        const specialBtn = document.getElementById('special-btn');
        const shieldBtn = document.getElementById('shield-btn');

        // Fire button - continuous firing while held
        fireBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.inputState.firing = true;
            this.addButtonPressEffect(fireBtn);
            this.gameEngine.audioManager.playSound('shoot');
        });

        fireBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.inputState.firing = false;
            this.removeButtonPressEffect(fireBtn);
        });

        // Special ability - single activation
        specialBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.inputState.special) {
                this.inputState.special = true;
                this.addButtonPressEffect(specialBtn);
                this.gameEngine.audioManager.playSound('powerup');
                
                // Reset after a short delay
                setTimeout(() => {
                    this.inputState.special = false;
                    this.removeButtonPressEffect(specialBtn);
                }, 200);
            }
        });

        // Shield - toggle on/off
        shieldBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.inputState.shield = !this.inputState.shield;
            
            if (this.inputState.shield) {
                this.addButtonPressEffect(shieldBtn, true);
                this.gameEngine.audioManager.playSound('powerup');
            } else {
                this.removeButtonPressEffect(shieldBtn);
            }
        });
    }

    setupTargeting() {
        const targetingArea = document.getElementById('targeting-area');
        const gameCanvas = document.getElementById('game-canvas');

        // Targeting area touch
        targetingArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.targetingActive = true;
            this.addButtonPressEffect(targetingArea);
        });

        targetingArea.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.targetingActive = false;
            this.removeButtonPressEffect(targetingArea);
        });

        // Canvas tap-to-target
        gameCanvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const rect = gameCanvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                // Convert screen coordinates to game coordinates
                const gameX = (x / rect.width) * gameCanvas.width;
                const gameY = (y / rect.height) * gameCanvas.height;
                
                this.inputState.targeting = { x: gameX, y: gameY };
                this.lastTargetPosition = { x: gameX, y: gameY };
                
                // Visual feedback
                this.showTargetingFeedback(x, y);
            }
        });
    }

    setupGestureControls() {
        const gameCanvas = document.getElementById('game-canvas');
        let lastTouchTime = 0;

        // Pinch-to-zoom
        gameCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 2) {
                // Start pinch gesture
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                this.gestureStartDistance = this.getTouchDistance(touch1, touch2);
            } else if (e.touches.length === 1) {
                // Check for double-tap
                const currentTime = Date.now();
                if (currentTime - lastTouchTime < 300) {
                    this.handleDoubleTap(e.touches[0]);
                }
                lastTouchTime = currentTime;
            }
        });

        gameCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 2) {
                // Handle pinch zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = this.getTouchDistance(touch1, touch2);
                const zoomDelta = currentDistance / this.gestureStartDistance;
                
                this.handleZoom(zoomDelta);
                this.gestureStartDistance = currentDistance;
            }
        });

        // Swipe navigation (when not in game)
        let swipeStartX = 0;
        let swipeStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                swipeStartX = e.touches[0].clientX;
                swipeStartY = e.touches[0].clientY;
            }
        });

        document.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                const swipeEndX = e.changedTouches[0].clientX;
                const swipeEndY = e.changedTouches[0].clientY;
                
                const deltaX = swipeEndX - swipeStartX;
                const deltaY = swipeEndY - swipeStartY;
                
                // Only process swipes outside the game area
                if (!e.target.closest('#game-canvas')) {
                    this.handleSwipe(deltaX, deltaY);
                }
            }
        });
    }

    setupKeyboardControls() {
        // Desktop fallback controls
        if (!('ontouchstart' in window)) {
            document.addEventListener('keydown', (e) => {
                switch (e.code) {
                    case 'KeyW':
                    case 'ArrowUp':
                        this.inputState.movement.y = -1;
                        break;
                    case 'KeyS':
                    case 'ArrowDown':
                        this.inputState.movement.y = 1;
                        break;
                    case 'KeyA':
                    case 'ArrowLeft':
                        this.inputState.movement.x = -1;
                        break;
                    case 'KeyD':
                    case 'ArrowRight':
                        this.inputState.movement.x = 1;
                        break;
                    case 'Space':
                        e.preventDefault();
                        this.inputState.firing = true;
                        break;
                    case 'KeyE':
                        this.inputState.special = true;
                        break;
                    case 'KeyQ':
                        this.inputState.shield = !this.inputState.shield;
                        break;
                }
            });

            document.addEventListener('keyup', (e) => {
                switch (e.code) {
                    case 'KeyW':
                    case 'KeyS':
                    case 'ArrowUp':
                    case 'ArrowDown':
                        this.inputState.movement.y = 0;
                        break;
                    case 'KeyA':
                    case 'KeyD':
                    case 'ArrowLeft':
                    case 'ArrowRight':
                        this.inputState.movement.x = 0;
                        break;
                    case 'Space':
                        e.preventDefault();
                        this.inputState.firing = false;
                        break;
                    case 'KeyE':
                        this.inputState.special = false;
                        break;
                }
            });

            // Mouse targeting
            document.getElementById('game-canvas').addEventListener('click', (e) => {
                const rect = e.target.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const gameX = (x / rect.width) * e.target.width;
                const gameY = (y / rect.height) * e.target.height;
                
                this.inputState.targeting = { x: gameX, y: gameY };
                this.lastTargetPosition = { x: gameX, y: gameY };
            });
        }
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
            this.gameEngine.setZoom(this.currentZoom);
            
            // Update zoom indicator
            const zoomIndicator = document.getElementById('zoom-indicator');
            if (zoomIndicator) {
                zoomIndicator.textContent = `${this.currentZoom.toFixed(1)}x`;
            }
        }
    }

    handleDoubleTap(touch) {
        // Double-tap to activate special ability
        if (!this.inputState.special) {
            this.inputState.special = true;
            this.gameEngine.audioManager.playSound('powerup');
            
            // Visual feedback at touch position
            this.showDoubleTapFeedback(touch.clientX, touch.clientY);
            
            setTimeout(() => {
                this.inputState.special = false;
            }, 200);
        }
    }

    handleSwipe(deltaX, deltaY) {
        const threshold = 50;
        
        if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (deltaX > 0) {
                    // Swipe right - next screen or action
                    this.gameEngine.emit('swipeRight');
                } else {
                    // Swipe left - previous screen or back
                    this.gameEngine.emit('swipeLeft');
                }
            } else {
                // Vertical swipe
                if (deltaY > 0) {
                    // Swipe down - menu or pause
                    this.gameEngine.emit('swipeDown');
                } else {
                    // Swipe up - special action
                    this.gameEngine.emit('swipeUp');
                }
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
        
        // Add animation keyframes
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
            document.body.removeChild(feedback);
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
        
        // Add animation keyframes
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
            document.body.removeChild(feedback);
        }, 800);
    }

    getInputState() {
        return { ...this.inputState };
    }

    cleanup() {
        if (this.joystick) {
            this.joystick.destroy();
        }
    }
}


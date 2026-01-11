/**
 * Input handling module - manages keyboard and mouse input
 */
export class InputHandler {
    constructor(canvas, gameState) {
        this.canvas = canvas;
        this.gameState = gameState;
        this.keys = {};
        this.mouseMovementX = 0;
        this.mouseMovementY = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mouse movement
        document.addEventListener('mousemove', (e) => {
            if (this.gameState.isPointerLocked && !this.gameState.isPaused) {
                this.mouseMovementX = e.movementX || 0;
                this.mouseMovementY = e.movementY || 0;
            }
        });

        // Canvas click for pointer lock
        this.canvas.addEventListener('click', () => {
            if (!this.gameState.isPointerLocked && !this.gameState.isInMainMenu && !this.gameState.isPaused) {
                this.canvas.requestPointerLock();
            }
        });

        // Mouse button events for shooting and zoom
        document.addEventListener('mousedown', (e) => {
            if (this.gameState.isPointerLocked && !this.gameState.isPaused) {
                if (e.button === 0 && this.onShoot) {
                    // Left mouse button - shoot
                    this.onShoot();
                } else if (e.button === 2 && this.onZoom) {
                    // Right mouse button - zoom
                    this.onZoom(true);
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 2 && this.onZoom) {
                // Right mouse button released - unzoom
                this.onZoom(false);
            }
        });

        // Prevent context menu on right click
        document.addEventListener('contextmenu', (e) => {
            if (this.gameState.isPointerLocked) {
                e.preventDefault();
            }
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    handleKeyDown(e) {
        // Pause with P or Tab key
        if (e.code === 'KeyP' || e.code === 'Tab') {
            e.preventDefault();
            if (!this.gameState.isPaused && !this.gameState.isInMainMenu) {
                this.gameState.showPauseMenu();
            }
            return;
        }

        if (!this.gameState.isPaused && !this.gameState.isInMainMenu) {
            // Weapon switching
            if (e.code === 'Digit1' && this.onWeaponSwitch) {
                this.onWeaponSwitch(0);
                return;
            }
            if (e.code === 'Digit2' && this.onWeaponSwitch) {
                this.onWeaponSwitch(1);
                return;
            }

            // Drop weapon
            if (e.code === 'KeyQ' && this.onDropWeapon) {
                this.onDropWeapon();
                return;
            }

            // Pick up weapon
            if (e.code === 'KeyE' && this.onPickupWeapon) {
                this.onPickupWeapon();
                return;
            }

            // Throw grenade
            if (e.code === 'KeyG' && this.onThrowGrenade) {
                this.onThrowGrenade();
                return;
            }

            this.keys[e.code] = true;
        }
    }

    handleKeyUp(e) {
        this.keys[e.code] = false;
    }

    getMouseMovement() {
        const movement = {
            x: this.mouseMovementX,
            y: this.mouseMovementY
        };
        this.mouseMovementX = 0;
        this.mouseMovementY = 0;
        return movement;
    }

    // Callbacks for game actions
    setShootCallback(callback) {
        this.onShoot = callback;
    }

    setWeaponSwitchCallback(callback) {
        this.onWeaponSwitch = callback;
    }

    setDropWeaponCallback(callback) {
        this.onDropWeapon = callback;
    }

    setPickupWeaponCallback(callback) {
        this.onPickupWeapon = callback;
    }

    setThrowGrenadeCallback(callback) {
        this.onThrowGrenade = callback;
    }

    setZoomCallback(callback) {
        this.onZoom = callback;
    }
}

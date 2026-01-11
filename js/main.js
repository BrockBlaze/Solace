/**
 * Solace - FPS WebGL Game
 * Main entry point - coordinates all game systems
 */
import { physics } from './modules/config.js';
import { SettingsManager } from './modules/settings.js';
import { GameState } from './modules/gameState.js';
import { Player } from './modules/player.js';
import { TargetCube } from './modules/targetCube.js';
import { WeaponSystem } from './modules/weapons.js';
import { Renderer } from './modules/renderer.js';
import { InputHandler } from './modules/input.js';

class Game {
    constructor() {
        // Initialize core systems
        this.canvas = document.getElementById('gameCanvas');
        this.settingsManager = new SettingsManager();
        this.gameState = new GameState();
        this.renderer = new Renderer(this.canvas);

        // Initialize game entities
        this.player = new Player(physics);
        this.targetCube = new TargetCube(physics);
        this.weaponSystem = new WeaponSystem(this.player, physics);

        // Initialize input handler
        this.inputHandler = new InputHandler(this.canvas, this.gameState);

        // Setup callbacks
        this.setupCallbacks();

        // Initialize settings UI
        this.settingsManager.initializeUI();
        this.settingsManager.setupEventListeners();

        // FPS tracking
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fps = 60;

        // Start game loop
        this.gameLoop();
    }

    setupCallbacks() {
        // Input callbacks
        this.inputHandler.setShootCallback(() => this.player.shoot(this.weaponSystem));
        this.inputHandler.setWeaponSwitchCallback((slot) => {
            this.player.currentWeapon = slot;
        });
        this.inputHandler.setDropWeaponCallback(() => this.weaponSystem.dropWeapon());
        this.inputHandler.setPickupWeaponCallback(() => this.weaponSystem.checkPickup());
        this.inputHandler.setThrowGrenadeCallback(() => this.weaponSystem.throwGrenade());
        this.inputHandler.setZoomCallback((isZooming) => this.player.setZooming(isZooming));

        // Game state callbacks
        this.gameState.setRestartCallback(() => this.restart());
    }

    restart() {
        this.player.reset();
        this.targetCube.reset();
        this.weaponSystem.reset();
        this.gameState.resumeGame();
    }

    update() {
        if (this.gameState.isPaused || this.gameState.isInMainMenu) return;

        // Get mouse movement
        const mouseMovement = this.inputHandler.getMouseMovement();

        // Update player
        this.player.update(
            this.inputHandler.keys,
            mouseMovement.x,
            mouseMovement.y,
            this.settingsManager.settings
        );

        // Update target cube
        this.targetCube.update();

        // Handle player-cube collision
        this.player.handleCubeCollision(this.targetCube);

        // Update weapon system
        this.weaponSystem.update(this.targetCube);

        // Update weapon UI
        this.weaponSystem.updateUI();
    }

    render() {
        this.renderer.render(
            this.player,
            this.targetCube,
            this.weaponSystem,
            this.settingsManager.settings
        );
    }

    updateFPS() {
        if (this.settingsManager.settings.showFPS) {
            this.frameCount++;
            const currentTime = performance.now();
            if (currentTime >= this.lastTime + 1000) {
                this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                document.getElementById('fpsValue').textContent = this.fps;
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
        }
    }

    gameLoop() {
        this.update();
        this.render();
        this.updateFPS();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});

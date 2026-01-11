/**
 * Game state and menu management module
 */
export class GameState {
    constructor() {
        this.isPointerLocked = false;
        this.isPaused = false;
        this.isInMainMenu = true;

        // DOM elements
        this.canvas = document.getElementById('gameCanvas');
        this.mainMenu = document.getElementById('mainMenu');
        this.settingsMenu = document.getElementById('settingsMenu');
        this.pauseMenu = document.getElementById('pauseMenu');

        this.setupMenuButtons();
        this.setupPointerLock();
    }

    setupMenuButtons() {
        const playButton = document.getElementById('playButton');
        const mainSettingsButton = document.getElementById('mainSettingsButton');
        const backToMainButton = document.getElementById('backToMainButton');
        const resumeButton = document.getElementById('resumeButton');
        const restartButton = document.getElementById('restartButton');
        const mainMenuButton = document.getElementById('mainMenuButton');

        if (!playButton) {
            console.error('Play button not found!');
            return;
        }

        playButton.addEventListener('click', () => {
            console.log('Play button clicked!');
            this.startGame();
        });
        mainSettingsButton.addEventListener('click', () => this.showSettingsMenu());
        backToMainButton.addEventListener('click', () => this.backToMain());
        resumeButton.addEventListener('click', () => this.resumeGame());
        restartButton.addEventListener('click', () => {
            if (this.onRestart) this.onRestart();
        });
        mainMenuButton.addEventListener('click', () => this.returnToMainMenu());
    }

    setupPointerLock() {
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
        });
    }

    startGame() {
        this.isInMainMenu = false;
        this.mainMenu.classList.add('hidden');
        this.canvas.requestPointerLock();
    }

    showSettingsMenu() {
        this.mainMenu.classList.add('hidden');
        this.settingsMenu.classList.remove('hidden');
    }

    backToMain() {
        this.settingsMenu.classList.add('hidden');
        this.mainMenu.classList.remove('hidden');
    }

    showPauseMenu() {
        this.isPaused = true;
        this.pauseMenu.classList.remove('hidden');
        document.exitPointerLock();
    }

    resumeGame() {
        this.isPaused = false;
        this.pauseMenu.classList.add('hidden');
        this.canvas.requestPointerLock();
    }

    returnToMainMenu() {
        this.isPaused = false;
        this.isInMainMenu = true;
        this.pauseMenu.classList.add('hidden');
        this.mainMenu.classList.remove('hidden');
        document.exitPointerLock();

        // Call restart callback to reset game state
        if (this.onRestart) this.onRestart();
    }

    // Callback for restart functionality
    setRestartCallback(callback) {
        this.onRestart = callback;
    }
}

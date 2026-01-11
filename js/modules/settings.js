/**
 * Settings management module - handles loading, saving, and UI synchronization
 */
import { defaultSettings } from './config.js';

export class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
    }

    loadSettings() {
        const saved = localStorage.getItem('solaceSettings');
        if (saved) {
            try {
                return { ...defaultSettings, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to load settings:', e);
                return { ...defaultSettings };
            }
        }
        return { ...defaultSettings };
    }

    saveSettings() {
        localStorage.setItem('solaceSettings', JSON.stringify(this.settings));
    }

    initializeUI() {
        // Main menu settings
        document.getElementById('mainMouseSensitivity').value = this.settings.mouseSensitivity;
        document.getElementById('mainSensitivityValue').textContent = this.settings.mouseSensitivity.toFixed(1);
        document.getElementById('mainMovementSpeed').value = this.settings.movementSpeed;
        document.getElementById('mainSpeedValue').textContent = this.settings.movementSpeed.toFixed(2);
        document.getElementById('mainFOV').value = this.settings.fov;
        document.getElementById('mainFOVValue').textContent = this.settings.fov + '°';
        document.getElementById('mainInvertMouse').checked = this.settings.invertMouse;
        document.getElementById('mainShowFPS').checked = this.settings.showFPS;

        // Pause menu settings
        document.getElementById('mouseSensitivity').value = this.settings.mouseSensitivity;
        document.getElementById('sensitivityValue').textContent = this.settings.mouseSensitivity.toFixed(1);
        document.getElementById('movementSpeed').value = this.settings.movementSpeed;
        document.getElementById('speedValue').textContent = this.settings.movementSpeed.toFixed(2);
        document.getElementById('fov').value = this.settings.fov;
        document.getElementById('fovValue').textContent = this.settings.fov + '°';
        document.getElementById('invertMouse').checked = this.settings.invertMouse;
        document.getElementById('showFPS').checked = this.settings.showFPS;

        // Apply FPS display setting
        const fpsDisplay = document.getElementById('fps');
        fpsDisplay.style.display = this.settings.showFPS ? 'block' : 'none';
    }

    setupEventListeners() {
        // Pause Menu handlers
        this.setupSlider('mouseSensitivity', 'sensitivityValue', 'mouseSensitivity', 1);
        this.setupSlider('movementSpeed', 'speedValue', 'movementSpeed', 2);
        this.setupSlider('fov', 'fovValue', 'fov', 0, '°');
        this.setupCheckbox('invertMouse', 'invertMouse');
        this.setupCheckbox('showFPS', 'showFPS', () => {
            const fpsDisplay = document.getElementById('fps');
            fpsDisplay.style.display = this.settings.showFPS ? 'block' : 'none';
        });

        // Main Menu handlers
        this.setupSlider('mainMouseSensitivity', 'mainSensitivityValue', 'mouseSensitivity', 1, '', 'main');
        this.setupSlider('mainMovementSpeed', 'mainSpeedValue', 'movementSpeed', 2, '', 'main');
        this.setupSlider('mainFOV', 'mainFOVValue', 'fov', 0, '°', 'main');
        this.setupCheckbox('mainInvertMouse', 'invertMouse', null, 'main');
        this.setupCheckbox('mainShowFPS', 'showFPS', () => {
            const fpsDisplay = document.getElementById('fps');
            fpsDisplay.style.display = this.settings.showFPS ? 'block' : 'none';
        }, 'main');
    }

    setupSlider(inputId, valueId, settingKey, decimals, suffix = '', prefix = '') {
        const input = document.getElementById(inputId);
        const valueDisplay = document.getElementById(valueId);
        const otherInputId = prefix === 'main' ? inputId.replace('main', '').toLowerCase() : 'main' + inputId.charAt(0).toUpperCase() + inputId.slice(1);
        const otherValueId = prefix === 'main' ? valueId.replace('main', '').toLowerCase() : 'main' + valueId.charAt(0).toUpperCase() + valueId.slice(1);

        input.addEventListener('input', (e) => {
            const value = decimals === 0 ? parseInt(e.target.value) : parseFloat(e.target.value);
            this.settings[settingKey] = value;
            valueDisplay.textContent = value.toFixed(decimals) + suffix;

            // Sync with other menu
            const otherInput = document.getElementById(otherInputId);
            const otherValue = document.getElementById(otherValueId);
            if (otherInput) otherInput.value = value;
            if (otherValue) otherValue.textContent = value.toFixed(decimals) + suffix;

            this.saveSettings();
        });
    }

    setupCheckbox(inputId, settingKey, callback = null, prefix = '') {
        const input = document.getElementById(inputId);
        const otherInputId = prefix === 'main' ? inputId.replace('main', '').toLowerCase() : 'main' + inputId.charAt(0).toUpperCase() + inputId.slice(1);

        input.addEventListener('change', (e) => {
            this.settings[settingKey] = e.target.checked;

            // Sync with other menu
            const otherInput = document.getElementById(otherInputId);
            if (otherInput) otherInput.checked = e.target.checked;

            if (callback) callback();
            this.saveSettings();
        });
    }
}

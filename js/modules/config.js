/**
 * Game configuration and constants
 */

// Default game settings
export const defaultSettings = {
    mouseSensitivity: 2.0,
    movementSpeed: 0.1,
    invertMouse: false,
    showFPS: false,
    fov: 75
};

// Weapon type definitions
export const weaponTypes = {
    pistol: {
        name: 'Pistol',
        damage: 15,
        fireRate: 300, // ms between shots
        ammo: 12,
        maxAmmo: 12,
        color: [0.3, 0.3, 0.3]
    },
    rifle: {
        name: 'Rifle',
        damage: 25,
        fireRate: 150,
        ammo: 30,
        maxAmmo: 30,
        color: [0.2, 0.2, 0.2]
    }
};

// Physics constants
export const physics = {
    gravity: 0.005,
    jumpPower: 0.18,
    playerHeight: 1.7,
    cubeSize: 1.0,
    gravityMultiplierUp: 0.6,    // Lighter gravity while rising
    gravityMultiplierDown: 1.3   // Faster fall but not too fast
};

// Player initial state
export const initialPlayerState = {
    position: [0, 1.7, 5],
    velocity: [0, 0, 0],
    rotation: [0, 0],
    weapons: [null, null],
    currentWeapon: 0,
    grenades: 3,
    lastShot: 0,
    onGround: false
};

// Cube initial state
export const initialCubeState = {
    position: [0, 1, -5],
    velocity: [0, 0, 0],
    rotation: [0, 0, 0],
    angularVelocity: [0, 0, 0],
    health: 100,
    size: 1.0
};

// Weapon pickup locations
export const weaponPickupLocations = [
    { type: 'pistol', position: [5, 1.0, -3] },
    { type: 'rifle', position: [-5, 1.0, -3] },
    { type: 'pistol', position: [0, 1.0, -10] }
];

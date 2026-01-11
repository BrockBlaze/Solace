/**
 * Player module - handles player state, movement, and shooting
 */
import { initialPlayerState, weaponTypes } from './config.js';

export class Player {
    constructor(physics) {
        this.physics = physics;
        this.reset();
    }

    reset() {
        this.position = [...initialPlayerState.position];
        this.velocity = [...initialPlayerState.velocity];
        this.rotation = [...initialPlayerState.rotation];
        this.weapons = [null, null];
        this.currentWeapon = 0;
        this.grenades = 3;
        this.lastShot = 0;
        this.onGround = false;
        this.isCrouching = false;
        this.isSprinting = false;
        this.eyeHeight = this.physics.playerHeight;
        this.crouchHeight = 1.2;
        this.targetHeight = this.physics.playerHeight;
        this.sprintMultiplier = 1.8;
        // Horizontal velocity for smooth acceleration
        this.horizontalVelocity = [0, 0]; // [x, z]
        this.acceleration = 0.25; // How fast we reach max speed (increased for responsiveness)
        this.deceleration = 0.85; // How fast we slow down (friction)
        this.jumpPressed = false; // Track if jump button was already pressed
        // FOV kick for sprinting
        this.currentFov = 0; // Offset from base FOV
        this.sprintFovKick = 10; // Degrees to add when sprinting
        // Zoom state
        this.isZooming = false;
        this.zoomFovReduction = 30; // Degrees to reduce when zooming
    }

    update(keys, mouseMovementX, mouseMovementY, settings) {
        // Mouse look
        const sensitivity = 0.002 * settings.mouseSensitivity;
        const invertMultiplier = settings.invertMouse ? -1 : 1;
        this.rotation[0] -= mouseMovementX * sensitivity * invertMultiplier;
        this.rotation[1] -= mouseMovementY * sensitivity * invertMultiplier;
        this.rotation[1] = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation[1]));

        // Crouching (Ctrl or C key)
        if (keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC']) {
            this.isCrouching = true;
            this.targetHeight = this.crouchHeight;
        } else {
            this.isCrouching = false;
            this.targetHeight = this.eyeHeight;
        }

        // Smoother crouch transition using lerp
        const crouchLerpSpeed = 0.08; // Slower for more natural crouch feel
        const heightDiff = this.targetHeight - this.position[1];
        this.position[1] += heightDiff * crouchLerpSpeed;

        // Snap to target if very close
        if (Math.abs(heightDiff) < 0.01) {
            this.position[1] = this.targetHeight;
        }

        // Sprinting (can't sprint while crouching)
        this.isSprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && !this.isCrouching && this.onGround;

        // Calculate max speed based on state
        let maxSpeed = settings.movementSpeed;
        if (this.isSprinting) {
            maxSpeed *= this.sprintMultiplier;
        } else if (this.isCrouching) {
            maxSpeed *= 0.5; // Slower while crouching
        }

        // Calculate desired velocity based on input
        const forward = [-Math.sin(this.rotation[0]), 0, -Math.cos(this.rotation[0])];
        const right = [Math.cos(this.rotation[0]), 0, -Math.sin(this.rotation[0])];

        let targetVelocity = [0, 0]; // [x, z]

        if (keys['KeyW']) {
            targetVelocity[0] += forward[0] * maxSpeed;
            targetVelocity[1] += forward[2] * maxSpeed;
        }
        if (keys['KeyS']) {
            targetVelocity[0] -= forward[0] * maxSpeed;
            targetVelocity[1] -= forward[2] * maxSpeed;
        }
        if (keys['KeyA']) {
            targetVelocity[0] -= right[0] * maxSpeed;
            targetVelocity[1] -= right[2] * maxSpeed;
        }
        if (keys['KeyD']) {
            targetVelocity[0] += right[0] * maxSpeed;
            targetVelocity[1] += right[2] * maxSpeed;
        }

        // Smooth acceleration towards target velocity
        this.horizontalVelocity[0] += (targetVelocity[0] - this.horizontalVelocity[0]) * this.acceleration;
        this.horizontalVelocity[1] += (targetVelocity[1] - this.horizontalVelocity[1]) * this.acceleration;

        // Apply deceleration/friction
        this.horizontalVelocity[0] *= this.deceleration;
        this.horizontalVelocity[1] *= this.deceleration;

        // Stop if very slow
        if (Math.abs(this.horizontalVelocity[0]) < 0.0001) this.horizontalVelocity[0] = 0;
        if (Math.abs(this.horizontalVelocity[1]) < 0.0001) this.horizontalVelocity[1] = 0;

        // Apply horizontal velocity to position
        this.position[0] += this.horizontalVelocity[0];
        this.position[2] += this.horizontalVelocity[1];

        // Jump (can't jump while crouching) - requires release and press
        const spacePressed = keys['Space'];
        if (spacePressed && !this.jumpPressed && this.onGround && !this.isCrouching) {
            this.velocity[1] = this.physics.jumpPower;
            this.onGround = false;
        }
        this.jumpPressed = spacePressed;

        // Gravity with different multipliers for up vs down (creates arc/hang effect)
        let gravityMultiplier = this.velocity[1] > 0 ? this.physics.gravityMultiplierUp : this.physics.gravityMultiplierDown;
        this.velocity[1] -= this.physics.gravity * gravityMultiplier;
        this.position[1] += this.velocity[1];

        // Ground collision
        const groundHeight = this.targetHeight;
        if (this.position[1] <= groundHeight) {
            this.position[1] = groundHeight;
            this.velocity[1] = 0;
            this.onGround = true;
        }

        // FOV changes for sprinting and zooming - smooth transition
        let targetFov = 0;
        if (this.isZooming) {
            targetFov = -this.zoomFovReduction; // Reduce FOV for zoom
        } else if (this.isSprinting) {
            targetFov = this.sprintFovKick; // Increase FOV for sprint
        }
        const fovLerpSpeed = 0.15;
        this.currentFov += (targetFov - this.currentFov) * fovLerpSpeed;
    }

    setZooming(isZooming) {
        this.isZooming = isZooming;
    }

    shoot(weaponSystem) {
        const currentWeapon = this.weapons[this.currentWeapon];

        // Check if player has a weapon and can fire
        if (!currentWeapon) return false;

        const now = Date.now();
        const weaponDef = weaponTypes[currentWeapon.type];

        if (now - this.lastShot < weaponDef.fireRate) return false;
        if (currentWeapon.ammo <= 0) return false;

        this.lastShot = now;
        currentWeapon.ammo--;

        // Calculate shooting direction (where the camera/crosshair is pointing)
        const cosPitch = Math.cos(this.rotation[1]);
        const sinPitch = Math.sin(this.rotation[1]);

        // Forward direction vector (where crosshair points)
        // Uses same formula as movement for consistency
        const forward = [
            -Math.sin(this.rotation[0]) * cosPitch,
            sinPitch,  // Inverted Y for correct up/down direction
            -Math.cos(this.rotation[0]) * cosPitch
        ];

        // Start bullet slightly in front of camera to avoid shooting yourself
        const spawnDistance = 0.5;
        const bulletStart = [
            this.position[0] + forward[0] * spawnDistance,
            this.position[1] + forward[1] * spawnDistance,
            this.position[2] + forward[2] * spawnDistance
        ];

        // Fire bullet through weapon system
        weaponSystem.fireBullet(bulletStart, forward, currentWeapon.type);

        return true;
    }

    handleCubeCollision(targetCube) {
        const dx = this.position[0] - targetCube.position[0];
        const dz = this.position[2] - targetCube.position[2];
        const distanceXZ = Math.sqrt(dx * dx + dz * dz);
        const minDistance = 0.5 + targetCube.size / 2; // Player radius + cube half-size

        if (distanceXZ < minDistance && distanceXZ > 0.01) {
            // Calculate overlap amount
            const overlap = minDistance - distanceXZ;

            // Normalize direction vector
            const nx = dx / distanceXZ;
            const nz = dz / distanceXZ;

            // Push cube away from player with stronger force
            const pushStrength = 0.15;
            targetCube.velocity[0] -= nx * pushStrength;
            targetCube.velocity[2] -= nz * pushStrength;

            // Add rotation when pushed - creates rolling/tumbling effect
            const torque = 0.015;
            targetCube.angularVelocity[0] += nz * torque;
            targetCube.angularVelocity[2] -= nx * torque;

            // Separate player and cube to prevent overlap
            const separationStrength = overlap * 0.5;
            this.position[0] += nx * separationStrength;
            this.position[2] += nz * separationStrength;
            targetCube.position[0] -= nx * separationStrength;
            targetCube.position[2] -= nz * separationStrength;
        }
    }
}

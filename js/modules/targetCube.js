/**
 * Target cube module - handles cube physics and state
 */
import { initialCubeState } from './config.js';

export class TargetCube {
    constructor(physics) {
        this.physics = physics;
        this.reset();
    }

    reset() {
        this.position = [...initialCubeState.position];
        this.velocity = [...initialCubeState.velocity];
        this.rotation = [...initialCubeState.rotation];
        this.angularVelocity = [...initialCubeState.angularVelocity];
        this.health = initialCubeState.health;
        this.size = initialCubeState.size;
        this.hit = false;
        this.hitTime = 0;
    }

    update() {
        // Apply gravity
        this.velocity[1] -= this.physics.gravity;
        this.position[0] += this.velocity[0];
        this.position[1] += this.velocity[1];
        this.position[2] += this.velocity[2];

        // Update rotation
        this.rotation[0] += this.angularVelocity[0];
        this.rotation[1] += this.angularVelocity[1];
        this.rotation[2] += this.angularVelocity[2];

        // Ground collision
        if (this.position[1] - this.size / 2 <= 0) {
            this.position[1] = this.size / 2;
            this.velocity[1] = 0;
            // Apply friction to velocity and rotation
            this.velocity[0] *= 0.95;
            this.velocity[2] *= 0.95;
            this.angularVelocity[0] *= 0.92;
            this.angularVelocity[1] *= 0.92;
            this.angularVelocity[2] *= 0.92;

            // Check if cube is nearly at rest
            const velocityMagnitude = Math.sqrt(
                this.velocity[0] ** 2 +
                this.velocity[2] ** 2
            );
            const angularVelocityMagnitude = Math.sqrt(
                this.angularVelocity[0] ** 2 +
                this.angularVelocity[1] ** 2 +
                this.angularVelocity[2] ** 2
            );

            // When nearly at rest, snap to nearest flat face
            if (velocityMagnitude < 0.02 && angularVelocityMagnitude < 0.05) {
                // Stop all movement
                this.velocity[0] = 0;
                this.velocity[2] = 0;
                this.angularVelocity[0] = 0;
                this.angularVelocity[1] = 0;
                this.angularVelocity[2] = 0;

                // Snap each rotation axis to nearest 90-degree increment (π/2)
                const snapAngle = Math.PI / 2;
                for (let i = 0; i < 3; i++) {
                    const snappedRotation = Math.round(this.rotation[i] / snapAngle) * snapAngle;
                    const rotationDiff = snappedRotation - this.rotation[i];

                    // Smooth lerp to snapped rotation
                    this.rotation[i] += rotationDiff * 0.15;

                    // Snap exactly when very close
                    if (Math.abs(rotationDiff) < 0.01) {
                        this.rotation[i] = snappedRotation;
                    }
                }
            }
        }

        // Reset hit effect
        if (this.hit && Date.now() - this.hitTime > 100) {
            this.hit = false;
        }
    }
}

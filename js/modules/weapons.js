/**
 * Weapon system module - handles weapon pickups, drops, and grenades
 */
import { weaponTypes, weaponPickupLocations } from './config.js';

export class WeaponSystem {
    constructor(player, physics) {
        this.player = player;
        this.physics = physics;
        this.weaponPickups = weaponPickupLocations.map(loc => ({
            ...loc,
            picked: false,
            velocity: [0, 0, 0],
            rotation: Math.random() * Math.PI * 2 // Random initial rotation
        }));
        this.droppedWeapons = [];
        this.grenades = [];
        this.bullets = []; // Active bullet projectiles
    }

    fireBullet(position, direction, weaponType) {
        // Create a bullet projectile
        const bulletSpeed = weaponType === 'pistol' ? 1.0 : 1.2; // Rifle shoots faster

        const bullet = {
            position: [...position],
            velocity: [
                direction[0] * bulletSpeed,
                direction[1] * bulletSpeed,
                direction[2] * bulletSpeed
            ],
            damage: weaponTypes[weaponType].damage,
            lifetime: Date.now() + 3000, // 3 second lifetime
            type: weaponType
        };

        this.bullets.push(bullet);
    }

    pickupWeapon(weaponType) {
        const weapon = { type: weaponType, ammo: weaponTypes[weaponType].maxAmmo };

        // If current slot is empty, pick up weapon
        if (!this.player.weapons[this.player.currentWeapon]) {
            this.player.weapons[this.player.currentWeapon] = weapon;
            return true;
        }

        // If other slot is empty, put it there
        const otherSlot = this.player.currentWeapon === 0 ? 1 : 0;
        if (!this.player.weapons[otherSlot]) {
            this.player.weapons[otherSlot] = weapon;
            this.player.currentWeapon = otherSlot;
            return true;
        }

        // Both slots full, replace current weapon
        this.dropWeapon();
        this.player.weapons[this.player.currentWeapon] = weapon;
        return true;
    }

    dropWeapon() {
        const weapon = this.player.weapons[this.player.currentWeapon];
        if (!weapon) return;

        // Drop weapon in front of player
        const dropDistance = 2;
        const forward = [-Math.sin(this.player.rotation[0]), 0, -Math.cos(this.player.rotation[0])];

        this.droppedWeapons.push({
            type: weapon.type,
            ammo: weapon.ammo,
            position: [
                this.player.position[0] + forward[0] * dropDistance,
                0.5,
                this.player.position[2] + forward[2] * dropDistance
            ],
            velocity: [forward[0] * 0.1, 0.1, forward[2] * 0.1]
        });

        this.player.weapons[this.player.currentWeapon] = null;
    }

    throwGrenade() {
        if (this.player.grenades <= 0) return;

        this.player.grenades--;

        const forward = [
            Math.sin(this.player.rotation[0]),
            -Math.sin(this.player.rotation[1]),
            -Math.cos(this.player.rotation[0])
        ];

        const throwPower = 0.3;
        const startPos = [
            this.player.position[0] + forward[0],
            this.player.position[1] + forward[1],
            this.player.position[2] + forward[2]
        ];

        this.grenades.push({
            position: [...startPos],
            velocity: [forward[0] * throwPower, forward[1] * throwPower + 0.2, forward[2] * throwPower],
            fuseTime: Date.now() + 3000 // 3 second fuse
        });
    }

    checkPickup() {
        // Check for nearby weapon pickups
        this.weaponPickups.forEach(pickup => {
            if (pickup.picked) return;
            const dx = this.player.position[0] - pickup.position[0];
            const dz = this.player.position[2] - pickup.position[2];
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 2) {
                this.pickupWeapon(pickup.type);
                pickup.picked = true;
            }
        });

        // Check for dropped weapons
        for (let i = this.droppedWeapons.length - 1; i >= 0; i--) {
            const weapon = this.droppedWeapons[i];
            const dx = this.player.position[0] - weapon.position[0];
            const dz = this.player.position[2] - weapon.position[2];
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 2) {
                const newWeapon = { type: weapon.type, ammo: weapon.ammo };

                if (!this.player.weapons[this.player.currentWeapon]) {
                    this.player.weapons[this.player.currentWeapon] = newWeapon;
                } else {
                    const otherSlot = this.player.currentWeapon === 0 ? 1 : 0;
                    if (!this.player.weapons[otherSlot]) {
                        this.player.weapons[otherSlot] = newWeapon;
                        this.player.currentWeapon = otherSlot;
                    } else {
                        this.dropWeapon();
                        this.player.weapons[this.player.currentWeapon] = newWeapon;
                    }
                }

                this.droppedWeapons.splice(i, 1);
                break;
            }
        }
    }

    update(targetCube) {
        // Update weapon pickups physics
        this.weaponPickups.forEach(pickup => {
            if (pickup.picked) return;

            // Initialize vertical velocity if not present
            if (!pickup.velocity[1]) pickup.velocity[1] = 0;

            // Apply gravity
            pickup.velocity[1] -= this.physics.gravity;

            // Apply friction to horizontal movement
            pickup.velocity[0] *= 0.92;
            pickup.velocity[2] *= 0.92;

            // Stop if very slow (horizontal only)
            if (Math.abs(pickup.velocity[0]) < 0.001) pickup.velocity[0] = 0;
            if (Math.abs(pickup.velocity[2]) < 0.001) pickup.velocity[2] = 0;

            // Apply velocity to position
            pickup.position[0] += pickup.velocity[0];
            pickup.position[1] += pickup.velocity[1];
            pickup.position[2] += pickup.velocity[2];

            // Ground collision - weapon should rest on ground (laying on side)
            // When rotated 90 degrees on X axis, the weapon's height becomes its width
            const groundHeight = 0.15;
            if (pickup.position[1] <= groundHeight) {
                pickup.position[1] = groundHeight;
                pickup.velocity[1] = 0;
            }

            // Player collision - push weapon away
            const dx = pickup.position[0] - this.player.position[0];
            const dz = pickup.position[2] - this.player.position[2];
            const distanceXZ = Math.sqrt(dx * dx + dz * dz);
            const minDistance = 0.8; // Player radius + weapon size

            if (distanceXZ < minDistance && distanceXZ > 0.01) {
                const overlap = minDistance - distanceXZ;
                const nx = dx / distanceXZ;
                const nz = dz / distanceXZ;

                // Push weapon away
                const pushStrength = 0.08;
                pickup.velocity[0] += nx * pushStrength;
                pickup.velocity[2] += nz * pushStrength;

                // Separate to prevent overlap
                const separationStrength = overlap * 0.5;
                pickup.position[0] += nx * separationStrength;
                pickup.position[2] += nz * separationStrength;
            }
        });

        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            // Move bullet
            bullet.position[0] += bullet.velocity[0];
            bullet.position[1] += bullet.velocity[1];
            bullet.position[2] += bullet.velocity[2];

            // Check if bullet hit the ground
            if (bullet.position[1] <= 0) {
                this.bullets.splice(i, 1);
                continue;
            }

            // Check if bullet lifetime expired
            if (Date.now() >= bullet.lifetime) {
                this.bullets.splice(i, 1);
                continue;
            }

            // Check collision with target cube
            const halfSize = targetCube.size / 2;
            const dx = bullet.position[0] - targetCube.position[0];
            const dy = bullet.position[1] - targetCube.position[1];
            const dz = bullet.position[2] - targetCube.position[2];

            if (Math.abs(dx) < halfSize && Math.abs(dy) < halfSize && Math.abs(dz) < halfSize) {
                // Hit!
                targetCube.hit = true;
                targetCube.hitTime = Date.now();
                targetCube.health -= bullet.damage;

                // Push cube
                const pushForce = 0.1;
                const dir = [
                    bullet.velocity[0] / Math.sqrt(bullet.velocity[0]**2 + bullet.velocity[1]**2 + bullet.velocity[2]**2),
                    bullet.velocity[1] / Math.sqrt(bullet.velocity[0]**2 + bullet.velocity[1]**2 + bullet.velocity[2]**2),
                    bullet.velocity[2] / Math.sqrt(bullet.velocity[0]**2 + bullet.velocity[1]**2 + bullet.velocity[2]**2)
                ];
                targetCube.velocity[0] += dir[0] * pushForce;
                targetCube.velocity[1] += dir[1] * pushForce;
                targetCube.velocity[2] += dir[2] * pushForce;

                // Add rotation
                const torqueStrength = 0.02;
                targetCube.angularVelocity[0] += dir[2] * torqueStrength;
                targetCube.angularVelocity[2] -= dir[0] * torqueStrength;

                if (targetCube.health <= 0) {
                    targetCube.position = [
                        (Math.random() - 0.5) * 20,
                        targetCube.size / 2,
                        (Math.random() - 0.5) * 20
                    ];
                    targetCube.velocity = [0, 0, 0];
                    targetCube.rotation = [0, 0, 0];
                    targetCube.angularVelocity = [0, 0, 0];
                    targetCube.health = 100;
                }

                // Remove bullet
                this.bullets.splice(i, 1);
                continue;
            }
        }

        // Update dropped weapons
        for (let i = this.droppedWeapons.length - 1; i >= 0; i--) {
            const weapon = this.droppedWeapons[i];

            weapon.velocity[1] -= this.physics.gravity;
            weapon.position[0] += weapon.velocity[0];
            weapon.position[1] += weapon.velocity[1];
            weapon.position[2] += weapon.velocity[2];

            if (weapon.position[1] <= 0.5) {
                weapon.position[1] = 0.5;
                weapon.velocity = [0, 0, 0];
            }
        }

        // Update grenades
        for (let i = this.grenades.length - 1; i >= 0; i--) {
            const grenade = this.grenades[i];

            grenade.velocity[1] -= this.physics.gravity;
            grenade.position[0] += grenade.velocity[0];
            grenade.position[1] += grenade.velocity[1];
            grenade.position[2] += grenade.velocity[2];

            // Ground bounce
            if (grenade.position[1] <= 0.3) {
                grenade.position[1] = 0.3;
                grenade.velocity[1] = -grenade.velocity[1] * 0.5; // Bounce
                grenade.velocity[0] *= 0.8;
                grenade.velocity[2] *= 0.8;
            }

            // Check if grenade should explode
            if (Date.now() >= grenade.fuseTime) {
                // Explosion effect - damage cube if nearby
                const dx = targetCube.position[0] - grenade.position[0];
                const dy = targetCube.position[1] - grenade.position[1];
                const dz = targetCube.position[2] - grenade.position[2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < 5) {
                    const damage = 50 * (1 - dist / 5);
                    targetCube.health -= damage;
                    targetCube.hit = true;
                    targetCube.hitTime = Date.now();

                    // Push cube away from explosion
                    const nx = dx / (dist + 0.01);
                    const ny = dy / (dist + 0.01);
                    const nz = dz / (dist + 0.01);
                    const force = 0.3 * (1 - dist / 5);

                    targetCube.velocity[0] += nx * force;
                    targetCube.velocity[1] += ny * force + 0.2;
                    targetCube.velocity[2] += nz * force;

                    if (targetCube.health <= 0) {
                        targetCube.position = [
                            (Math.random() - 0.5) * 20,
                            targetCube.size / 2,
                            (Math.random() - 0.5) * 20
                        ];
                        targetCube.velocity = [0, 0, 0];
                        targetCube.health = 100;
                    }
                }

                this.grenades.splice(i, 1);
            }
        }
    }

    updateUI() {
        const weapon1Span = document.getElementById('weapon1');
        const weapon2Span = document.getElementById('weapon2');
        const grenadeCountSpan = document.getElementById('grenadeCount');

        // Update weapon 1
        if (this.player.weapons[0]) {
            const w = this.player.weapons[0];
            weapon1Span.textContent = `${weaponTypes[w.type].name} (${w.ammo}/${weaponTypes[w.type].maxAmmo})`;
            weapon1Span.style.color = this.player.currentWeapon === 0 ? '#00ff00' : '#ffffff';
        } else {
            weapon1Span.textContent = 'Empty';
            weapon1Span.style.color = this.player.currentWeapon === 0 ? '#ffaa00' : '#aaa';
        }

        // Update weapon 2
        if (this.player.weapons[1]) {
            const w = this.player.weapons[1];
            weapon2Span.textContent = `${weaponTypes[w.type].name} (${w.ammo}/${weaponTypes[w.type].maxAmmo})`;
            weapon2Span.style.color = this.player.currentWeapon === 1 ? '#00ff00' : '#ffffff';
        } else {
            weapon2Span.textContent = 'Empty';
            weapon2Span.style.color = this.player.currentWeapon === 1 ? '#ffaa00' : '#aaa';
        }

        // Update grenade count
        grenadeCountSpan.textContent = this.player.grenades;
    }

    reset() {
        // Reset pickups to their initial positions with physics
        this.weaponPickups = weaponPickupLocations.map(loc => ({
            ...loc,
            picked: false,
            velocity: [0, 0, 0],
            rotation: Math.random() * Math.PI * 2
        }));
        this.droppedWeapons.length = 0;
        this.grenades.length = 0;
        this.bullets.length = 0;
    }
}

# Solace

A first-person shooter (FPS) game built with WebGL and vanilla JavaScript. Features a Halo-style two-weapon system, grenade mechanics, and physics-based gameplay.

## Features

- **First-Person Controls**: WASD movement with mouse look
- **Halo-Style Weapon System**: Carry two weapons at once, pick up and drop weapons
- **Multiple Weapon Types**: Pistol and Rifle with different stats
- **Grenade Mechanics**: Throw grenades with physics-based trajectory and explosions
- **Physics Simulation**: Gravity, collision detection, and dynamic interactions
- **Customizable Settings**: Mouse sensitivity, movement speed, FOV, and more
- **Persistent Settings**: Settings saved to localStorage

## Controls

### Movement
- **W/A/S/D** - Move forward/left/backward/right
- **Mouse** - Look around
- **Space** - Jump
- **Left Click** - Shoot

### Weapons
- **E** - Pick up weapon
- **Q** - Drop current weapon
- **1/2** - Switch between weapon slots
- **G** - Throw grenade

### Menu
- **P** or **Tab** - Pause menu
- **ESC** - (Not used - reserved for browser)

## Project Structure

```
Solace/
├── index.html              # Main HTML file
├── css/
│   └── styles.css          # All styling
├── js/
│   ├── main.js             # Main game entry point
│   ├── lib/
│   │   └── mat4.js         # Matrix math library
│   └── modules/
│       ├── config.js       # Game configuration and constants
│       ├── gameState.js    # Menu and game state management
│       ├── input.js        # Input handling (keyboard/mouse)
│       ├── player.js       # Player controller
│       ├── renderer.js     # WebGL rendering
│       ├── settings.js     # Settings management
│       ├── targetCube.js   # Target cube physics
│       └── weapons.js      # Weapon system and grenades
├── assets/
│   └── Textures/           # Texture assets (currently unused)
└── README.md               # This file
```

## Getting Started

### Prerequisites
- A modern web browser with WebGL support
- A local web server (required for ES6 modules)

### Running the Game

1. **Using Python's built-in server**:
   ```bash
   # Python 3
   python -m http.server 8000

   # Python 2
   python -m SimpleHTTPServer 8000
   ```

2. **Using Node.js http-server**:
   ```bash
   npx http-server -p 8000
   ```

3. **Using VS Code Live Server**:
   - Install the "Live Server" extension
   - Right-click on `index.html` and select "Open with Live Server"

4. Open your browser and navigate to `http://localhost:8000`

## Architecture

The game is built with a modular architecture using ES6 modules:

### Core Systems

- **Game Loop** (`main.js`): Coordinates all systems, handles update/render cycle
- **Renderer** (`renderer.js`): Manages WebGL context, shaders, and drawing
- **Player** (`player.js`): Player movement, shooting, and collisions
- **Weapon System** (`weapons.js`): Weapon pickups, drops, switching, and grenades
- **Input Handler** (`input.js`): Keyboard and mouse event management
- **Game State** (`gameState.js`): Menu navigation and pause functionality
- **Settings Manager** (`settings.js`): User preferences and localStorage

### Configuration

All game constants are centralized in `config.js`:
- Weapon definitions (damage, fire rate, ammo)
- Physics constants (gravity, jump power)
- Initial states for player and objects
- Weapon pickup locations

## Development

### Adding New Weapons

1. Define weapon type in `js/modules/config.js`:
   ```javascript
   sniper: {
       name: 'Sniper',
       damage: 100,
       fireRate: 1000,
       ammo: 5,
       maxAmmo: 5,
       color: [0.1, 0.1, 0.3]
   }
   ```

2. Add pickup locations in `config.js`:
   ```javascript
   { type: 'sniper', position: [10, 0.5, -5] }
   ```

### Modifying Physics

Edit physics constants in `js/modules/config.js`:
```javascript
export const physics = {
    gravity: 0.008,
    jumpPower: 0.15,
    playerHeight: 1.7,
    cubeSize: 1.0
};
```

### Customizing Controls

Modify key bindings in `js/modules/input.js` in the `handleKeyDown` method.

## Technologies Used

- **WebGL** - 3D graphics rendering
- **ES6 Modules** - Code organization
- **LocalStorage API** - Settings persistence
- **Pointer Lock API** - FPS mouse controls
- **Custom Matrix Math** - 3D transformations

## Future Enhancements

- Multiple levels/maps
- Enemy AI
- More weapon types
- Particle effects for explosions
- Sound effects and music
- Multiplayer support
- Texture mapping
- Lighting and shadows

## License

This project is open source and available for educational purposes.

## Credits

Developed as a learning project for WebGL and game development.

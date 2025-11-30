# Project Overview: Tiny Tanks Time

## 📖 Introduction

**Tiny Tanks Time** is a real-time multiplayer tank battle game. Players control circular tanks in a 2D arena, shooting bullets at each other. The project is built as a monorepo using **Nx**, separating the frontend and backend logic while sharing a common workspace.

## 🏗️ Architecture & Tech Stack

The project is structured as a monorepo with the following main components:

### 1. Frontend (`apps/tiny-tanks-time`)

- **Framework**: Angular (v20.3.0)
- **Language**: TypeScript
- **Styling**: CSS (utilizing gradients and shadows for game assets like tanks and bullets)
- **Communication**: `socket.io-client` for real-time WebSocket connection to the server.
- **Key Components**:
  - `GameComponent`: Handles the game loop, rendering, and user input (WASD/Arrows + Space).
  - `GameService`: Manages WebSocket events (`playerMove`, `shoot`, `playerJoined`, etc.).

### 2. Backend (`apps/server`)

- **Framework**: NestJS (v10.0.2)
- **Language**: TypeScript
- **Communication**: `socket.io` (Gateway) for handling WebSocket connections.
- **Responsibilities**:
  - Managing game state (player positions, bullets).
  - Broadcasting updates to all connected clients.
  - Handling player connections and disconnections.

### 3. Tooling

- **Workspace Manager**: Nx (v22.0.0)
- **Linting**: ESLint
- **Testing**: Jest

## 📂 Key Directory Structure

```text
tiny-tanks-time/
├── apps/
│   ├── server/                 # NestJS Backend Application
│   │   └── src/app/
│   │       ├── game.gateway.ts # WebSocket logic (events handling)
│   │       └── ...
│   ├── tiny-tanks-time/        # Angular Frontend Application
│   │   └── src/app/game/       # Main Game Logic
│   │       ├── game.component.ts
│   │       ├── game.service.ts
│   │       └── ...
│   └── server-e2e/             # E2E Tests for Server
├── package.json                # Root dependencies and scripts
├── nx.json                     # Nx configuration
└── GAME_SETUP.md               # Detailed game setup and gameplay instructions
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Running the Project

1.  **Install Dependencies**:

    ```bash
    npm install
    ```

2.  **Start the Backend** (Port 3000):

    ```bash
    nx serve server
    ```

3.  **Start the Frontend** (Port 4200):

    ```bash
    nx serve tiny-tanks-time
    ```

4.  **Play**:
    Open `http://localhost:4200` in multiple browser tabs to simulate multiplayer.

## 🎮 Gameplay Mechanics

- **Movement**: WASD or Arrow Keys.
- **Action**: Spacebar to shoot.
- **Graphics**: Pure CSS implementation for tanks (circular with direction indicators) and bullets.
- **Sync**: Real-time position and state synchronization via WebSockets.

## 📝 Notes for Future Development

- **State Management**: Currently, the server seems to trust client inputs or validate them. Check `game.gateway.ts` for authoritative logic.
- **Collision**: Basic boundary collision is implemented. Bullet-tank collision is a potential future enhancement.
- **Performance**: Uses `requestAnimationFrame` on the frontend for the game loop.

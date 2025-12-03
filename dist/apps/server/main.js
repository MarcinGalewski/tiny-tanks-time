/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("@nestjs/common");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("@nestjs/core");

/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppModule = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const app_controller_1 = __webpack_require__(5);
const app_service_1 = __webpack_require__(6);
const game_gateway_1 = __webpack_require__(7);
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService, game_gateway_1.GameGateway],
    })
], AppModule);


/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("tslib");

/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppController = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const app_service_1 = __webpack_require__(6);
let AppController = class AppController {
    constructor(appService) {
        this.appService = appService;
    }
    getData() {
        return this.appService.getData();
    }
};
exports.AppController = AppController;
tslib_1.__decorate([
    (0, common_1.Get)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "getData", null);
exports.AppController = AppController = tslib_1.__decorate([
    (0, common_1.Controller)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof app_service_1.AppService !== "undefined" && app_service_1.AppService) === "function" ? _a : Object])
], AppController);


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppService = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
let AppService = class AppService {
    getData() {
        return ({ message: 'Hello API' });
    }
};
exports.AppService = AppService;
exports.AppService = AppService = tslib_1.__decorate([
    (0, common_1.Injectable)()
], AppService);


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GameGateway = void 0;
const tslib_1 = __webpack_require__(4);
const websockets_1 = __webpack_require__(8);
const socket_io_1 = __webpack_require__(9);
const common_1 = __webpack_require__(1);
let GameGateway = class GameGateway {
    constructor() {
        this.logger = new common_1.Logger('GameGateway');
        this.gameState = {
            players: new Map(),
            bullets: [],
            orbs: [],
        };
        this.colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
        // Map dimensions
        this.MAP_WIDTH = 4000;
        this.MAP_HEIGHT = 4000;
        // Obstacles (server-side for validation)
        this.obstacles = [
            { x: 400, y: 300, width: 120, height: 40 },
            { x: 900, y: 600, width: 60, height: 200 },
            { x: 1400, y: 450, width: 200, height: 60 },
            { x: 700, y: 1100, width: 300, height: 40 },
            // Add more obstacles for larger map if needed
        ];
        // Define Upgrades Registry
        this.ALL_UPGRADES = [
            { id: 'titan_hull_1', name: 'Titan Hull I', description: '+20% Max HP', rarity: 'Common', apply: p => { p.stats.maxHp *= 1.2; p.hp = p.stats.maxHp; } },
            { id: 'rapid_fire_1', name: 'Rapid Fire I', description: '+10% Fire Rate', rarity: 'Common', apply: p => { p.stats.fireRate *= 0.9; } },
            { id: 'swiftness_1', name: 'Swiftness I', description: '+10% Move Speed', rarity: 'Common', apply: p => { p.stats.moveSpeed *= 1.1; } },
            { id: 'high_caliber_1', name: 'High Caliber I', description: '+10% Damage', rarity: 'Common', apply: p => { p.stats.bulletDamage *= 1.1; } },
            { id: 'magnetism_1', name: 'Magnetism I', description: '+20% Pickup Range', rarity: 'Common', apply: p => { p.stats.pickupRange *= 1.2; } },
            { id: 'titan_hull_2', name: 'Titan Hull II', description: '+40% Max HP', rarity: 'Rare', apply: p => { p.stats.maxHp *= 1.4; p.hp = p.stats.maxHp; } },
            { id: 'rapid_fire_2', name: 'Rapid Fire II', description: '+20% Fire Rate', rarity: 'Rare', apply: p => { p.stats.fireRate *= 0.8; } },
            { id: 'double_barrel_1', name: 'Double Barrel', description: '+1 Bullet', rarity: 'Rare', apply: p => { p.stats.bulletCount += 1; } },
            { id: 'titan_hull_3', name: 'Titan Hull III', description: '+60% Max HP', rarity: 'Epic', apply: p => { p.stats.maxHp *= 1.6; p.hp = p.stats.maxHp; } },
            { id: 'rear_guard', name: 'Rear Guard', description: 'Back Cannon', rarity: 'Epic', apply: p => { p.stats.rearGuard = true; } },
            { id: 'titan_hull_4', name: 'Titan Hull IV', description: '+100% Max HP', rarity: 'Legendary', apply: p => { p.stats.maxHp *= 2.0; p.hp = p.stats.maxHp; } },
        ];
        // Initial orb spawn
        for (let i = 0; i < 50; i++) {
            this.spawnOrb();
        }
    }
    spawnOrb() {
        const orb = {
            id: `orb-${Date.now()}-${Math.random()}`,
            x: Math.random() * (this.MAP_WIDTH - 100) + 50,
            y: Math.random() * (this.MAP_HEIGHT - 100) + 50,
            value: 20
        };
        // Simple check to avoid spawning inside obstacles
        if (!this.checkCollision(orb.x, orb.y, 10)) {
            this.gameState.orbs.push(orb);
            // We might not have the server instance ready in constructor, 
            // but for subsequent spawns we will.
            if (this.server) {
                this.server.emit('orbSpawned', orb);
            }
        }
        else {
            // Retry
            this.spawnOrb();
        }
    }
    checkCollision(x, y, radius) {
        // Check map boundaries
        if (x < radius || x > this.MAP_WIDTH - radius || y < radius || y > this.MAP_HEIGHT - radius) {
            return true;
        }
        // Check obstacles
        for (const obs of this.obstacles) {
            // Simple AABB vs Circle collision check (approximated)
            const closestX = Math.max(obs.x, Math.min(x, obs.x + obs.width));
            const closestY = Math.max(obs.y, Math.min(y, obs.y + obs.height));
            const distanceX = x - closestX;
            const distanceY = y - closestY;
            const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
            if (distanceSquared < (radius * radius)) {
                return true;
            }
        }
        return false;
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
        // Create a new player
        const player = {
            id: client.id,
            x: Math.random() * 3800 + 100, // Random position in larger map
            y: Math.random() * 3800 + 100,
            angle: 0,
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            hp: 100,
            maxHp: 100,
            exp: 0,
            level: 1,
            maxExp: 100,
            stats: {
                maxHp: 100,
                fireRate: 300, // ms cooldown
                bulletCount: 1,
                bulletDamage: 10,
                bulletSpeed: 360,
                moveSpeed: 240,
                pickupRange: 35, // tankRadius + orbRadius
                rearGuard: false
            },
            immuneUntil: 0,
            pendingLevelUp: false
        };
        this.gameState.players.set(client.id, player);
        // Send current game state to the new player
        client.emit('gameState', {
            players: Array.from(this.gameState.players.values()),
            bullets: this.gameState.bullets,
            orbs: this.gameState.orbs,
        });
        // Notify all other players about the new player
        client.broadcast.emit('playerJoined', player);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
        // Remove player from game state
        this.gameState.players.delete(client.id);
        // Remove player's bullets
        this.gameState.bullets = this.gameState.bullets.filter(bullet => bullet.playerId !== client.id);
        // Notify all other players
        this.server.emit('playerLeft', client.id);
    }
    handlePlayerMove(data, client) {
        const player = this.gameState.players.get(client.id);
        if (player) {
            // Validate movement with collision check
            // Assuming tank radius is approx 20
            if (!this.checkCollision(data.x, data.y, 20)) {
                player.x = data.x;
                player.y = data.y;
            }
            // Always update angle
            player.angle = data.angle;
            // Check for orb collection
            this.gameState.orbs = this.gameState.orbs.filter(orb => {
                const dx = player.x - orb.x;
                const dy = player.y - orb.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < player.stats.pickupRange) {
                    // Collected!
                    player.exp += orb.value;
                    if (player.exp >= player.maxExp && !player.pendingLevelUp) {
                        player.pendingLevelUp = true;
                        this.sendLevelUpOptions(client);
                    }
                    this.server.emit('orbCollected', orb.id);
                    this.server.emit('playerExpUpdate', {
                        id: player.id,
                        exp: player.exp,
                        maxExp: player.maxExp,
                        level: player.level,
                        hp: player.hp,
                        maxHp: player.maxHp
                    });
                    // Spawn new orb
                    setTimeout(() => this.spawnOrb(), 1000);
                    return false; // Remove from array
                }
                return true;
            });
            // Broadcast updated position to all other players
            client.broadcast.emit('playerMoved', {
                id: client.id,
                x: player.x,
                y: player.y,
                angle: player.angle,
                hp: player.hp,
                maxHp: player.maxHp,
                exp: player.exp,
                level: player.level,
                maxExp: player.maxExp
            });
        }
    }
    handleShoot(data, client) {
        const shooter = this.gameState.players.get(client.id);
        if (!shooter)
            return;
        const bullet = {
            id: `${client.id}-${Date.now()}`,
            x: data.x,
            y: data.y,
            angle: data.angle,
            playerId: client.id,
        };
        this.gameState.bullets.push(bullet);
        this.server.emit('bulletShot', bullet);
        // Server-side bullet simulation for hit detection
        const bulletSpeed = 360; // px/sec
        const bulletRadius = 5;
        const tankRadius = 20;
        let active = true;
        const interval = setInterval(() => {
            if (!active) {
                clearInterval(interval);
                return;
            }
            // Move bullet (simplified step)
            const dt = 0.05; // 50ms check
            bullet.x += Math.cos(bullet.angle) * bulletSpeed * dt;
            bullet.y += Math.sin(bullet.angle) * bulletSpeed * dt;
            // Check collision with players
            for (const [id, player] of this.gameState.players) {
                if (id === bullet.playerId)
                    continue; // Don't hit self
                const dx = player.x - bullet.x;
                const dy = player.y - bullet.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < tankRadius + bulletRadius) {
                    // Check immunity
                    if (player.immuneUntil > Date.now()) {
                        // Immune!
                        this.removeBullet(bullet.id);
                        active = false;
                        break;
                    }
                    // Hit!
                    player.hp -= 10; // Use bullet damage from shooter stats later?
                    if (player.hp <= 0) {
                        // Player died
                        player.hp = player.maxHp;
                        player.x = Math.random() * 3800 + 100;
                        player.y = Math.random() * 3800 + 100;
                        // Give EXP to shooter
                        shooter.exp += 50;
                        if (shooter.exp >= shooter.maxExp && !shooter.pendingLevelUp) {
                            shooter.pendingLevelUp = true;
                            const shooterSocket = this.server.sockets.sockets.get(shooter.id);
                            if (shooterSocket) {
                                this.sendLevelUpOptions(shooterSocket);
                            }
                        }
                    }
                    // Broadcast updates
                    this.server.emit('playerHit', {
                        id: player.id,
                        hp: player.hp,
                        maxHp: player.maxHp,
                        x: player.x,
                        y: player.y
                    });
                    this.server.emit('playerExpUpdate', {
                        id: shooter.id,
                        exp: shooter.exp,
                        maxExp: shooter.maxExp,
                        level: shooter.level,
                        hp: shooter.hp,
                        maxHp: shooter.maxHp
                    });
                    // Remove bullet
                    this.removeBullet(bullet.id);
                    active = false;
                    break;
                }
            }
            // Check obstacles
            if (this.checkCollision(bullet.x, bullet.y, bulletRadius)) {
                this.removeBullet(bullet.id);
                active = false;
            }
        }, 50);
        // Cleanup after 3 seconds if no hit
        setTimeout(() => {
            if (active) {
                this.removeBullet(bullet.id);
                active = false;
            }
        }, 3000);
    }
    removeBullet(bulletId) {
        this.gameState.bullets = this.gameState.bullets.filter(b => b.id !== bulletId);
        this.server.emit('bulletRemoved', bulletId);
    }
    sendLevelUpOptions(client) {
        const options = this.generateUpgrades(3);
        // Map to DTO to avoid sending function
        const optionsDto = options.map(u => ({
            id: u.id,
            name: u.name,
            description: u.description,
            rarity: u.rarity
        }));
        // Grant immunity
        const player = this.gameState.players.get(client.id);
        if (player) {
            player.immuneUntil = Date.now() + 10000;
            this.server.emit('playerImmunity', { id: player.id, immuneUntil: player.immuneUntil });
        }
        client.emit('levelUpOptions', optionsDto);
    }
    handleSelectUpgrade(upgradeId, client) {
        const player = this.gameState.players.get(client.id);
        if (!player || !player.pendingLevelUp)
            return;
        // Find the upgrade definition (simplified: we regenerate or store? 
        // For simplicity, we'll assume the ID contains enough info or we look it up from a static list.
        // Better: look up from a static registry of all upgrades)
        const upgrade = this.ALL_UPGRADES.find(u => u.id === upgradeId); // We need to define ALL_UPGRADES
        if (upgrade) {
            upgrade.apply(player);
        }
        // Level up processing
        player.level++;
        player.exp -= player.maxExp;
        player.maxExp = Math.floor(player.maxExp * 1.2);
        player.hp = player.stats.maxHp; // Heal to full on level up? Or just add maxHp increase? Plan said heal.
        player.pendingLevelUp = false;
        player.immuneUntil = 0; // Remove immunity immediately
        this.server.emit('playerExpUpdate', {
            id: player.id,
            exp: player.exp,
            maxExp: player.maxExp,
            level: player.level,
            hp: player.hp,
            maxHp: player.stats.maxHp
        });
        this.server.emit('playerImmunity', { id: player.id, immuneUntil: 0 });
    }
    generateUpgrades(count) {
        const options = [];
        for (let i = 0; i < count; i++) {
            const rand = Math.random();
            let rarity = 'Common';
            if (rand > 0.95)
                rarity = 'Legendary';
            else if (rand > 0.85)
                rarity = 'Epic';
            else if (rand > 0.60)
                rarity = 'Rare';
            const pool = this.ALL_UPGRADES.filter(u => u.rarity === rarity);
            if (pool.length > 0) {
                options.push(pool[Math.floor(Math.random() * pool.length)]);
            }
            else {
                // Fallback to common
                const commonPool = this.ALL_UPGRADES.filter(u => u.rarity === 'Common');
                options.push(commonPool[Math.floor(Math.random() * commonPool.length)]);
            }
        }
        return options;
    }
};
exports.GameGateway = GameGateway;
tslib_1.__decorate([
    (0, websockets_1.WebSocketServer)(),
    tslib_1.__metadata("design:type", typeof (_a = typeof socket_io_1.Server !== "undefined" && socket_io_1.Server) === "function" ? _a : Object)
], GameGateway.prototype, "server", void 0);
tslib_1.__decorate([
    (0, websockets_1.SubscribeMessage)('playerMove'),
    tslib_1.__param(0, (0, websockets_1.MessageBody)()),
    tslib_1.__param(1, (0, websockets_1.ConnectedSocket)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object, typeof (_b = typeof socket_io_1.Socket !== "undefined" && socket_io_1.Socket) === "function" ? _b : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePlayerMove", null);
tslib_1.__decorate([
    (0, websockets_1.SubscribeMessage)('shoot'),
    tslib_1.__param(0, (0, websockets_1.MessageBody)()),
    tslib_1.__param(1, (0, websockets_1.ConnectedSocket)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object, typeof (_c = typeof socket_io_1.Socket !== "undefined" && socket_io_1.Socket) === "function" ? _c : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], GameGateway.prototype, "handleShoot", null);
tslib_1.__decorate([
    (0, websockets_1.SubscribeMessage)('selectUpgrade'),
    tslib_1.__param(0, (0, websockets_1.MessageBody)()),
    tslib_1.__param(1, (0, websockets_1.ConnectedSocket)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, typeof (_d = typeof socket_io_1.Socket !== "undefined" && socket_io_1.Socket) === "function" ? _d : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], GameGateway.prototype, "handleSelectUpgrade", null);
exports.GameGateway = GameGateway = tslib_1.__decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.CLIENT_ORIGIN || '*',
            methods: ['GET', 'POST'],
            credentials: false,
        },
        transports: ['websocket'],
        path: '/socket.io/',
    }),
    tslib_1.__metadata("design:paramtypes", [])
], GameGateway);


/***/ }),
/* 8 */
/***/ ((module) => {

module.exports = require("@nestjs/websockets");

/***/ }),
/* 9 */
/***/ ((module) => {

module.exports = require("socket.io");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
const common_1 = __webpack_require__(1);
const core_1 = __webpack_require__(2);
const app_module_1 = __webpack_require__(3);
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // Set "api" prefix for REST routes (optional, can remove if not needed)
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    // Allow CORS for production hosts
    // IMPORTANT: change '*' to your frontend domain when deployed
    app.enableCors({
        origin: process.env.CLIENT_ORIGIN || '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    // Cloud hosts (Render, Fly.io) inject PORT as a string
    const port = Number(process.env.PORT) || 3000;
    await app.listen(port, '0.0.0.0');
    common_1.Logger.log(`🚀 Server listening on port ${port}`);
    common_1.Logger.log(`🌐 REST API prefix: /${globalPrefix}`);
    common_1.Logger.log(`🎮 WebSocket ready at ws://<your-domain>:${port}`);
}
bootstrap();

})();

/******/ })()
;
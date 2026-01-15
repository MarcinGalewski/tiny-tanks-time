import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface Player {
  id: string;
  x: number;
  y: number;
  angle: number;
  color: string;
  hp: number;
  maxHp: number;
  exp: number;
  level: number;
  maxExp: number;
  stats: PlayerStats;
  immuneUntil: number;
  pendingLevelUp: boolean;
  upgrades: Upgrade[];
  isBot?: boolean;
}

export interface PlayerStats {
  maxHp: number;
  fireRate: number; // ms cooldown
  bulletCount: number;
  bulletDamage: number;
  bulletSpeed: number;
  moveSpeed: number;
  pickupRange: number;
  rearGuard: boolean;
  bulletLifeTime: number; // ms
  spreadAngle: number; // degrees
  regenRate: number; // hp per sec
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  prerequisite?: string;
  apply: (player: Player) => void;
}

export interface Orb {
  id: string;
  x: number;
  y: number;
  value: number;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  size: number;
  damage: number;
  expValue: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  angle: number;
  playerId: string;
  damage: number;
}

export interface GameState {
  players: Map<string, Player>;
  bullets: Bullet[];
  orbs: Orb[];
  enemies: Enemy[];
}

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: false,
  },
  transports: ['websocket'],
  path: '/socket.io/',
})

export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('GameGateway');
  private gameState: GameState = {
    players: new Map(),
    bullets: [],
    orbs: [],
    enemies: [],
  };

  private colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];

  constructor() {
    for (let i = 0; i < 50; i++) {
      this.spawnOrb();
    }

    // Regeneration Loop
    setInterval(() => {
      for (const player of this.gameState.players.values()) {
        if (player.stats.regenRate > 0 && player.hp < player.maxHp) {
          player.hp = Math.min(player.hp + (player.stats.regenRate / 1), player.maxHp); // Simplified: check every 1s
          if (this.server && player.hp > 0) {
            this.server.emit('playerHit', {
              id: player.id,
              hp: player.hp,
              maxHp: player.maxHp,
              x: player.x,
              y: player.y
            });
          }
        }
      }
    }, 1000);

    // Enemy Spawning Loop
    setInterval(() => {
      if (this.gameState.enemies.length < 50) {
        this.spawnEnemy();
      }
    }, 2000);

    // Enemy AI & Physics Loop
    setInterval(() => {
      this.updateEnemies();
    }, 50);

    // Bot Update Loop
    setInterval(() => this.updateBots(), 50);

    // Initial bots
    setTimeout(() => {
      for (let i = 0; i < this.BOT_COUNT; i++) {
        this.spawnBot();
      }
    }, 2000);
  }

  private spawnEnemy() {
    const x = Math.random() * (this.MAP_WIDTH - 100) + 50;
    const y = Math.random() * (this.MAP_HEIGHT - 100) + 50;

    if (this.checkCollision(x, y, 20)) return;

    const baseHp = 30;
    const baseExp = 15;

    const enemy: Enemy = {
      id: `enemy-${Date.now()}-${Math.random()}`,
      x,
      y,
      hp: baseHp,
      maxHp: baseHp,
      speed: 100 + Math.random() * 50,
      size: 20,
      damage: 10,
      expValue: baseExp
    };

    this.gameState.enemies.push(enemy);
    if (this.server) this.server.emit('enemySpawned', enemy);
  }

  private updateEnemies() {
    const dt = 0.05;
    this.gameState.enemies.forEach(enemy => {
      let target: Player | null = null;
      let minDist = 999999;

      for (const player of this.gameState.players.values()) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          target = player;
        }
      }

      if (target && target.hp > 0) {
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        if (minDist > 1) {
          const moveX = (dx / minDist) * enemy.speed * dt;
          const moveY = (dy / minDist) * enemy.speed * dt;

          if (!this.checkCollision(enemy.x + moveX, enemy.y + moveY, enemy.size)) {
            enemy.x += moveX;
            enemy.y += moveY;
          }

          if (minDist < (enemy.size + 20)) {
            target.hp -= 1;
            if (target.hp <= 0) {
              target.hp = 0;
              if (!target.isBot) {
                this.server.to(target.id).emit('playerDied');
              } else {
                // Bots respawn automatically in respawnPlayer or simplified
                this.respawnPlayer(target);
              }
            } else {
              if (this.server) {
                this.server.emit('playerHit', {
                  id: target.id,
                  hp: target.hp,
                  maxHp: target.maxHp,
                  x: target.x,
                  y: target.y
                });
              }
            }
          }
        }
      }
    });

    if (this.server && this.gameState.enemies.length > 0) {
      this.server.emit('enemiesMoved', this.gameState.enemies);
    }
  }

  private respawnPlayer(player: Player) {
    // Reset level, exp, and upgrades
    player.level = 1;
    player.exp = 0;
    player.maxExp = 100;
    player.upgrades = [];
    player.pendingLevelUp = false;

    // Reset stats to defaults
    player.stats = {
      maxHp: 100,
      fireRate: player.isBot ? 800 : 300,
      bulletCount: 1,
      bulletDamage: player.isBot ? 8 : 10,
      bulletSpeed: player.isBot ? 300 : 360,
      moveSpeed: player.isBot ? 150 : 240,
      pickupRange: 35,
      rearGuard: false,
      bulletLifeTime: 3000,
      spreadAngle: 0,
      regenRate: player.isBot ? 1 : 0
    };

    // Reset HP to new maxHp
    player.maxHp = player.stats.maxHp;
    player.hp = player.maxHp;

    // Respawn at random position
    player.x = Math.random() * 3800 + 100;
    player.y = Math.random() * 3800 + 100;
    player.immuneUntil = Date.now() + 3000;

    if (this.server) {
      this.server.emit('playerHit', {
        id: player.id,
        hp: player.hp,
        maxHp: player.maxHp,
        x: player.x,
        y: player.y
      });
      this.server.emit('playerMoved', { ...player });
      this.server.emit('playerImmunity', { id: player.id, immuneUntil: player.immuneUntil });
      this.server.emit('playerExpUpdate', {
        id: player.id,
        exp: player.exp,
        maxExp: player.maxExp,
        level: player.level,
        hp: player.hp,
        maxHp: player.maxHp,
        stats: player.stats,
        upgrades: player.upgrades
      });
    }
  }

  private spawnOrb() {
    const orb: Orb = {
      id: `orb-${Date.now()}-${Math.random()}`,
      x: Math.random() * (this.MAP_WIDTH - 100) + 50,
      y: Math.random() * (this.MAP_HEIGHT - 100) + 50,
      value: 20
    };

    if (!this.checkCollision(orb.x, orb.y, 10)) {
      this.gameState.orbs.push(orb);
      if (this.server) {
        this.server.emit('orbSpawned', orb);
      }
    } else {
      setTimeout(() => this.spawnOrb(), 0);
    }
  }

  private readonly MAP_WIDTH = 4000;
  private readonly MAP_HEIGHT = 4000;
  private readonly BOT_COUNT = 8;
  private botShotCooldowns: Map<string, number> = new Map();

  private obstacles: Array<{ x: number; y: number; width: number; height: number }> = [
    { x: 400, y: 300, width: 120, height: 40 },
    { x: 900, y: 600, width: 60, height: 200 },
    { x: 1400, y: 450, width: 200, height: 60 },
    { x: 700, y: 1100, width: 300, height: 40 },
  ];

  private checkCollision(x: number, y: number, radius: number): boolean {
    if (x < radius || x > this.MAP_WIDTH - radius || y < radius || y > this.MAP_HEIGHT - radius) {
      return true;
    }

    for (const obs of this.obstacles) {
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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    const player: Player = {
      id: client.id,
      x: Math.random() * 3800 + 100,
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
        fireRate: 300,
        bulletCount: 1,
        bulletDamage: 10,
        bulletSpeed: 360,
        moveSpeed: 240,
        pickupRange: 35,
        rearGuard: false,
        bulletLifeTime: 3000,
        spreadAngle: 0,
        regenRate: 0
      },
      immuneUntil: 0,
      pendingLevelUp: false,
      upgrades: [],
      isBot: false
    };

    this.gameState.players.set(client.id, player);

    client.emit('gameState', {
      players: Array.from(this.gameState.players.values()),
      bullets: this.gameState.bullets,
      orbs: this.gameState.orbs,
      enemies: this.gameState.enemies
    });

    client.broadcast.emit('playerJoined', player);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.gameState.players.delete(client.id);
    this.gameState.bullets = this.gameState.bullets.filter(
      bullet => bullet.playerId !== client.id
    );
    this.server.emit('playerLeft', client.id);
  }

  @SubscribeMessage('respawn')
  handleRespawn(@ConnectedSocket() client: Socket) {
    const player = this.gameState.players.get(client.id);
    if (player && player.hp <= 0) {
      this.respawnPlayer(player);
    }
  }

  @SubscribeMessage('playerMove')
  handlePlayerMove(
    @MessageBody() data: { x: number; y: number; angle: number },
    @ConnectedSocket() client: Socket,
  ) {
    const player = this.gameState.players.get(client.id);
    if (player && player.hp > 0) {
      if (!this.checkCollision(data.x, data.y, 20)) {
        player.x = data.x;
        player.y = data.y;
      }
      player.angle = data.angle;

      this.gameState.orbs = this.gameState.orbs.filter(orb => {
        const dx = player.x - orb.x;
        const dy = player.y - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.stats.pickupRange) {
          player.exp += orb.value;
          this.checkLevelUp(player);
          this.server.emit('orbCollected', orb.id);
          this.server.emit('playerExpUpdate', {
            id: player.id,
            exp: player.exp,
            maxExp: player.maxExp,
            level: player.level,
            hp: player.hp,
            maxHp: player.maxHp
          });
          setTimeout(() => this.spawnOrb(), 1000);
          return false;
        }
        return true;
      });

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

  @SubscribeMessage('shoot')
  handleShoot(
    @MessageBody() data: { x: number; y: number; angle: number },
    @ConnectedSocket() client: Socket,
  ) {
    const shooter = this.gameState.players.get(client.id);
    if (!shooter || shooter.hp <= 0) return;
    this.spawnBulletMerged(shooter, data.x, data.y, data.angle);
  }

  private spawnBulletMerged(shooter: Player, x: number, y: number, angle: number) {
    const damage = shooter.stats.bulletDamage;
    const count = shooter.stats.bulletCount;
    const spread = shooter.stats.spreadAngle * (Math.PI / 180);

    let startAngle = angle;
    let stepAngle = 0;

    if (count > 1) {
      startAngle = angle - spread / 2;
      stepAngle = spread / (count - 1);
    }

    for (let i = 0; i < count; i++) {
      const currentAngle = (count === 1) ? startAngle : startAngle + (stepAngle * i);
      const bullet: Bullet = {
        id: `${shooter.id}-${Date.now()}-${i}-${Math.random()}`,
        x: x,
        y: y,
        angle: currentAngle,
        playerId: shooter.id,
        damage: damage
      };
      this.gameState.bullets.push(bullet);
      this.server.emit('bulletShot', bullet);
      this.simulateBulletMerged(bullet, shooter);
    }

    if (shooter.stats.rearGuard) {
      const rearAngle = angle + Math.PI;
      const offset = 40;
      const rearX = x - Math.cos(angle) * (offset * 2);
      const rearY = y - Math.sin(angle) * (offset * 2);

      const rearBullet: Bullet = {
        id: `${shooter.id}-rear-${Date.now()}-${Math.random()}`,
        x: rearX,
        y: rearY,
        angle: rearAngle,
        playerId: shooter.id,
        damage: damage
      };
      this.gameState.bullets.push(rearBullet);
      this.server.emit('bulletShot', rearBullet);
      this.simulateBulletMerged(rearBullet, shooter);
    }
  }

  private simulateBulletMerged(bullet: Bullet, shooter: Player) {
    const bulletSpeed = shooter.stats.bulletSpeed;
    const lifeTime = shooter.stats.bulletLifeTime;
    const bulletRadius = 5;
    const tankRadius = 20;
    let active = true;

    const interval = setInterval(() => {
      if (!active) {
        clearInterval(interval);
        return;
      }

      const dt = 0.05;
      bullet.x += Math.cos(bullet.angle) * bulletSpeed * dt;
      bullet.y += Math.sin(bullet.angle) * bulletSpeed * dt;

      // Hit players
      for (const [id, player] of this.gameState.players) {
        if (id === bullet.playerId || player.hp <= 0) continue;

        const dx = player.x - bullet.x;
        const dy = player.y - bullet.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < tankRadius + bulletRadius) {
          if (player.immuneUntil > Date.now()) {
            this.removeBullet(bullet.id);
            active = false;
            break;
          }

          player.hp -= bullet.damage;
          if (player.hp <= 0) {
            player.hp = 0;
            if (player.isBot) {
              this.respawnPlayer(player);
            } else {
              this.server.to(player.id).emit('playerDied');
            }
            shooter.exp += 50;
            this.checkLevelUp(shooter);
          }

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

          this.removeBullet(bullet.id);
          active = false;
          break;
        }
      }

      if (!active) return;

      // Hit Enemies
      for (let i = 0; i < this.gameState.enemies.length; i++) {
        const enemy = this.gameState.enemies[i];
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < enemy.size + bulletRadius) {
          enemy.hp -= bullet.damage;
          if (enemy.hp <= 0) {
            shooter.exp += enemy.expValue;
            this.checkLevelUp(shooter);
            this.gameState.enemies.splice(i, 1);
            this.server.emit('enemyDied', enemy.id);

            const orb: Orb = {
              id: `orb-${Date.now()}-${Math.random()}`,
              x: enemy.x,
              y: enemy.y,
              value: 10
            };
            this.gameState.orbs.push(orb);
            this.server.emit('orbSpawned', orb);

            this.server.emit('playerExpUpdate', {
              id: shooter.id,
              exp: shooter.exp,
              maxExp: shooter.maxExp,
              level: shooter.level,
              hp: shooter.hp,
              maxHp: shooter.maxHp
            });
          }
          this.removeBullet(bullet.id);
          active = false;
          break;
        }
      }

      if (active && this.checkCollision(bullet.x, bullet.y, bulletRadius)) {
        this.removeBullet(bullet.id);
        active = false;
      }
    }, 50);

    setTimeout(() => {
      if (active) {
        this.removeBullet(bullet.id);
        active = false;
      }
    }, lifeTime);
  }

  private removeBullet(bulletId: string) {
    this.gameState.bullets = this.gameState.bullets.filter(b => b.id !== bulletId);
    this.server.emit('bulletRemoved', bulletId);
  }

  private sendLevelUpOptions(client: Socket) {
    const player = this.gameState.players.get(client.id);
    if (!player) return;

    const options = this.generateUpgrades(3, player);
    const optionsDto = options.map(u => ({
      id: u.id,
      name: u.name,
      description: u.description,
      rarity: u.rarity
    }));

    player.immuneUntil = Date.now() + 10000;
    this.server.emit('playerImmunity', { id: player.id, immuneUntil: player.immuneUntil });
    client.emit('levelUpOptions', optionsDto);
  }

  @SubscribeMessage('selectUpgrade')
  handleSelectUpgrade(
    @MessageBody() upgradeId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const player = this.gameState.players.get(client.id);
    if (!player || !player.pendingLevelUp) return;

    const upgrade = this.ALL_UPGRADES.find(u => u.id === upgradeId);
    if (upgrade) {
      upgrade.apply(player);
      player.upgrades.push(upgrade);
    }

    player.level++;
    player.exp = Math.max(0, player.exp - player.maxExp);
    player.maxExp = Math.floor(player.maxExp * 1.2);
    player.hp = player.stats.maxHp;
    player.maxHp = player.stats.maxHp;

    player.pendingLevelUp = false;
    player.immuneUntil = 0;

    this.server.emit('playerExpUpdate', {
      id: player.id,
      exp: player.exp,
      maxExp: player.maxExp,
      level: player.level,
      hp: player.hp,
      maxHp: player.stats.maxHp,
      stats: player.stats,
      upgrades: player.upgrades
    });

    this.server.emit('playerImmunity', { id: player.id, immuneUntil: 0 });
  }

  @SubscribeMessage('debugLevelUp')
  handleDebugLevelUp(@ConnectedSocket() client: Socket) {
    const player = this.gameState.players.get(client.id);
    if (!player) return;
    player.exp = player.maxExp;
    this.checkLevelUp(player);
  }

  private ALL_UPGRADES: Upgrade[] = [
    { id: 'titan_hull_1', name: 'Titan Hull I', description: '+20% Max HP', rarity: 'Common', apply: p => { p.stats.maxHp *= 1.2; p.hp = p.stats.maxHp; } },
    { id: 'rapid_fire_1', name: 'Rapid Fire I', description: '+10% Fire Rate', rarity: 'Common', apply: p => { p.stats.fireRate *= 0.9; } },
    { id: 'swiftness_1', name: 'Swiftness I', description: '+10% Move Speed', rarity: 'Common', apply: p => { p.stats.moveSpeed *= 1.1; } },
    { id: 'high_caliber_1', name: 'High Caliber I', description: '+10% Damage', rarity: 'Common', apply: p => { p.stats.bulletDamage *= 1.1; } },
    { id: 'magnetism_1', name: 'Magnetism I', description: '+20% Pickup Range', rarity: 'Common', apply: p => { p.stats.pickupRange *= 1.2; } },

    { id: 'titan_hull_2', name: 'Titan Hull II', description: '+40% Max HP', rarity: 'Rare', prerequisite: 'titan_hull_1', apply: p => { p.stats.maxHp *= 1.4; p.hp = p.stats.maxHp; } },
    { id: 'rapid_fire_2', name: 'Rapid Fire II', description: '+20% Fire Rate', rarity: 'Rare', prerequisite: 'rapid_fire_1', apply: p => { p.stats.fireRate *= 0.8; } },
    { id: 'double_barrel_1', name: 'Double Barrel', description: '+1 Bullet', rarity: 'Rare', apply: p => { p.stats.bulletCount += 1; if (p.stats.spreadAngle < 15) p.stats.spreadAngle = 15; } },

    { id: 'titan_hull_3', name: 'Titan Hull III', description: '+60% Max HP', rarity: 'Epic', prerequisite: 'titan_hull_2', apply: p => { p.stats.maxHp *= 1.6; p.hp = p.stats.maxHp; } },
    { id: 'rear_guard', name: 'Rear Guard', description: 'Back Cannon', rarity: 'Epic', apply: p => { p.stats.rearGuard = true; } },

    { id: 'titan_hull_4', name: 'Titan Hull IV', description: '+100% Max HP', rarity: 'Legendary', prerequisite: 'titan_hull_3', apply: p => { p.stats.maxHp *= 2.0; p.hp = p.stats.maxHp; } },

    { id: 'velocity_1', name: 'Velocity I', description: '+20% Bullet Speed', rarity: 'Common', apply: p => { p.stats.bulletSpeed *= 1.2; } },
    { id: 'velocity_2', name: 'Velocity II', description: '+30% Bullet Speed', rarity: 'Rare', prerequisite: 'velocity_1', apply: p => { p.stats.bulletSpeed *= 1.3; } },

    { id: 'sniper_1', name: 'Sniper Scope', description: '+50% Range', rarity: 'Rare', apply: p => { p.stats.bulletLifeTime *= 1.5; } },

    { id: 'triple_shot', name: 'Triple Shot', description: 'Fire 3 bullets', rarity: 'Legendary', apply: p => { p.stats.bulletCount = 3; if (p.stats.spreadAngle < 30) p.stats.spreadAngle = 30; } },

    { id: 'regen_1', name: 'Regeneration I', description: '+2 HP/sec', rarity: 'Common', apply: p => { p.stats.regenRate += 2; } },
    { id: 'regen_2', name: 'Regeneration II', description: '+5 HP/sec', rarity: 'Rare', prerequisite: 'regen_1', apply: p => { p.stats.regenRate += 5; } },
    { id: 'regen_3', name: 'Regeneration III', description: '+10 HP/sec', rarity: 'Epic', prerequisite: 'regen_2', apply: p => { p.stats.regenRate += 10; } },

    { id: 'heavy_shells', name: 'Heavy Shells', description: '+20% Damage', rarity: 'Rare', apply: p => { p.stats.bulletDamage *= 1.2; } },
    { id: 'turbo_engine', name: 'Turbo Engine', description: '+20% Move Speed', rarity: 'Rare', apply: p => { p.stats.moveSpeed *= 1.2; } },
  ];

  private generateUpgrades(count: number, player: Player): Upgrade[] {
    const available = this.ALL_UPGRADES.filter(u => {
      if (player.upgrades.some(existing => existing.id === u.id)) return false;
      if (u.prerequisite) {
        const hasPrereq = player.upgrades.some(existing => existing.id === u.prerequisite);
        if (!hasPrereq) return false;
      }
      return true;
    });

    const options: Upgrade[] = [];
    for (let i = 0; i < count; i++) {
      if (available.length === 0) break;
      const rand = Math.random();
      let rarity: Upgrade['rarity'] = 'Common';
      if (rand > 0.98) rarity = 'Legendary';
      else if (rand > 0.90) rarity = 'Epic';
      else if (rand > 0.70) rarity = 'Rare';
      else if (rand > 0.50) rarity = 'Uncommon';

      let pool = available.filter(u => u.rarity === rarity);
      if (pool.length === 0) pool = available;

      const selected = pool[Math.floor(Math.random() * pool.length)];
      options.push(selected);
      const idx = available.indexOf(selected);
      if (idx > -1) available.splice(idx, 1);
    }
    return options;
  }

  private checkLevelUp(player: Player) {
    if (player.exp >= player.maxExp && !player.pendingLevelUp) {
      player.pendingLevelUp = true;
      if (!player.isBot) {
        const socket = this.server.sockets.sockets.get(player.id);
        if (socket) {
          this.sendLevelUpOptions(socket);
        }
      } else {
        this.botApplyRandomUpgrade(player);
      }
    }
  }

  private spawnBot() {
    const id = `bot-${Math.random().toString(36).substr(2, 9)}`;
    const bot: Player = {
      id,
      x: Math.random() * (this.MAP_WIDTH - 200) + 100,
      y: Math.random() * (this.MAP_HEIGHT - 200) + 100,
      angle: Math.random() * Math.PI * 2,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      hp: 100,
      maxHp: 100,
      exp: 0,
      level: 1,
      maxExp: 100,
      stats: {
        maxHp: 100,
        fireRate: 800,
        bulletCount: 1,
        bulletDamage: 8,
        bulletSpeed: 300,
        moveSpeed: 150,
        pickupRange: 35,
        rearGuard: false,
        bulletLifeTime: 3000,
        spreadAngle: 0,
        regenRate: 1
      },
      immuneUntil: 0,
      pendingLevelUp: false,
      upgrades: [],
      isBot: true
    };

    if (!this.checkCollision(bot.x, bot.y, 20)) {
      this.gameState.players.set(id, bot);
      this.server.emit('playerJoined', bot);
    } else {
      setTimeout(() => this.spawnBot(), 0);
    }
  }

  private updateBots() {
    const dt = 0.05;
    const players = Array.from(this.gameState.players.values());
    const bots = players.filter(p => p.isBot);

    bots.forEach(bot => {
      if (bot.hp <= 0) return;

      const humans = players.filter(p => !p.isBot && p.hp > 0 && p.immuneUntil < Date.now());
      let target: Player | null = null;
      let minDist = 1000;

      humans.forEach(h => {
        const dx = h.x - bot.x;
        const dy = h.y - bot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          target = h;
        }
      });

      if (target) {
        const dx = target.x - bot.x;
        const dy = target.y - bot.y;
        const angleToTarget = Math.atan2(dy, dx);
        const angleDiff = angleToTarget - bot.angle;
        bot.angle += Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff)) * 0.3;

        if (minDist > 200) {
          const moveX = bot.x + Math.cos(bot.angle) * bot.stats.moveSpeed * dt;
          const moveY = bot.y + Math.sin(bot.angle) * bot.stats.moveSpeed * dt;
          if (!this.checkCollision(moveX, moveY, 20)) {
            bot.x = moveX;
            bot.y = moveY;
          }
        } else if (minDist < 150) {
          const moveX = bot.x - Math.cos(bot.angle) * bot.stats.moveSpeed * dt;
          const moveY = bot.y - Math.sin(bot.angle) * bot.stats.moveSpeed * dt;
          if (!this.checkCollision(moveX, moveY, 20)) {
            bot.x = moveX;
            bot.y = moveY;
          }
        }

        const now = Date.now();
        const lastShot = this.botShotCooldowns.get(bot.id) || 0;
        if (now - lastShot > bot.stats.fireRate) {
          const angleDiff = angleToTarget - bot.angle;
          const absDiff = Math.abs(Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff)));
          if (absDiff < 0.2) {
            this.spawnBulletMerged(bot, bot.x + Math.cos(bot.angle) * 40, bot.y + Math.sin(bot.angle) * 40, bot.angle);
            this.botShotCooldowns.set(bot.id, now);
          }
        }
      } else {
        const orbs = this.gameState.orbs;
        let nearestOrb: Orb | null = null;
        let minOrbDist = 500;

        orbs.forEach(o => {
          const dx = o.x - bot.x;
          const dy = o.y - bot.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minOrbDist) {
            minOrbDist = dist;
            nearestOrb = o;
          }
        });

        if (nearestOrb) {
          const dx = (nearestOrb as Orb).x - bot.x;
          const dy = (nearestOrb as Orb).y - bot.y;
          const angleToOrb = Math.atan2(dy, dx);
          const angleDiff = angleToOrb - bot.angle;
          bot.angle += Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff)) * 0.2;

          const moveX = bot.x + Math.cos(bot.angle) * bot.stats.moveSpeed * dt;
          const moveY = bot.y + Math.sin(bot.angle) * bot.stats.moveSpeed * dt;
          if (!this.checkCollision(moveX, moveY, 20)) {
            bot.x = moveX;
            bot.y = moveY;
          }
        } else {
          bot.angle += (Math.random() - 0.5) * 0.5;
          const moveX = bot.x + Math.cos(bot.angle) * (bot.stats.moveSpeed * 0.5) * dt;
          const moveY = bot.y + Math.sin(bot.angle) * (bot.stats.moveSpeed * 0.5) * dt;
          if (!this.checkCollision(moveX, moveY, 20)) {
            bot.x = moveX;
            bot.y = moveY;
          }
        }
      }

      this.gameState.orbs = this.gameState.orbs.filter(orb => {
        const dx = bot.x - orb.x;
        const dy = bot.y - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < bot.stats.pickupRange) {
          bot.exp += orb.value;
          this.checkLevelUp(bot);
          this.server.emit('orbCollected', orb.id);
          this.server.emit('playerExpUpdate', {
            id: bot.id,
            exp: bot.exp,
            maxExp: bot.maxExp,
            level: bot.level,
            hp: bot.hp,
            maxHp: bot.maxHp
          });
          setTimeout(() => this.spawnOrb(), 1000);
          return false;
        }
        return true;
      });

      this.server.emit('playerMoved', {
        id: bot.id,
        x: bot.x,
        y: bot.y,
        angle: bot.angle,
        hp: bot.hp,
        maxHp: bot.maxHp,
        exp: bot.exp,
        level: bot.level,
        maxExp: bot.maxExp
      });
    });
  }

  private botApplyRandomUpgrade(bot: Player) {
    const options = this.generateUpgrades(1, bot);
    if (options.length > 0) {
      const upgrade = options[0];
      upgrade.apply(bot);
      bot.upgrades.push(upgrade);
    }
    bot.level++;
    bot.exp = 0;
    bot.maxExp = Math.floor(bot.maxExp * 1.2);
    bot.hp = bot.stats.maxHp;
    bot.pendingLevelUp = false;

    this.server.emit('playerExpUpdate', {
      id: bot.id,
      exp: bot.exp,
      maxExp: bot.maxExp,
      level: bot.level,
      hp: bot.hp,
      maxHp: bot.stats.maxHp,
      stats: bot.stats,
      upgrades: bot.upgrades
    });
  }
}

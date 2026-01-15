import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from './game.service';

export interface PlayerStats {
  maxHp: number;
  fireRate: number;
  bulletCount: number;
  bulletDamage: number;
  bulletSpeed: number;
  moveSpeed: number;
  pickupRange: number;
  rearGuard: boolean;
  bulletLifeTime: number;
  spreadAngle: number;
  regenRate: number;
  regen?: number; // legacy/unified
}

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
  immuneUntil?: number;
  stats?: PlayerStats;
  upgrades?: Upgrade[];
  targetX?: number;
  targetY?: number;
  targetAngle?: number;
  shootingUntil?: number;
  isBot?: boolean;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  angle: number;
  playerId: string;
}

export interface Orb {
  id: string;
  x: number;
  y: number;
  value: number;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  size: number;
  hp: number;
  maxHp: number;
}

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit, OnDestroy {
  @ViewChild('gameArea', { static: false }) gameArea?: ElementRef<HTMLDivElement>;

  players: Player[] = [];
  bullets: Bullet[] = [];
  orbs: Orb[] = [];
  enemies: Enemy[] = [];
  currentPlayer: Player | null = null;
  levelUpOptions: Upgrade[] | null = null;
  keys: { [key: string]: boolean } = {};
  gameStarted = false;
  isDead = false;
  private mouseAngle: number | null = null;
  private mousePressed = false;
  private readonly BULLET_SPEED = 360; // px/sec
  private readonly SHOOT_COOLDOWN_MS = 300;
  private lastShotAt = 0;

  private lastFrameTs: number | null = null;

  worldWidth = 4000;
  worldHeight = 4000;
  cameraTransform = '';
  private cameraOffsetX = 0;
  private cameraOffsetY = 0;

  obstacles: Array<{ x: number; y: number; width: number; height: number }> = [
    { x: 400, y: 300, width: 120, height: 40 },
    { x: 900, y: 600, width: 60, height: 200 },
    { x: 1400, y: 450, width: 200, height: 60 },
    { x: 700, y: 1100, width: 300, height: 40 },
  ];

  Math = Math;

  constructor(private gameService: GameService) { }

  ngOnInit() {
    this.gameService.connect();

    this.gameService.onGameState().subscribe((gameState) => {
      this.players = gameState.players;
      this.bullets = gameState.bullets;
      this.orbs = gameState.orbs || [];
      this.currentPlayer = this.players.find(p => p.id === this.gameService.getPlayerId()) || null;
    });

    this.gameService.onPlayerJoined().subscribe((player) => {
      if (player) {
        this.players.push(player);
      }
    });

    this.gameService.onPlayerLeft().subscribe((playerId) => {
      this.players = this.players.filter(p => p.id !== playerId);
    });

    this.gameService.onPlayerMoved().subscribe((playerData) => {
      if (!playerData) return;
      if (playerData.id === this.currentPlayer?.id) return;

      const player = this.players.find(p => p.id === playerData.id);
      if (player) {
        player.targetX = playerData.x;
        player.targetY = playerData.y;
        player.targetAngle = playerData.angle;

        const dx = player.x - (player.targetX || player.x);
        const dy = player.y - (player.targetY || player.y);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!player.targetX || dist > 200) {
          player.x = playerData.x;
          player.y = playerData.y;
          player.angle = playerData.angle;
        }

        player.hp = playerData.hp;
        player.maxHp = playerData.maxHp;
        player.exp = playerData.exp;
        player.level = playerData.level;
        player.maxExp = playerData.maxExp;
        if (playerData.stats) player.stats = playerData.stats;
      }
    });

    this.gameService.onBulletShot().subscribe((bullet) => {
      if (bullet) {
        this.bullets.push(bullet);
        const player = this.players.find(p => p.id === bullet.playerId);
        if (player) {
          player.shootingUntil = Date.now() + 60; // 60ms flash
        }
      }
    });

    this.gameService.onBulletRemoved().subscribe((bulletId) => {
      this.bullets = this.bullets.filter(b => b.id !== bulletId);
    });

    this.gameService.onOrbSpawned().subscribe((orb) => {
      if (orb) {
        this.orbs.push(orb);
      }
    });

    this.gameService.onOrbCollected().subscribe((orbId) => {
      this.orbs = this.orbs.filter(o => o.id !== orbId);
    });

    this.gameService.onEnemySpawned().subscribe((enemy) => {
      if (enemy) this.enemies.push(enemy);
    });

    this.gameService.onEnemiesMoved().subscribe((enemies) => {
      if (enemies) {
        this.enemies = enemies;
      }
    });

    this.gameService.onEnemyDied().subscribe((id) => {
      this.enemies = this.enemies.filter(e => e.id !== id);
    });

    this.gameService.onLevelUpOptions().subscribe((options) => {
      this.levelUpOptions = options;
    });

    this.gameService.onPlayerExpUpdate().subscribe((data) => {
      if (!data) return;
      const player = this.players.find(p => p.id === data.id);
      if (player) {
        player.exp = data.exp;
        player.maxExp = data.maxExp;
        player.level = data.level;
        player.hp = data.hp;
        player.maxHp = data.maxHp;
        if (data.stats) {
          player.stats = data.stats;
        }
        if (data.upgrades) {
          player.upgrades = data.upgrades;
        }
      }
    });

    this.gameService.onPlayerImmunity().subscribe((data) => {
      if (data) {
        const p = this.players.find(pl => pl.id === data.id);
        if (p) {
          p.immuneUntil = data.immuneUntil;
        }
      }
    });

    this.gameService.onPlayerDied().subscribe(() => {
      this.isDead = true;
    });

    this.gameService.getSocket().on('playerHit', (data: Player) => {
      const p = this.players.find(pl => pl.id === data.id);
      if (p) {
        p.hp = data.hp;
        p.maxHp = data.maxHp;
        if (data.x !== undefined) p.x = data.x;
        if (data.y !== undefined) p.y = data.y;
      }
    });

    this.startGameLoop();
  }

  ngOnDestroy() {
    this.gameService.disconnect();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    const k = event.key.toLowerCase();
    this.keys[k] = true;

    if (this.levelUpOptions) {
      if (k === '1' && this.levelUpOptions[0]) {
        this.selectUpgrade(this.levelUpOptions[0]);
        event.preventDefault();
        return;
      } else if (k === '2' && this.levelUpOptions[1]) {
        this.selectUpgrade(this.levelUpOptions[1]);
        event.preventDefault();
        return;
      } else if (k === '3' && this.levelUpOptions[2]) {
        this.selectUpgrade(this.levelUpOptions[2]);
        event.preventDefault();
        return;
      }
    }

    if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === ' ' || k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') {
      event.preventDefault();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    const k = event.key.toLowerCase();
    this.keys[k] = false;
    if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === ' ' || k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') {
      event.preventDefault();
    }
  }

  startGameLoop() {
    const gameLoop = () => {
      const now = performance.now();
      const dt = this.lastFrameTs == null ? 0 : Math.min((now - this.lastFrameTs) / 1000, 0.05);
      this.lastFrameTs = now;

      if (this.currentPlayer) {
        this.handleInput(dt);
        this.updateCamera(dt);
      }
      this.updateOtherPlayers(dt);
      this.updateBullets(dt);
      requestAnimationFrame(gameLoop);
    };
    gameLoop();
  }

  handleInput(dt: number) {
    if (!this.currentPlayer || this.isDead) return;

    const speed = (this.currentPlayer.stats?.moveSpeed || 240) * dt;
    let newX = this.currentPlayer.x;
    let newY = this.currentPlayer.y;
    const newAngle = this.mouseAngle ?? this.currentPlayer.angle;

    let dx = 0;
    let dy = 0;

    if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx = (dx / length) * speed;
      dy = (dy / length) * speed;
    }

    const nextX = newX + dx;
    const nextY = newY + dy;

    if (!this.checkCollision(nextX, nextY, 20)) {
      newX = nextX;
      newY = nextY;
    }

    if (this.keys[' '] || this.mousePressed) {
      this.shoot();
    }

    this.currentPlayer.x = newX;
    this.currentPlayer.y = newY;
    this.currentPlayer.angle = newAngle;

    this.gameService.movePlayer(newX, newY, newAngle);
  }

  updateOtherPlayers(dt: number) {
    const lerpT = Math.min(1, 15 * dt);

    this.players.forEach(p => {
      if (p.id === this.currentPlayer?.id) return;
      if (p.targetX === undefined || p.targetY === undefined) return;

      p.x += (p.targetX - p.x) * lerpT;
      p.y += (p.targetY - p.y) * lerpT;

      if (p.targetAngle !== undefined) {
        let diff = p.targetAngle - p.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        p.angle += diff * lerpT;
      }
    });
  }

  shoot() {
    if (!this.currentPlayer || this.isDead) return;
    if (this.levelUpOptions) return;

    const fireRate = this.currentPlayer.stats?.fireRate || this.SHOOT_COOLDOWN_MS;
    const now = Date.now();
    if (now - this.lastShotAt < fireRate) return;
    this.lastShotAt = now;

    // Use current angle for the tip position
    const bulletX = this.currentPlayer.x + Math.cos(this.currentPlayer.angle) * 40;
    const bulletY = this.currentPlayer.y + Math.sin(this.currentPlayer.angle) * 40;

    this.gameService.shoot(bulletX, bulletY, this.currentPlayer.angle);
  }

  triggerDebugLevelUp() {
    this.gameService.debugLevelUp();
  }

  startGame() {
    this.gameStarted = true;
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.currentPlayer) return;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    this.mouseAngle = Math.atan2(dy, dx);
  }

  @HostListener('window:mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    this.mousePressed = true;
  }

  @HostListener('window:mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    this.mousePressed = false;
  }

  private updateBullets(dt: number) {
    if (!this.bullets || this.bullets.length === 0) return;
    this.bullets = this.bullets.filter((bullet) => {
      const speed = this.BULLET_SPEED; // Basic client prediction
      bullet.x += Math.cos(bullet.angle) * speed * dt;
      bullet.y += Math.sin(bullet.angle) * speed * dt;

      for (const o of this.obstacles) {
        if (bullet.x >= o.x && bullet.x <= o.x + o.width && bullet.y >= o.y && bullet.y <= o.y + o.height) {
          return false;
        }
      }
      return true;
    });
  }

  private updateCamera(dt: number) {
    if (!this.currentPlayer) {
      this.cameraTransform = '';
      return;
    }
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const targetOffsetX = centerX - this.currentPlayer.x;
    const targetOffsetY = centerY - this.currentPlayer.y;
    const followT = Math.min(1, 12 * dt);
    this.cameraOffsetX += (targetOffsetX - this.cameraOffsetX) * followT;
    this.cameraOffsetY += (targetOffsetY - this.cameraOffsetY) * followT;
    this.cameraTransform = `translate3d(${this.cameraOffsetX}px, ${this.cameraOffsetY}px, 0)`;
  }

  private checkCollision(x: number, y: number, radius: number): boolean {
    if (x < radius || x > this.worldWidth - radius || y < radius || y > this.worldHeight - radius) {
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

  selectUpgrade(upgrade: Upgrade) {
    this.gameService.selectUpgrade(upgrade.id);
    this.levelUpOptions = null;
  }

  respawn() {
    this.gameService.respawn();
    this.isDead = false;
    if (this.currentPlayer) {
      this.currentPlayer.level = 1;
      this.currentPlayer.exp = 0;
    }
  }

  goToMainMenu() {
    this.gameStarted = false;
    this.isDead = false;
  }

  isImmune(player: Player): boolean {
    return !!player.immuneUntil && player.immuneUntil > Date.now();
  }

  isShooting(player: Player): boolean {
    return !!player.shootingUntil && player.shootingUntil > Date.now();
  }

  trackByFn(index: number, item: { id: string }): string {
    return item.id;
  }
}

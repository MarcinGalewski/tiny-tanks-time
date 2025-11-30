import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from './game.service';

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
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
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
  currentPlayer: Player | null = null;
  levelUpOptions: Upgrade[] | null = null;
  keys: { [key: string]: boolean } = {};
  gameStarted = false;
  private mouseAngle: number | null = null;
  private readonly BULLET_SPEED = 360; // px/sec
  private readonly SHOOT_COOLDOWN_MS = 300; // adjust as desired
  private lastShotAt = 0;

  // timing
  private lastFrameTs: number | null = null;

  // World and camera
  worldWidth = 4000;
  worldHeight = 4000;
  cameraTransform = '';
  private cameraOffsetX = 0;
  private cameraOffsetY = 0;

  // Simple static obstacles
  obstacles: Array<{ x: number; y: number; width: number; height: number }> = [
    { x: 400, y: 300, width: 120, height: 40 },
    { x: 900, y: 600, width: 60, height: 200 },
    { x: 1400, y: 450, width: 200, height: 60 },
    { x: 700, y: 1100, width: 300, height: 40 },
  ];
  
  // Make Math available in template
  Math = Math;

  constructor(private gameService: GameService) {}

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
      const player = this.players.find(p => p.id === playerData.id);
      if (player) {
        player.x = playerData.x;
        player.y = playerData.y;
        player.angle = playerData.angle;
      }
    });

    this.gameService.onBulletShot().subscribe((bullet) => {
      if (bullet) {
        this.bullets.push(bullet);
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

    this.gameService.onLevelUpOptions().subscribe((options) => {
      this.levelUpOptions = options;
    });

    this.gameService.onPlayerImmunity().subscribe((data) => {
      if (data) {
        const p = this.players.find(pl => pl.id === data.id);
        if (p) {
          p.immuneUntil = data.immuneUntil;
        }
      }
    });

    // Listen for player updates (HP/EXP)
    this.gameService.getSocket().on('playerHit', (data: Player) => {
      const p = this.players.find(pl => pl.id === data.id);
      if (p) {
        p.hp = data.hp;
        p.maxHp = data.maxHp;
        p.x = data.x;
        p.y = data.y;
      }
    });

    this.gameService.getSocket().on('playerExpUpdate', (data: Player) => {
      const p = this.players.find(pl => pl.id === data.id);
      if (p) {
        p.exp = data.exp;
        p.maxExp = data.maxExp;
        p.level = data.level;
        p.hp = data.hp;
        p.maxHp = data.maxHp;
      }
    });

    // Start game loop
    this.startGameLoop();
  }

  ngOnDestroy() {
    this.gameService.disconnect();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    const k = event.key.toLowerCase();
    this.keys[k] = true;
    
    // Handle upgrade selection with number keys
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
      const dt = this.lastFrameTs == null ? 0 : Math.min((now - this.lastFrameTs) / 1000, 0.05); // cap dt
      this.lastFrameTs = now;

      if (this.currentPlayer) {
        this.handleInput(dt);
        this.updateCamera(dt);
      }
      this.updateBullets(dt);
      requestAnimationFrame(gameLoop);
    };
    gameLoop();
  }

  handleInput(dt: number) {
    if (!this.currentPlayer) return;

    const speed = 240 * dt; // px/sec -> per frame distance
    let newX = this.currentPlayer.x;
    let newY = this.currentPlayer.y;
    const newAngle = this.mouseAngle ?? this.currentPlayer.angle;

    // Movement Vector
    let dx = 0;
    let dy = 0;

    if (this.keys['w'] || this.keys['arrowup']) {
      dx += Math.cos(newAngle);
      dy += Math.sin(newAngle);
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      dx -= Math.cos(newAngle);
      dy -= Math.sin(newAngle);
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      dx += Math.cos(newAngle - Math.PI / 2);
      dy += Math.sin(newAngle - Math.PI / 2);
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      dx += Math.cos(newAngle + Math.PI / 2);
      dy += Math.sin(newAngle + Math.PI / 2);
    }

    // Normalize vector if moving diagonally
    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx = (dx / length) * speed;
      dy = (dy / length) * speed;
    }

    // Apply movement with collision check
    const nextX = newX + dx;
    const nextY = newY + dy;

    if (!this.checkCollision(nextX, nextY, 20)) {
      newX = nextX;
      newY = nextY;
    }

    // Shoot
    if (this.keys[' ']) {
      this.shoot();
    }

    // Update player position
    this.currentPlayer.x = newX;
    this.currentPlayer.y = newY;
    this.currentPlayer.angle = newAngle;

    // Send update to server
    this.gameService.movePlayer(newX, newY, newAngle);
  }

  shoot() {
    if (!this.currentPlayer) return;
    // Prevent shooting if level up modal is open? Or allow it? 
    // Usually input is consumed by UI.
    if (this.levelUpOptions) return;

    const now = Date.now();
    if (now - this.lastShotAt < this.SHOOT_COOLDOWN_MS) return;
    this.lastShotAt = now;
    
    const bulletX = this.currentPlayer.x + Math.cos(this.currentPlayer.angle) * 40;
    const bulletY = this.currentPlayer.y + Math.sin(this.currentPlayer.angle) * 40;
    
    this.gameService.shoot(bulletX, bulletY, this.currentPlayer.angle);
  }

  startGame() {
    this.gameStarted = true;
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.currentPlayer) return;
    
    // Calculate angle based on center of screen since camera follows player
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    this.mouseAngle = Math.atan2(dy, dx);
  }

  private updateBullets(dt: number) {
    if (!this.bullets || this.bullets.length === 0) return;
    // Update and collide with obstacles
    this.bullets = this.bullets.filter((bullet) => {
      bullet.x += Math.cos(bullet.angle) * this.BULLET_SPEED * dt;
      bullet.y += Math.sin(bullet.angle) * this.BULLET_SPEED * dt;

      for (const o of this.obstacles) {
        if (bullet.x >= o.x && bullet.x <= o.x + o.width && bullet.y >= o.y && bullet.y <= o.y + o.height) {
          return false; // remove bullet on obstacle hit
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
    // Center field on current player in viewport
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const targetOffsetX = centerX - this.currentPlayer.x;
    const targetOffsetY = centerY - this.currentPlayer.y;
    const followT = Math.min(1, 12 * dt); // smoothing factor
    this.cameraOffsetX += (targetOffsetX - this.cameraOffsetX) * followT;
    this.cameraOffsetY += (targetOffsetY - this.cameraOffsetY) * followT;
    this.cameraTransform = `translate3d(${this.cameraOffsetX}px, ${this.cameraOffsetY}px, 0)`;
  }

  private checkCollision(x: number, y: number, radius: number): boolean {
    // Check map boundaries
    if (x < radius || x > this.worldWidth - radius || y < radius || y > this.worldHeight - radius) {
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

  selectUpgrade(upgrade: Upgrade) {
    this.gameService.selectUpgrade(upgrade.id);
    this.levelUpOptions = null;
  }

  isImmune(player: Player): boolean {
    return !!player.immuneUntil && player.immuneUntil > Date.now();
  }
}

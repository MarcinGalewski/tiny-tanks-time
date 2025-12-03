import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { Player, Bullet, Orb, Upgrade } from './game.component';
import { environment } from '../enironments/environment';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private socket: Socket;
  private playerId: string | null = null;

  private gameStateSubject = new BehaviorSubject<{ players: Player[], bullets: Bullet[], orbs: Orb[] }>({
    players: [],
    bullets: [],
    orbs: []
  });

  private playerJoinedSubject = new BehaviorSubject<Player | null>(null);
  private playerLeftSubject = new BehaviorSubject<string | null>(null);
  private playerMovedSubject = new BehaviorSubject<Player | null>(null);
  private bulletShotSubject = new BehaviorSubject<Bullet | null>(null);
  private bulletRemovedSubject = new BehaviorSubject<string | null>(null);
  private orbSpawnedSubject = new BehaviorSubject<Orb | null>(null);
  private orbCollectedSubject = new BehaviorSubject<string | null>(null);
  private levelUpOptionsSubject = new BehaviorSubject<Upgrade[] | null>(null);
  private playerImmunitySubject = new BehaviorSubject<{id: string, immuneUntil: number} | null>(null);

  constructor() {
    const backendUrl = environment.backendUrl;

    this.socket = io(backendUrl, {
      transports: ['websocket'],
      path: '/socket.io/',
      withCredentials: false,
      secure: backendUrl.startsWith('https')
    });

    this.socket.on('connect', () => {
      console.log('Connected to backend:', backendUrl);
      this.playerId = this.socket.id || null;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from backend');
      this.playerId = null;
    });

    this.socket.on('gameState', (gameState) => {
      this.gameStateSubject.next(gameState);
    });

    this.socket.on('playerJoined', (player) => {
      this.playerJoinedSubject.next(player);
    });

    this.socket.on('playerLeft', (playerId) => {
      this.playerLeftSubject.next(playerId);
    });

    this.socket.on('playerMoved', (playerData) => {
      this.playerMovedSubject.next(playerData);
    });

    this.socket.on('bulletShot', (bullet) => {
      this.bulletShotSubject.next(bullet);
    });

    this.socket.on('bulletRemoved', (bulletId) => {
      this.bulletRemovedSubject.next(bulletId);
    });

    this.socket.on('orbSpawned', (orb) => {
      this.orbSpawnedSubject.next(orb);
    });

    this.socket.on('orbCollected', (orbId) => {
      this.orbCollectedSubject.next(orbId);
    });

    this.socket.on('levelUpOptions', (options) => {
      this.levelUpOptionsSubject.next(options);
    });

    this.socket.on('playerImmunity', (data) => {
      this.playerImmunitySubject.next(data);
    });
  }

  connect() {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect() {
    this.socket.disconnect();
  }

  movePlayer(x: number, y: number, angle: number) {
    this.socket.emit('playerMove', { x, y, angle });
  }

  shoot(x: number, y: number, angle: number) {
    this.socket.emit('shoot', { x, y, angle });
  }

  selectUpgrade(upgradeId: string) {
    this.socket.emit('selectUpgrade', upgradeId);
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  getSocket(): Socket {
    return this.socket;
  }

  onGameState(): Observable<{ players: Player[], bullets: Bullet[], orbs: Orb[] }> {
    return this.gameStateSubject.asObservable();
  }

  onPlayerJoined(): Observable<Player | null> {
    return this.playerJoinedSubject.asObservable();
  }

  onPlayerLeft(): Observable<string | null> {
    return this.playerLeftSubject.asObservable();
  }

  onPlayerMoved(): Observable<Player | null> {
    return this.playerMovedSubject.asObservable();
  }

  onBulletShot(): Observable<Bullet | null> {
    return this.bulletShotSubject.asObservable();
  }

  onBulletRemoved(): Observable<string | null> {
    return this.bulletRemovedSubject.asObservable();
  }

  onOrbSpawned(): Observable<Orb | null> {
    return this.orbSpawnedSubject.asObservable();
  }

  onOrbCollected(): Observable<string | null> {
    return this.orbCollectedSubject.asObservable();
  }

  onLevelUpOptions(): Observable<Upgrade[] | null> {
    return this.levelUpOptionsSubject.asObservable();
  }

  onPlayerImmunity(): Observable<{id: string, immuneUntil: number} | null> {
    return this.playerImmunitySubject.asObservable();
  }
}

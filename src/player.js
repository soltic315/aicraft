// Player controller: FPS camera, movement, physics, block interaction
import * as THREE from 'three';
import { BlockType } from './blocks.js';

const MOVE_SPEED = 5;
const JUMP_FORCE = 8;
const GRAVITY = 20;
const PLAYER_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.3;
const MOUSE_SENSITIVITY = 0.002;

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;

    this.position = new THREE.Vector3(8, 40, 8);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.pitch = 0;
    this.yaw = 0;

    this.onGround = false;
    this.keys = {};
    this.locked = false;

    this._initControls();
  }

  _initControls() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === document.body;
    });
  }

  lock() {
    document.body.requestPointerLock();
  }

  spawn() {
    const spawnY = this.world.getSpawnHeight(8, 8);
    this.position.set(8, spawnY, 8);
    this.velocity.set(0, 0, 0);
  }

  update(dt) {
    dt = Math.min(dt, 0.05); // Cap delta

    // Movement direction
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (this.keys['KeyW']) moveDir.add(forward);
    if (this.keys['KeyS']) moveDir.sub(forward);
    if (this.keys['KeyA']) moveDir.sub(right);
    if (this.keys['KeyD']) moveDir.add(right);

    if (moveDir.length() > 0) moveDir.normalize();

    // Horizontal velocity
    this.velocity.x = moveDir.x * MOVE_SPEED;
    this.velocity.z = moveDir.z * MOVE_SPEED;

    // Jump
    if (this.keys['Space'] && this.onGround) {
      this.velocity.y = JUMP_FORCE;
      this.onGround = false;
    }

    // Gravity
    this.velocity.y -= GRAVITY * dt;

    // Move and collide
    this._moveAxis('y', this.velocity.y * dt);
    this._moveAxis('x', this.velocity.x * dt);
    this._moveAxis('z', this.velocity.z * dt);

    // Prevent falling below world
    if (this.position.y < -10) {
      this.spawn();
    }

    // Update camera
    this.camera.position.copy(this.position);
    this.camera.position.y += PLAYER_HEIGHT;

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  _moveAxis(axis, amount) {
    this.position[axis] += amount;

    // Check collision
    const feet = this.position.y;
    const head = this.position.y + PLAYER_HEIGHT + 0.18;

    // Check multiple points for collision
    for (let yCheck = feet; yCheck <= head; yCheck += 0.5) {
      for (let dx = -1; dx <= 1; dx += 2) {
        for (let dz = -1; dz <= 1; dz += 2) {
          const checkX = this.position.x + dx * PLAYER_RADIUS;
          const checkZ = this.position.z + dz * PLAYER_RADIUS;
          const bx = Math.floor(checkX);
          const by = Math.floor(yCheck);
          const bz = Math.floor(checkZ);

          const block = this.world.getBlock(bx, by, bz);
          if (block !== BlockType.AIR && block !== BlockType.WATER) {
            // Push back
            if (axis === 'x') {
              if (amount > 0) this.position.x = bx - PLAYER_RADIUS;
              else this.position.x = bx + 1 + PLAYER_RADIUS;
              this.velocity.x = 0;
            } else if (axis === 'z') {
              if (amount > 0) this.position.z = bz - PLAYER_RADIUS;
              else this.position.z = bz + 1 + PLAYER_RADIUS;
              this.velocity.z = 0;
            } else if (axis === 'y') {
              if (amount < 0) {
                this.position.y = by + 1;
                this.velocity.y = 0;
                this.onGround = true;
              } else {
                this.position.y = by - PLAYER_HEIGHT - 0.18;
                this.velocity.y = 0;
              }
            }
            return;
          }
        }
      }
    }

    if (axis === 'y') {
      this.onGround = false;
    }
  }

  getDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  getEyePosition() {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + PLAYER_HEIGHT,
      this.position.z
    );
  }
}

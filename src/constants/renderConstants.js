// レンダリング・視覚系定数（空・霧・ライト色）
import * as THREE from 'three';

export const DAY_NIGHT_CYCLE_SECONDS = 240;

export const DAY_SKY_COLOR     = new THREE.Color(0x87CEEB);
export const NIGHT_SKY_COLOR   = new THREE.Color(0x071020);
export const DAY_FOG_COLOR     = new THREE.Color(0x87CEEB);
export const NIGHT_FOG_COLOR   = new THREE.Color(0x12182F);
export const DAY_AMBIENT_COLOR = new THREE.Color(0xffffff);
export const NIGHT_AMBIENT_COLOR = new THREE.Color(0x7d88b0);
export const DAY_SUN_COLOR     = new THREE.Color(0xfff5db);
export const NIGHT_MOON_COLOR  = new THREE.Color(0x8ea0d0);

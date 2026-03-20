// Perlin-like noise for terrain generation

export class Noise {
  constructor(seed = 42) {
    this.perm = this._buildPermutation(seed);
  }

  _buildPermutation(seed) {
    const p = new Uint8Array(512);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;

    // Fisher-Yates shuffle with seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [base[i], base[j]] = [base[j], base[i]];
    }
    for (let i = 0; i < 512; i++) p[i] = base[i & 255];
    return p;
  }

  _fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  _lerp(a, b, t) {
    return a + t * (b - a);
  }

  _grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : -x;
    const v = h === 0 || h === 3 ? y : -y;
    return u + v;
  }

  _grad3(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise3D(x, y, z) {
    const p = this.perm;
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = this._fade(xf);
    const v = this._fade(yf);
    const w = this._fade(zf);

    const aaa = p[p[p[xi]     + yi]     + zi];
    const aba = p[p[p[xi]     + yi + 1] + zi];
    const aab = p[p[p[xi]     + yi]     + zi + 1];
    const abb = p[p[p[xi]     + yi + 1] + zi + 1];
    const baa = p[p[p[xi + 1] + yi]     + zi];
    const bba = p[p[p[xi + 1] + yi + 1] + zi];
    const bab = p[p[p[xi + 1] + yi]     + zi + 1];
    const bbb = p[p[p[xi + 1] + yi + 1] + zi + 1];

    return this._lerp(
      this._lerp(
        this._lerp(this._grad3(aaa, xf,     yf,     zf    ), this._grad3(baa, xf - 1, yf,     zf    ), u),
        this._lerp(this._grad3(aba, xf,     yf - 1, zf    ), this._grad3(bba, xf - 1, yf - 1, zf    ), u),
        v
      ),
      this._lerp(
        this._lerp(this._grad3(aab, xf,     yf,     zf - 1), this._grad3(bab, xf - 1, yf,     zf - 1), u),
        this._lerp(this._grad3(abb, xf,     yf - 1, zf - 1), this._grad3(bbb, xf - 1, yf - 1, zf - 1), u),
        v
      ),
      w
    );
  }

  noise2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this._fade(xf);
    const v = this._fade(yf);

    const p = this.perm;
    const aa = p[p[xi] + yi];
    const ab = p[p[xi] + yi + 1];
    const ba = p[p[xi + 1] + yi];
    const bb = p[p[xi + 1] + yi + 1];

    return this._lerp(
      this._lerp(this._grad(aa, xf, yf), this._grad(ba, xf - 1, yf), u),
      this._lerp(this._grad(ab, xf, yf - 1), this._grad(bb, xf - 1, yf - 1), u),
      v
    );
  }

  // Multi-octave noise
  fbm(x, y, octaves = 4, lacunarity = 2, persistence = 0.5) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let max = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, y * frequency) * amplitude;
      max += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / max;
  }
}

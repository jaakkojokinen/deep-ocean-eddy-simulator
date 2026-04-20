import FFT from 'fft.js';

export class EddyPhysics {
  constructor(size = 128, viscosity = 0.001, dt = 0.01) {
    this.size = size;
    this.viscosity = viscosity;
    this.dt = dt;
    this.windStrength = 0.005; // Default forcing

    this.fft = new FFT(size);
    this.vorticity = new Float64Array(size * size * 2);
    
    this.tempIn = this.fft.createComplexArray();
    this.tempOut = this.fft.createComplexArray();
    
    this.initVorticity();
  }

  initVorticity() {
    for (let i = 0; i < this.size * this.size; i++) {
      const idx = i * 2;
      // Initialize with a healthy dose of random spin
      this.vorticity[idx] = (Math.random() - 0.5) * 5.0;
      this.vorticity[idx + 1] = 0;
    }
  }

  transform2D(data, inverse = false) {
    const size = this.size;
    const out = new Float64Array(data.length);
    const norm = inverse ? 1.0 / size : 1.0;

    // Row transforms
    for (let y = 0; y < size; y++) {
      const offset = y * size * 2;
      for (let i = 0; i < size * 2; i++) this.tempIn[i] = data[offset + i];
      if (inverse) this.fft.inverseTransform(this.tempOut, this.tempIn);
      else this.fft.transform(this.tempOut, this.tempIn);
      for (let i = 0; i < size * 2; i++) this.tempOut[i] *= norm;
      out.set(this.tempOut, offset);
    }

    // Column transforms
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const idx = (y * size + x) * 2;
        this.tempIn[y * 2] = out[idx];
        this.tempIn[y * 2 + 1] = out[idx + 1];
      }
      if (inverse) this.fft.inverseTransform(this.tempOut, this.tempIn);
      else this.fft.transform(this.tempOut, this.tempIn);
      for (let y = 0; y < size; y++) {
        const idx = (y * size + x) * 2;
        out[idx] = this.tempOut[y * 2] * norm;
        out[idx + 1] = this.tempOut[y * 2 + 1] * norm;
      }
    }
    return out;
  }

  step() {
    const size = this.size;
    
    // 1. Move to Frequency Space
    let omegaHat = this.transform2D(this.vorticity, false);

    // 2. Solve Poisson and Apply Forcing/Viscosity in K-Space
    let u = new Float64Array(size * size * 2);
    let v = new Float64Array(size * size * 2);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 2;
        const kx = x < size / 2 ? x : x - size;
        const ky = y < size / 2 ? y : y - size;
        const kSq = kx * kx + ky * ky;

        if (kSq > 0) {
          // Poisson Solver: Streamfunction
          const psiHatR = -omegaHat[idx] / kSq;
          const psiHatI = -omegaHat[idx + 1] / kSq;

          // Compute Velocities (Spectral Derivatives)
          u[idx] = -ky * psiHatI;
          u[idx + 1] = ky * psiHatR;
          v[idx] = kx * psiHatI;
          v[idx + 1] = -kx * psiHatR;
          
          // --- FORCING & DISSIPATION ---
          // Add energy to large/medium scales (the "Wind")
          if (kSq > 2 && kSq < 12) {
             omegaHat[idx] += (Math.random() - 0.5) * this.windStrength;
          }

          // Viscosity (friction)
          const dissipation = Math.exp(-this.viscosity * kSq * this.dt);
          omegaHat[idx] *= dissipation;
          omegaHat[idx + 1] *= dissipation;
        }
      }
    }

    // 3. Move Velocity to Spatial Domain for Advection
    const uSp = this.transform2D(u, true);
    const vSp = this.transform2D(v, true);

    // 4. Semi-Lagrangian Advection
    const nextVort = new Float64Array(this.vorticity.length);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 2;
        
        // Trace back where the fluid came from
        let oldX = (x - uSp[idx] * this.dt + size) % size;
        let oldY = (y - vSp[idx] * this.dt + size) % size;
        
        // Simple sample (Bilinear is better, but this is faster for testing)
        const x0 = Math.floor(oldX);
        const y0 = Math.floor(oldY);
        const sIdx = (y0 * size + x0) * 2;
        
        nextVort[idx] = this.vorticity[sIdx];
        nextVort[idx + 1] = this.vorticity[sIdx + 1];
      }
    }

    this.vorticity = nextVort;
  }
}
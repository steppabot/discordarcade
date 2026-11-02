// GoldenEye PC (web): plays the game's 22050 Hz stereo mix on the browser's
// audio thread. The page posts each mixed block here (Int16Array, L/R
// interleaved). When no block is waiting, as while the game loads a level,
// this fades to silence instead of repeating old sound.
class GeOut extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.step = options.processorOptions.rate / sampleRate;   // source frames per output frame
    this.queue = [];
    this.chunk = null;
    this.at = 0;           // next sample index in chunk
    this.buffered = 0;     // source frames not played yet
    this.received = 0;     // source frames received in total
    this.underruns = 0;    // times playback ran dry
    this.starving = true;
    this.t = 0;            // position between the two source frames a and b
    this.aL = this.aR = this.bL = this.bR = 0;
    this.calls = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (!(d instanceof Int16Array) || d.length < 2) return;
      this.queue.push(d);
      this.buffered += d.length >> 1;
      this.received += d.length >> 1;
    };
  }

  next() {
    while (!this.chunk || this.at >= this.chunk.length) {
      this.chunk = this.queue.shift() || null;
      this.at = 0;
      if (!this.chunk) return false;
    }
    this.bL = this.chunk[this.at] / 32768;
    this.bR = this.chunk[this.at + 1] / 32768;
    this.at += 2;
    this.buffered--;
    return true;
  }

  process(inputs, outputs) {
    const out = outputs[0], L = out[0], R = out[1] || out[0];
    for (let i = 0; i < L.length; i++) {
      L[i] = this.aL + (this.bL - this.aL) * this.t;
      R[i] = this.aR + (this.bR - this.aR) * this.t;
      this.t += this.step;
      while (this.t >= 1) {
        this.t -= 1;
        this.aL = this.bL;
        this.aR = this.bR;
        if (this.next()) {
          this.starving = false;
        } else {
          if (!this.starving) { this.starving = true; this.underruns++; }
          this.bL *= 0.85;   // ~1.5 ms fade instead of a click
          this.bR *= 0.85;
        }
      }
    }
    if (++this.calls % 16 === 0) {
      this.port.postMessage({ t: currentTime + L.length / sampleRate, buffered: this.buffered, received: this.received, underruns: this.underruns });
    }
    return true;
  }
}
registerProcessor('ge-out', GeOut);

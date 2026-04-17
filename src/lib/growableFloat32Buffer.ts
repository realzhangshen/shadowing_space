const DEFAULT_CAPACITY = 1024;

export class GrowableFloat32Buffer {
  private storage: Float32Array;
  private size = 0;

  constructor(initialCapacity: number = DEFAULT_CAPACITY) {
    const cap = Math.max(1, initialCapacity | 0);
    this.storage = new Float32Array(cap);
  }

  get length(): number {
    return this.size;
  }

  get capacity(): number {
    return this.storage.length;
  }

  push(value: number): void {
    if (this.size >= this.storage.length) {
      const next = new Float32Array(this.storage.length * 2);
      next.set(this.storage);
      this.storage = next;
    }
    this.storage[this.size++] = value;
  }

  snapshot(): Float32Array {
    return this.storage.subarray(0, this.size);
  }

  freeze(): Float32Array {
    const copy = new Float32Array(this.size);
    copy.set(this.storage.subarray(0, this.size));
    return copy;
  }

  reset(): void {
    this.size = 0;
  }
}

/**
 * A fixed-capacity ring buffer for accumulating stream output.
 * When the buffer exceeds maxBytes, the oldest chunks are dropped.
 */
export class RingBuffer {
  private chunks: Buffer[] = [];
  private totalBytes = 0;
  private maxBytes: number;

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  push(chunk: Buffer): void {
    this.chunks.push(chunk);
    this.totalBytes += chunk.length;

    // Drop oldest chunks until we're under the limit
    while (this.totalBytes > this.maxBytes && this.chunks.length > 1) {
      const dropped = this.chunks.shift()!;
      this.totalBytes -= dropped.length;
    }
  }

  toString(): string {
    return Buffer.concat(this.chunks).toString('utf-8');
  }

  get size(): number {
    return this.totalBytes;
  }
}

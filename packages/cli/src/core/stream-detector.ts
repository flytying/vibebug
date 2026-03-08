import { generateSignature } from './signature.js';
import {
  DEFAULT_STREAM_QUIET_TIMEOUT_MS,
  DEFAULT_STREAM_COOLDOWN_MS,
  MAX_ERROR_BLOCK_LINES,
} from '../utils/constants.js';

/**
 * Error markers that trigger error block collection.
 * Aligned with signature.ts ERROR_HEADER_PATTERNS so the stream detector
 * catches everything the signature algorithm can anchor.
 */
const ERROR_MARKERS = [
  // JS/TS errors (with optional Unicode prefix like Next.js ⨯)
  /^[\u00d7\u2a2f]?\s*(Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError):/,
  /^Uncaught\s/,
  // TypeScript compiler
  /error TS\d+/,
  // Rust compiler
  /^error\[E\d+\]/,
  /^error: aborting due to/,
  // Python
  /^(ModuleNotFoundError|ImportError|ConnectionRefusedError|AssertionError|AttributeError|KeyError|ValueError|RuntimeError|FileNotFoundError|PermissionError|OSError):/,
  /^Traceback \(most recent call last\)/,
  // Go
  /^panic:/,
  // npm
  /^npm ERR!/,
  // pnpm (specific — replaces the overly broad ^ERR!)
  /^ERR_PNPM_/,
  // Build tools
  /^Build failed/i,
  /^Failed to compile/i,
  /Module not found/,
  /Cannot find module/,
  // Vite/Rollup
  /Rollup failed to resolve import/,
  // ESLint
  /ESLint couldn't find the config/,
  // Test runners (Jest, Vitest)
  /^\s*FAIL\s/,
  // Next.js Unicode prefix (⨯)
  /^[\u00d7\u2a2f]\s/,
  // System
  /Segmentation fault/,
  /ELIFECYCLE/,
  /CompileError/,
  // Generic
  /^FATAL/i,
  /^ERROR\s/,
];

/**
 * Lines that match an error marker but contain success/recovery language
 * are likely false positives from logging frameworks (e.g., pino, winston)
 * that use ERROR as a log level for non-fatal events.
 */
const FALSE_POSITIVE_PATTERNS = [
  /\b(successfully|completed|resolved|recovered|reconnect(?:ed|ing)?|healthy|ready|started|listening|connected|running)\b/i,
];

type DetectorState = 'idle' | 'collecting';

export interface ErrorBlock {
  lines: string[];
  signature: string;
}

export class StreamDetector {
  private state: DetectorState = 'idle';
  private blockLines: string[] = [];
  private quietTimer: ReturnType<typeof setTimeout> | null = null;
  private recentSignatures: Map<string, number> = new Map(); // signature → timestamp
  private onCapture: (block: ErrorBlock) => void;
  private command: string;
  private quietTimeoutMs: number;
  private cooldownMs: number;

  constructor(
    command: string,
    onCapture: (block: ErrorBlock) => void,
    options?: {
      quietTimeoutMs?: number;
      cooldownMs?: number;
    }
  ) {
    this.command = command;
    this.onCapture = onCapture;
    this.quietTimeoutMs = options?.quietTimeoutMs ?? DEFAULT_STREAM_QUIET_TIMEOUT_MS;
    this.cooldownMs = options?.cooldownMs ?? DEFAULT_STREAM_COOLDOWN_MS;
  }

  /**
   * Feed a chunk of output to the detector. Call this for each data event
   * from stdout/stderr.
   */
  feed(chunk: string): void {
    const lines = chunk.split('\n');
    for (const line of lines) {
      this.processLine(line);
    }
  }

  /**
   * Call when the process exits to flush any pending error block.
   */
  flush(): void {
    if (this.state === 'collecting' && this.blockLines.length > 0) {
      this.finalizeBlock();
    }
    this.clearQuietTimer();
  }

  destroy(): void {
    this.clearQuietTimer();
  }

  /**
   * Returns all signatures that were captured by the stream detector.
   */
  getCapturedSignatures(): Set<string> {
    return new Set(this.recentSignatures.keys());
  }

  private processLine(line: string): void {
    const stripped = line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();

    if (this.state === 'idle') {
      if (this.isErrorMarker(stripped)) {
        this.state = 'collecting';
        this.blockLines = [line];
        this.resetQuietTimer();
      }
    } else if (this.state === 'collecting') {
      this.blockLines.push(line);
      this.resetQuietTimer();

      // Cap at max lines
      if (this.blockLines.length >= MAX_ERROR_BLOCK_LINES) {
        this.finalizeBlock();
      }
    }
  }

  private isErrorMarker(line: string): boolean {
    if (!ERROR_MARKERS.some(re => re.test(line))) return false;
    // Reject false positives: lines that match a marker but contain recovery language
    if (FALSE_POSITIVE_PATTERNS.some(re => re.test(line))) return false;
    return true;
  }

  private resetQuietTimer(): void {
    this.clearQuietTimer();
    this.quietTimer = setTimeout(() => {
      if (this.state === 'collecting') {
        this.finalizeBlock();
      }
    }, this.quietTimeoutMs);
  }

  private clearQuietTimer(): void {
    if (this.quietTimer) {
      clearTimeout(this.quietTimer);
      this.quietTimer = null;
    }
  }

  private finalizeBlock(): void {
    this.clearQuietTimer();
    this.state = 'idle';

    const rawBlock = this.blockLines.join('\n');
    const signature = generateSignature(rawBlock, this.command);

    // Cooldown: skip if same signature was captured recently
    const lastSeen = this.recentSignatures.get(signature);
    const now = Date.now();
    if (lastSeen && now - lastSeen < this.cooldownMs) {
      this.blockLines = [];
      return;
    }

    this.recentSignatures.set(signature, now);

    // Clean up old signatures
    for (const [sig, ts] of this.recentSignatures) {
      if (now - ts > this.cooldownMs * 2) {
        this.recentSignatures.delete(sig);
      }
    }

    this.onCapture({ lines: this.blockLines, signature });
    this.blockLines = [];
  }
}

import { spawn } from 'node:child_process';
import type { RunResult } from '../types/index.js';
import { RingBuffer } from '../utils/ring-buffer.js';
import { DEFAULT_RING_BUFFER_SIZE } from '../utils/constants.js';

export async function runCommand(argv: string[]): Promise<RunResult> {
  const [cmd, ...args] = argv;
  if (!cmd) {
    return {
      exitCode: 1,
      signal: null,
      stdout: '',
      stderr: 'No command provided',
      durationMs: 0,
      command: '',
    };
  }

  const startTime = performance.now();
  const stdoutBuffer = new RingBuffer(DEFAULT_RING_BUFFER_SIZE);
  const stderrBuffer = new RingBuffer(DEFAULT_RING_BUFFER_SIZE);

  return new Promise<RunResult>((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
      shell: true,
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk);
      stdoutBuffer.push(chunk);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
      stderrBuffer.push(chunk);
    });

    // Forward signals to child
    const forwardSignal = (signal: NodeJS.Signals) => {
      child.kill(signal);
    };
    process.on('SIGINT', () => forwardSignal('SIGINT'));
    process.on('SIGTERM', () => forwardSignal('SIGTERM'));

    child.on('close', (exitCode, signal) => {
      // Clean up signal handlers
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');

      const durationMs = Math.round(performance.now() - startTime);

      resolve({
        exitCode: exitCode ?? (signal ? 1 : 0),
        signal: signal ?? null,
        stdout: stdoutBuffer.toString(),
        stderr: stderrBuffer.toString(),
        durationMs,
        command: argv.join(' '),
      });
    });

    child.on('error', (err) => {
      const durationMs = Math.round(performance.now() - startTime);
      resolve({
        exitCode: 1,
        signal: null,
        stdout: stdoutBuffer.toString(),
        stderr: err.message,
        durationMs,
        command: argv.join(' '),
      });
    });
  });
}

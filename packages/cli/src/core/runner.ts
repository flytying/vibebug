import { spawn } from 'node:child_process';
import type { RunResult } from '../types/index.js';
import { RingBuffer } from '../utils/ring-buffer.js';
import { DEFAULT_RING_BUFFER_SIZE } from '../utils/constants.js';

export async function runCommand(argv: string[], onChunk?: (text: string) => void): Promise<RunResult> {
  if (argv.length === 0) {
    return {
      exitCode: 1,
      signal: null,
      stdout: '',
      stderr: 'No command provided',
      durationMs: 0,
      command: '',
    };
  }

  const commandStr = argv.join(' ');
  const startTime = performance.now();
  const stdoutBuffer = new RingBuffer(DEFAULT_RING_BUFFER_SIZE);
  const stderrBuffer = new RingBuffer(DEFAULT_RING_BUFFER_SIZE);

  return new Promise<RunResult>((resolve) => {
    // Use shell with the full command as a single string to preserve quoting
    const child = spawn(commandStr, [], {
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
      try { onChunk?.(chunk.toString('utf-8')); } catch {}
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
      stderrBuffer.push(chunk);
      try { onChunk?.(chunk.toString('utf-8')); } catch {}
    });

    // Forward signals to child
    const onSigInt = () => child.kill('SIGINT');
    const onSigTerm = () => child.kill('SIGTERM');
    process.on('SIGINT', onSigInt);
    process.on('SIGTERM', onSigTerm);

    child.on('close', (exitCode, signal) => {
      process.removeListener('SIGINT', onSigInt);
      process.removeListener('SIGTERM', onSigTerm);

      const durationMs = Math.round(performance.now() - startTime);

      resolve({
        exitCode: exitCode ?? (signal ? 1 : 0),
        signal: signal ?? null,
        stdout: stdoutBuffer.toString(),
        stderr: stderrBuffer.toString(),
        durationMs,
        command: commandStr,
      });
    });

    child.on('error', (err) => {
      process.removeListener('SIGINT', onSigInt);
      process.removeListener('SIGTERM', onSigTerm);

      const durationMs = Math.round(performance.now() - startTime);
      resolve({
        exitCode: 1,
        signal: null,
        stdout: stdoutBuffer.toString(),
        stderr: err.message,
        durationMs,
        command: commandStr,
      });
    });
  });
}

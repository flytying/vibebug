import type { CaptureInput } from '../types/index.js';

export async function captureFailure(input: CaptureInput): Promise<void> {
  // Placeholder — will be fully implemented in M1.4
  // For now, just log that we captured something
  const { commandStr, result } = input;
  const stderr = result.stderr || result.stdout;
  const preview = stderr.split('\n').slice(-3).join('\n').trim();
  console.error(`\n[vibebug] Captured failure from: ${commandStr} (exit ${result.exitCode})`);
  if (preview) {
    console.error(`[vibebug] ${preview.slice(0, 120)}`);
  }
}

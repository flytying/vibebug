import pc from 'picocolors';

export function info(msg: string): void {
  console.error(pc.cyan(`[vibebug] ${msg}`));
}

export function success(msg: string): void {
  console.error(pc.green(`[vibebug] ${msg}`));
}

export function warn(msg: string): void {
  console.error(pc.yellow(`[vibebug] ${msg}`));
}

export function error(msg: string): void {
  console.error(pc.red(`[vibebug] ${msg}`));
}

export function dim(msg: string): void {
  console.error(pc.dim(`[vibebug] ${msg}`));
}

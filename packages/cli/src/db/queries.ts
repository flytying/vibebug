import { basename } from 'node:path';
import type { Project } from '../types/index.js';

// Placeholder — will use Drizzle ORM in M1.1
// For now, return stub data so the CLI compiles

export function ensureProject(rootPath: string): Project {
  const now = new Date().toISOString();
  return {
    id: 'stub-project',
    name: basename(rootPath),
    rootPath,
    createdAt: now,
    updatedAt: now,
  };
}

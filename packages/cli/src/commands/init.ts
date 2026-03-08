import pc from 'picocolors';
import { existsSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureProject } from '../db/queries.js';
import { VIBEBUG_DIR } from '../utils/constants.js';

export async function initCommand(): Promise<void> {
  const cwd = process.cwd();
  const vibebugDir = join(cwd, VIBEBUG_DIR);

  if (existsSync(vibebugDir)) {
    console.log(pc.yellow('VibeBug is already initialized in this project.'));
    return;
  }

  // This creates .vibebug/, runs migrations, and inserts the project row
  const project = ensureProject(cwd);

  // Add .vibebug/ to .gitignore
  const gitignorePath = join(cwd, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(VIBEBUG_DIR)) {
      appendFileSync(gitignorePath, `\n# VibeBug local data\n${VIBEBUG_DIR}/\n`);
      console.log(pc.dim(`Added ${VIBEBUG_DIR}/ to .gitignore`));
    }
  }

  console.log(pc.green(`VibeBug initialized for "${project.name}".`));
  console.log();
  console.log('Next step:');
  console.log(`  ${pc.cyan('vb')} npm run build`);
  console.log();
  console.log(pc.dim('When a wrapped command fails, VibeBug captures it automatically.'));
  console.log(pc.dim(`View captures with: ${pc.cyan('vb dash')}`));
}

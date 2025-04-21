/**
 * Placeholder for the LockManager class.
 * Manages file/resource locks for concurrency control.
 */
import * as lockfile from 'proper-lockfile';
import * as path from 'path';
import * as fs from 'fs/promises';
import { LoggerFunc } from '../agents/workerAgent';
import { defaultLogger } from '../../utils/logger';

// TODO: Define workspace root more dynamically
const WORKSPACE_ROOT = process.cwd();
const LOCK_DIR = path.join(WORKSPACE_ROOT, '.nyx-locks');

async function ensureLockDir(logger: LoggerFunc): Promise<void> {
  try {
    await fs.mkdir(LOCK_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      logger('Failed to create lock directory: ' + error, 'error');
      throw error;
    }
  }
}

export class LockManager {
  private activeLocks: Map<string, () => Promise<void>> = new Map();
  private log: LoggerFunc;

  constructor(logger?: LoggerFunc) {
    this.log = logger || defaultLogger;
    ensureLockDir(this.log);

    this.log('LockManager initialized.', 'info');
  }

  private getLockfilePath(resourcePath: string): string {
    const relativePath = path.relative(
      WORKSPACE_ROOT,
      path.resolve(resourcePath)
    );

    const lockfileName =
      relativePath.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.lock';

    return path.join(LOCK_DIR, lockfileName);
  }

  async acquireLock(resourcePath: string): Promise<void> {
    const lockfilePath = this.getLockfilePath(resourcePath);
    this.log(
      `Attempting to acquire lock for: ${resourcePath} (-> ${lockfilePath})`
    );

    try {
      await ensureLockDir(this.log);

      const release = await lockfile.lock(lockfilePath, {
        stale: 15000,
        retries: { retries: 5, factor: 1.2, minTimeout: 200 },
      });

      this.activeLocks.set(resourcePath, release);
      this.log(`Lock acquired for: ${resourcePath}`);
    } catch (error: any) {
      this.log(
        `Failed to acquire lock for ${resourcePath}: ${error.message}`,
        'error'
      );

      throw new Error(`Failed to acquire lock for resource: ${resourcePath}`);
    }
  }

  async releaseLock(resourcePath: string): Promise<void> {
    const release = this.activeLocks.get(resourcePath);

    if (release) {
      try {
        await release();
        this.activeLocks.delete(resourcePath);

        this.log(`Lock released for: ${resourcePath}`);
      } catch (error: any) {
        this.log(
          `Failed to release lock for ${resourcePath}: ${error.message}`,
          'error'
        );

        this.activeLocks.delete(resourcePath);
        throw new Error(`Failed to release lock for resource: ${resourcePath}`);
      }
    } else {
      this.log(
        `Attempted to release lock for ${resourcePath}, but no active lock found.`,
        'warn'
      );
    }
  }

  async cleanupLocks(): Promise<void> {
    this.log('Cleaning up any potentially stale locks...', 'info');
    await ensureLockDir(this.log);
  }
}

import { type ChildProcess, spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { createLogger } from '../utils/logger.js';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const logger = createLogger('bore-service');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BoreConfig {
  localPort: number;
  serverHost?: string;
  secret?: string;
}

export interface BoreTunnel {
  publicUrl: string;
  publicPort: number;
}

export class BoreService {
  private process: ChildProcess | null = null;
  private isActive = false;
  private publicUrl: string | null = null;
  private publicPort: number | null = null;

  constructor(private config: BoreConfig) {}

  /**
   * Get the bore binary path
   * Check binaries/ folder first, then fallback to PATH
   */
  private getBoreBinary(): string | null {
    const platform = os.platform();
    const arch = os.arch();

    // Map platform and arch to bore binary naming convention
    let boreTarget: string;
    if (platform === 'linux' && arch === 'x64') {
      boreTarget = 'linux-x64';
    } else if (platform === 'darwin' && arch === 'x64') {
      boreTarget = 'darwin-x64';
    } else if (platform === 'darwin' && arch === 'arm64') {
      boreTarget = 'darwin-arm64';
    } else {
      logger.warn(`Unsupported platform/arch: ${platform}/${arch}`);
      return null;
    }

    // Try to find bore in binaries/ folder
    // __dirname is web/src/server/services, go up to web/
    const webRoot = path.resolve(__dirname, '..', '..', '..');
    const binaryPath = path.join(webRoot, 'binaries', `bore-${boreTarget}`, 'bore');

    if (fs.existsSync(binaryPath)) {
      logger.debug(`Found bore binary at: ${binaryPath}`);
      return binaryPath;
    }

    logger.debug('Bore binary not found in binaries/, falling back to PATH');
    return 'bore';
  }

  /**
   * Check if bore binary is available
   */
  private async checkBoreBinary(): Promise<string | null> {
    const borePath = this.getBoreBinary();
    if (!borePath) {
      return null;
    }

    try {
      const result = await new Promise<boolean>((resolve) => {
        const proc = spawn(borePath, ['--version'], { stdio: 'ignore' });
        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
        // Timeout after 2 seconds
        setTimeout(() => {
          proc.kill();
          resolve(false);
        }, 2000);
      });
      if (result) {
        logger.debug(`Bore binary verified at: ${borePath}`);
        return borePath;
      }
    } catch {
      // Continue to return null
    }

    return null;
  }

  /**
   * Start bore tunnel
   */
  async start(): Promise<BoreTunnel> {
    if (this.isActive) {
      logger.warn('Bore tunnel is already running');
      if (this.publicUrl && this.publicPort) {
        return {
          publicUrl: this.publicUrl,
          publicPort: this.publicPort,
        };
      }
    }

    const borePath = await this.checkBoreBinary();
    if (!borePath) {
      throw new Error(
        'bore binary not found. Please install bore or run: npm run download-bore'
      );
    }

    // Build bore command arguments
    const serverHost = this.config.serverHost || 'bore.pub';
    const args = ['local', String(this.config.localPort), '--to', serverHost];

    if (this.config.secret) {
      args.push('--secret', this.config.secret);
    }

    logger.log(`Starting bore tunnel: ${this.config.localPort} -> ${serverHost}...`);

    return new Promise((resolve, reject) => {
      this.process = spawn(borePath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let startupTimeout: NodeJS.Timeout;
      let resolved = false;

      const cleanup = () => {
        if (startupTimeout) clearTimeout(startupTimeout);
      };

      const handleOutput = (data: Buffer) => {
        const output = data.toString();
        logger.debug('Bore output:', output);

        // Parse bore output - looking for "listening at bore.pub:12345"
        // Example: "listening at bore.pub:54321"
        const match = output.match(/listening at ([^:]+):(\d+)/);
        if (match && !resolved) {
          resolved = true;
          const host = match[1];
          const port = Number.parseInt(match[2], 10);

          // Construct HTTPS URL (bore servers typically use HTTPS on 443)
          // If the server uses a custom port, include it
          this.publicUrl = port === 443 ? `https://${host}` : `https://${host}:${port}`;
          this.publicPort = port;
          this.isActive = true;

          cleanup();
          logger.log(`Bore tunnel started: ${this.publicUrl}`);
          resolve({
            publicUrl: this.publicUrl,
            publicPort: this.publicPort,
          });
        }
      };

      this.process.stdout?.on('data', handleOutput);
      this.process.stderr?.on('data', (data) => {
        const output = data.toString();
        logger.debug('Bore stderr:', output);
        // Also check stderr for the listening message
        handleOutput(data);
      });

      this.process.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          this.isActive = false;
          cleanup();
          reject(new Error(`Failed to start bore: ${error.message}`));
        }
      });

      this.process.on('close', (code) => {
        this.isActive = false;
        this.publicUrl = null;
        this.publicPort = null;
        if (code !== 0 && code !== null) {
          logger.error(`Bore process exited with code ${code}`);
        }
      });

      // Timeout if tunnel doesn't start within 30 seconds
      startupTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.stop().catch(() => {});
          reject(new Error('Bore startup timeout - tunnel failed to start within 30 seconds'));
        }
      }, 30000);
    });
  }

  /**
   * Stop bore tunnel
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    logger.log('Stopping bore tunnel...');

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const killTimeout = setTimeout(() => {
        if (this.process) {
          logger.warn('Bore process did not exit gracefully, forcing kill');
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.process.on('close', () => {
        clearTimeout(killTimeout);
        this.process = null;
        this.publicUrl = null;
        this.publicPort = null;
        this.isActive = false;
        logger.log('Bore tunnel stopped');
        resolve();
      });

      this.process.kill('SIGTERM');
    });
  }

  /**
   * Check if tunnel is running
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get public URL if available
   */
  getPublicUrl(): string | null {
    return this.publicUrl;
  }

  /**
   * Get public port if available
   */
  getPublicPort(): number | null {
    return this.publicPort;
  }
}

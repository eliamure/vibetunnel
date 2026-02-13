import { type ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoreService } from './bore-service.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

describe('BoreService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts a tunnel and parses the public URL', async () => {
    const processMock = new MockChildProcess();
    vi.mocked(spawn).mockReturnValue(processMock as unknown as ChildProcess);

    const service = new BoreService({
      localPort: 4020,
      serverHost: 'bore.pub',
      secret: 'test-secret',
    });

    // Mock the checkBoreBinary method
    const serviceWithBinaryCheck = service as unknown as {
      checkBoreBinary: () => Promise<string | null>;
    };
    serviceWithBinaryCheck.checkBoreBinary = vi.fn().mockResolvedValue('/usr/bin/bore');

    const startPromise = service.start();

    setImmediate(() => {
      processMock.stdout.emit('data', Buffer.from('listening at bore.pub:54321\n'));
    });

    const tunnel = await startPromise;

    expect(tunnel.publicUrl).toBe('https://bore.pub:54321');
    expect(tunnel.publicPort).toBe(54321);
    expect(service.isRunning()).toBe(true);

    const [command, args] = vi.mocked(spawn).mock.calls[0];
    expect(command).toBe('/usr/bin/bore');
    expect(args).toEqual(
      expect.arrayContaining(['local', '4020', '--to', 'bore.pub', '--secret', 'test-secret'])
    );
  });

  it('handles bore output on port 443', async () => {
    const processMock = new MockChildProcess();
    vi.mocked(spawn).mockReturnValue(processMock as unknown as ChildProcess);

    const service = new BoreService({
      localPort: 4020,
    });

    const serviceWithBinaryCheck = service as unknown as {
      checkBoreBinary: () => Promise<string | null>;
    };
    serviceWithBinaryCheck.checkBoreBinary = vi.fn().mockResolvedValue('bore');

    const startPromise = service.start();

    setImmediate(() => {
      processMock.stdout.emit('data', Buffer.from('listening at bore.pub:443\n'));
    });

    const tunnel = await startPromise;

    // Port 443 should not be included in URL
    expect(tunnel.publicUrl).toBe('https://bore.pub');
    expect(tunnel.publicPort).toBe(443);
  });

  it('throws error when bore binary is not found', async () => {
    const service = new BoreService({
      localPort: 4020,
    });

    const serviceWithBinaryCheck = service as unknown as {
      checkBoreBinary: () => Promise<string | null>;
    };
    serviceWithBinaryCheck.checkBoreBinary = vi.fn().mockResolvedValue(null);

    await expect(service.start()).rejects.toThrow('bore binary not found');
  });

  it('stops the tunnel gracefully', async () => {
    const processMock = new MockChildProcess();
    vi.mocked(spawn).mockReturnValue(processMock as unknown as ChildProcess);

    const service = new BoreService({
      localPort: 4020,
    });

    const serviceWithBinaryCheck = service as unknown as {
      checkBoreBinary: () => Promise<string | null>;
    };
    serviceWithBinaryCheck.checkBoreBinary = vi.fn().mockResolvedValue('bore');

    const startPromise = service.start();

    setImmediate(() => {
      processMock.stdout.emit('data', Buffer.from('listening at bore.pub:54321\n'));
    });

    await startPromise;

    const stopPromise = service.stop();

    setImmediate(() => {
      processMock.emit('close', 0);
    });

    await stopPromise;

    expect(processMock.kill).toHaveBeenCalledWith('SIGTERM');
    expect(service.isRunning()).toBe(false);
    expect(service.getPublicUrl()).toBeNull();
  });
});

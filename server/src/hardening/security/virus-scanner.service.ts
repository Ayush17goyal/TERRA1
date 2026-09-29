import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { loadEnvironment } from '../config/environment';

export interface VirusScanResult { clean: boolean; engine: string; details: string }

@Injectable()
export class VirusScannerService {
  private readonly env = loadEnvironment();

  async scanBuffer(buffer: Buffer, fileName: string): Promise<VirusScanResult> {
    if (this.env.VIRUS_SCAN_MODE === 'off') return { clean: true, engine: 'disabled', details: 'Virus scanning disabled by configuration.' };
    if (!this.env.VIRUS_SCAN_COMMAND) {
      if (this.env.VIRUS_SCAN_MODE === 'required') throw new ServiceUnavailableException('Virus scanner is not configured.');
      return { clean: true, engine: 'not_configured', details: 'Scanner not configured; optional scan skipped.' };
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'upload.bin';
    const tempPath = join(tmpdir(), `legatrixon-scan-${randomUUID()}-${safeName}`);
    await fs.writeFile(tempPath, buffer, { mode: 0o600 });
    try {
      const result = await this.runScanner(tempPath);
      return { clean: result.exitCode === 0, engine: this.env.VIRUS_SCAN_COMMAND, details: result.output.slice(0, 2000) };
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }

  private runScanner(filePath: string): Promise<{ exitCode: number; output: string }> {
    const [command, ...args] = this.env.VIRUS_SCAN_COMMAND.split(' ').filter(Boolean);
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...args, filePath], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let output = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Virus scan timed out')); }, 30000);
      child.stdout.on('data', (data) => { output += data.toString('utf8'); });
      child.stderr.on('data', (data) => { output += data.toString('utf8'); });
      child.on('error', reject);
      child.on('close', (exitCode) => { clearTimeout(timer); resolve({ exitCode: exitCode ?? 1, output }); });
    });
  }
}

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirusScannerService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const crypto_1 = require("crypto");
const environment_1 = require("../config/environment");
let VirusScannerService = class VirusScannerService {
    constructor() {
        this.env = (0, environment_1.loadEnvironment)();
    }
    async scanBuffer(buffer, fileName) {
        if (this.env.VIRUS_SCAN_MODE === 'off')
            return { clean: true, engine: 'disabled', details: 'Virus scanning disabled by configuration.' };
        if (!this.env.VIRUS_SCAN_COMMAND) {
            if (this.env.VIRUS_SCAN_MODE === 'required')
                throw new common_1.ServiceUnavailableException('Virus scanner is not configured.');
            return { clean: true, engine: 'not_configured', details: 'Scanner not configured; optional scan skipped.' };
        }
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'upload.bin';
        const tempPath = (0, path_1.join)((0, os_1.tmpdir)(), `legatrixon-scan-${(0, crypto_1.randomUUID)()}-${safeName}`);
        await fs_1.promises.writeFile(tempPath, buffer, { mode: 0o600 });
        try {
            const result = await this.runScanner(tempPath);
            return { clean: result.exitCode === 0, engine: this.env.VIRUS_SCAN_COMMAND, details: result.output.slice(0, 2000) };
        }
        finally {
            await fs_1.promises.unlink(tempPath).catch(() => undefined);
        }
    }
    runScanner(filePath) {
        const [command, ...args] = this.env.VIRUS_SCAN_COMMAND.split(' ').filter(Boolean);
        return new Promise((resolve, reject) => {
            const child = (0, child_process_1.spawn)(command, [...args, filePath], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
            let output = '';
            const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Virus scan timed out')); }, 30000);
            child.stdout.on('data', (data) => { output += data.toString('utf8'); });
            child.stderr.on('data', (data) => { output += data.toString('utf8'); });
            child.on('error', reject);
            child.on('close', (exitCode) => { clearTimeout(timer); resolve({ exitCode: exitCode ?? 1, output }); });
        });
    }
};
exports.VirusScannerService = VirusScannerService;
exports.VirusScannerService = VirusScannerService = __decorate([
    (0, common_1.Injectable)()
], VirusScannerService);
//# sourceMappingURL=virus-scanner.service.js.map
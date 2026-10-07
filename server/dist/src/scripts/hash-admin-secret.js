"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const process_1 = require("process");
const fs_1 = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const admin_credentials_1 = require("../security/admin-credentials");
function stopReading() {
    process_1.stdin.pause();
    process_1.stdin.unref?.();
}
async function readHiddenPair() {
    if (!process_1.stdin.isTTY || typeof process_1.stdin.setRawMode !== 'function') {
        throw new Error('Interactive hidden input is unavailable. Use --password-stdin and provide newline-separated values.');
    }
    process_1.stdout.write('Enter the new admin secret: ');
    process_1.stdin.setRawMode(true);
    process_1.stdin.setEncoding('utf8');
    process_1.stdin.resume();
    return new Promise((resolve, reject) => {
        const values = ['', ''];
        let index = 0;
        const onData = (chunk) => {
            for (const character of chunk) {
                if (character === '\u0003') {
                    cleanup();
                    reject(new Error('Cancelled.'));
                    return;
                }
                if (character === '\r' || character === '\n') {
                    process_1.stdout.write('\n');
                    if (index === 0) {
                        index = 1;
                        process_1.stdout.write('Enter it again: ');
                    }
                    else {
                        cleanup();
                        resolve([values[0], values[1]]);
                    }
                    return;
                }
                if (character === '\u0008' || character === '\u007f')
                    values[index] = values[index].slice(0, -1);
                else if (character >= ' ')
                    values[index] += character;
            }
        };
        const cleanup = () => { process_1.stdin.off('data', onData); process_1.stdin.setRawMode(false); };
        process_1.stdin.on('data', onData);
    });
}
async function readPipedValues() {
    let input = '';
    for await (const chunk of process_1.stdin)
        input += chunk;
    return input.replace(/\r/g, '').split('\n').filter((value, index, values) => value || index < values.length - 1);
}
async function writeDevelopmentHash(encodedHash) {
    const envPath = path.resolve(process.cwd(), '.env');
    const original = await fs_1.promises.readFile(envPath, 'utf8').catch(() => 'NODE_ENV=development\n');
    const parsed = dotenv.parse(original);
    if ((parsed.NODE_ENV || process.env.NODE_ENV || 'development') === 'production') {
        throw new Error('--update-dev-env is disabled when NODE_ENV=production. Update the production secret store instead.');
    }
    let updated = original.replace(/^ADMIN_PORTAL_PASSWORD=.*(?:\r?\n|$)/m, '');
    if (/^ADMIN_PORTAL_PASSWORD_HASH=/m.test(updated)) {
        updated = updated.replace(/^ADMIN_PORTAL_PASSWORD_HASH=.*$/m, `ADMIN_PORTAL_PASSWORD_HASH=${encodedHash}`);
    }
    else {
        updated = `${updated.replace(/\s*$/, '\n')}ADMIN_PORTAL_PASSWORD_HASH=${encodedHash}\n`;
    }
    await fs_1.promises.writeFile(envPath, updated, { encoding: 'utf8', mode: 0o600 });
    process_1.stdout.write('Updated ignored server/.env with ADMIN_PORTAL_PASSWORD_HASH and removed legacy plaintext ADMIN_PORTAL_PASSWORD.\n');
}
async function main() {
    const args = new Set(process.argv.slice(2));
    const piped = args.has('--password-stdin') ? await readPipedValues() : [];
    const interactive = args.has('--password-stdin') ? null : await readHiddenPair();
    const secret = args.has('--password-stdin') ? (piped[0] || '') : interactive[0];
    const confirmation = args.has('--password-stdin') ? (piped[1] || '') : interactive[1];
    if (secret !== confirmation)
        throw new Error('The values did not match.');
    const encodedHash = (0, admin_credentials_1.hashAdminSecret)(secret);
    if (!(0, admin_credentials_1.verifyAdminSecret)(secret, encodedHash))
        throw new Error('Generated hash failed its verification self-test.');
    if (args.has('--update-dev-env')) {
        await writeDevelopmentHash(encodedHash);
    }
    else {
        process_1.stdout.write(`\n${encodedHash}\n`);
        process_1.stdout.write('Store this hash as ADMIN_PORTAL_PASSWORD_HASH. Do not store the plaintext.\n');
    }
    await new Promise((resolve) => process_1.stdout.write('Password-to-hash verification passed.\n', () => resolve()));
    stopReading();
    process.exit(0);
}
main().catch((error) => { stopReading(); console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
//# sourceMappingURL=hash-admin-secret.js.map
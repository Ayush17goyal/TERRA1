"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const process_1 = require("process");
const readline_1 = require("readline");
async function readHidden(label) {
    process_1.stdout.write(label);
    (0, readline_1.emitKeypressEvents)(process_1.stdin);
    process_1.stdin.setRawMode(true);
    process_1.stdin.resume();
    return new Promise((resolve, reject) => {
        let value = '';
        const onKey = (chunk, key) => {
            if (key?.ctrl && key?.name === 'c') {
                cleanup();
                reject(new Error('Cancelled.'));
                return;
            }
            if (key?.name === 'return' || key?.name === 'enter') {
                cleanup();
                process_1.stdout.write('\n');
                resolve(value);
                return;
            }
            if (key?.name === 'backspace') {
                value = value.slice(0, -1);
                return;
            }
            if (chunk && !key?.ctrl && !key?.meta)
                value += chunk;
        };
        const cleanup = () => { process_1.stdin.off('keypress', onKey); process_1.stdin.setRawMode(false); process_1.stdin.pause(); };
        process_1.stdin.on('keypress', onKey);
    });
}
async function main() {
    if (!process_1.stdin.isTTY)
        throw new Error('Run this command in an interactive terminal.');
    const secret = await readHidden('Enter the new admin secret: ');
    if (secret.length < 14)
        throw new Error('Use at least 14 characters. A password manager-generated value is recommended.');
    const confirmation = await readHidden('Enter it again: ');
    if (secret !== confirmation)
        throw new Error('The values did not match.');
    const salt = (0, crypto_1.randomBytes)(16).toString('hex');
    const hash = (0, crypto_1.scryptSync)(secret, salt, 64).toString('hex');
    process_1.stdout.write(`\nscrypt$${salt}$${hash}\n`);
    process_1.stdout.write('Store this hash as ADMIN_PORTAL_PASSWORD_HASH (or ADMIN_SECURITY_ANSWER_HASH). Do not store the plaintext.\n');
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
//# sourceMappingURL=hash-admin-secret.js.map
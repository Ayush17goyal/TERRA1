import { randomBytes, scryptSync } from 'crypto';
import { stdin, stdout } from 'process';
import { emitKeypressEvents } from 'readline';

async function readHidden(label: string): Promise<string> {
  stdout.write(label);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const onKey = (chunk: string, key: any) => {
      if (key?.ctrl && key?.name === 'c') { cleanup(); reject(new Error('Cancelled.')); return; }
      if (key?.name === 'return' || key?.name === 'enter') { cleanup(); stdout.write('\n'); resolve(value); return; }
      if (key?.name === 'backspace') { value = value.slice(0, -1); return; }
      if (chunk && !key?.ctrl && !key?.meta) value += chunk;
    };
    const cleanup = () => { stdin.off('keypress', onKey); stdin.setRawMode(false); stdin.pause(); };
    stdin.on('keypress', onKey);
  });
}

async function main() {
  if (!stdin.isTTY) throw new Error('Run this command in an interactive terminal.');
  const secret = await readHidden('Enter the new admin secret: ');
  if (secret.length < 14) throw new Error('Use at least 14 characters. A password manager-generated value is recommended.');
  const confirmation = await readHidden('Enter it again: ');
  if (secret !== confirmation) throw new Error('The values did not match.');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(secret, salt, 64).toString('hex');
  stdout.write(`\nscrypt$${salt}$${hash}\n`);
  stdout.write('Store this hash as ADMIN_PORTAL_PASSWORD_HASH (or ADMIN_SECURITY_ANSWER_HASH). Do not store the plaintext.\n');
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

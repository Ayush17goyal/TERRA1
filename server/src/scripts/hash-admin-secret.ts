import { stdin, stdout } from 'process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { hashAdminSecret, verifyAdminSecret } from '../security/admin-credentials';

function stopReading() {
  stdin.pause();
  (stdin as typeof stdin & { unref?: () => void }).unref?.();
}

async function readHiddenPair(): Promise<[string, string]> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Interactive hidden input is unavailable. Use --password-stdin and provide newline-separated values.');
  }
  stdout.write('Enter the new admin secret: ');
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.resume();
  return new Promise((resolve, reject) => {
    const values = ['', ''];
    let index = 0;
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') { cleanup(); reject(new Error('Cancelled.')); return; }
        if (character === '\r' || character === '\n') {
          stdout.write('\n');
          if (index === 0) {
            index = 1;
            stdout.write('Enter it again: ');
          } else {
            cleanup();
            resolve([values[0], values[1]]);
          }
          return;
        }
        if (character === '\u0008' || character === '\u007f') values[index] = values[index].slice(0, -1);
        else if (character >= ' ') values[index] += character;
      }
    };
    const cleanup = () => { stdin.off('data', onData); stdin.setRawMode(false); };
    stdin.on('data', onData);
  });
}

async function readPipedValues(): Promise<string[]> {
  let input = '';
  for await (const chunk of stdin) input += chunk;
  return input.replace(/\r/g, '').split('\n').filter((value, index, values) => value || index < values.length - 1);
}

async function writeDevelopmentHash(encodedHash: string) {
  const envPath = path.resolve(process.cwd(), '.env');
  const original = await fs.readFile(envPath, 'utf8').catch(() => 'NODE_ENV=development\n');
  const parsed = dotenv.parse(original);
  if ((parsed.NODE_ENV || process.env.NODE_ENV || 'development') === 'production') {
    throw new Error('--update-dev-env is disabled when NODE_ENV=production. Update the production secret store instead.');
  }
  let updated = original.replace(/^ADMIN_PORTAL_PASSWORD=.*(?:\r?\n|$)/m, '');
  if (/^ADMIN_PORTAL_PASSWORD_HASH=/m.test(updated)) {
    updated = updated.replace(/^ADMIN_PORTAL_PASSWORD_HASH=.*$/m, `ADMIN_PORTAL_PASSWORD_HASH=${encodedHash}`);
  } else {
    updated = `${updated.replace(/\s*$/, '\n')}ADMIN_PORTAL_PASSWORD_HASH=${encodedHash}\n`;
  }
  await fs.writeFile(envPath, updated, { encoding: 'utf8', mode: 0o600 });
  stdout.write('Updated ignored server/.env with ADMIN_PORTAL_PASSWORD_HASH and removed legacy plaintext ADMIN_PORTAL_PASSWORD.\n');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const piped = args.has('--password-stdin') ? await readPipedValues() : [];
  const interactive = args.has('--password-stdin') ? null : await readHiddenPair();
  const secret = args.has('--password-stdin') ? (piped[0] || '') : interactive![0];
  const confirmation = args.has('--password-stdin') ? (piped[1] || '') : interactive![1];
  if (secret !== confirmation) throw new Error('The values did not match.');
  const encodedHash = hashAdminSecret(secret);
  if (!verifyAdminSecret(secret, encodedHash)) throw new Error('Generated hash failed its verification self-test.');
  if (args.has('--update-dev-env')) {
    await writeDevelopmentHash(encodedHash);
  } else {
    stdout.write(`\n${encodedHash}\n`);
    stdout.write('Store this hash as ADMIN_PORTAL_PASSWORD_HASH. Do not store the plaintext.\n');
  }
  await new Promise<void>((resolve) => stdout.write('Password-to-hash verification passed.\n', () => resolve()));
  stopReading();
  process.exit(0);
}

main().catch((error) => { stopReading(); console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });

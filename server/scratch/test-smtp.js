const net = require('net');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env variables
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

console.log('SMTP Config:');
console.log('Host:', host);
console.log('Port:', port);
console.log('User:', user);
console.log('Pass:', pass ? '*** (length: ' + pass.length + ')' : 'undefined');

if (!host || !user || !pass) {
  console.error('Error: SMTP variables missing in env.');
  process.exit(1);
}

function testSmtp() {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host);
    let buffer = '';
    let step = 0;
    let tlsActive = false;
    let upgradedSocket = null;

    const logAndSend = (cmd) => {
      console.log('C:', cmd);
      const activeSock = upgradedSocket || socket;
      activeSock.write(`${cmd}\r\n`);
    };

    const onData = (data) => {
      buffer += data.toString();
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      if (!last || /^\d{3}-/.test(last)) return;
      buffer = '';
      console.log('S:', last);

      if (/^[45]/.test(last)) {
        console.error('S ERROR: SMTP returned failure code:', last);
        socket.destroy();
        if (upgradedSocket) upgradedSocket.destroy();
        reject(new Error(`SMTP error: ${last}`));
        return;
      }

      switch (step++) {
        case 0:
          logAndSend(`EHLO ${host}`);
          break;
        case 1:
          if (tlsActive) {
            logAndSend('AUTH LOGIN');
          } else {
            logAndSend('STARTTLS');
          }
          break;
        case 2:
          if (tlsActive) {
            logAndSend(Buffer.from(user).toString('base64'));
          } else {
            console.log('Upgrading to TLS...');
            const upgraded = tls.connect({ socket, servername: host }, () => {
              console.log('TLS handshake completed.');
              buffer = '';
              tlsActive = true;
              step = 1;
              logAndSend(`EHLO ${host}`);
            });
            
            socket.removeAllListeners('data');
            upgraded.on('data', onData);
            upgraded.on('error', (err) => {
              console.error('TLS socket error:', err);
              reject(err);
            });
            upgradedSocket = upgraded;
          }
          break;
        case 3:
          logAndSend(Buffer.from(pass).toString('base64'));
          break;
        case 4:
          logAndSend(`MAIL FROM:<${user}>`);
          break;
        case 5:
          logAndSend(`RCPT TO:<${user}>`);
          break;
        case 6:
          logAndSend('DATA');
          break;
        case 7:
          logAndSend('Subject: Test SMTP connection\r\n\r\nHello from test script!\r\n.');
          break;
        case 8:
          logAndSend('QUIT');
          resolve();
          break;
      }
    };

    socket.setTimeout(10000, () => {
      console.error('Timeout');
      socket.destroy();
      if (upgradedSocket) upgradedSocket.destroy();
      reject(new Error('Timeout'));
    });
    socket.on('data', onData);
    socket.on('error', (err) => {
      console.error('Socket error:', err);
      reject(err);
    });
  });
}

testSmtp()
  .then(() => {
    console.log('SMTP test finished successfully.');
  })
  .catch((err) => {
    console.error('SMTP test failed:', err.message);
  });

const { createClerkClient } = require('@clerk/backend');
require('dotenv').config();

async function test() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  console.log('Secret Key length:', secretKey ? secretKey.length : 'none');
  if (!secretKey) {
    console.error('CLERK_SECRET_KEY is not defined in .env');
    return;
  }
  
  const clerk = createClerkClient({ secretKey });
  try {
    const users = await clerk.users.getUserList({ limit: 5 });
    console.log('Successfully connected to Clerk! Number of users found:', users.data.length);
    console.log('Users:', users.data.map(u => ({ id: u.id, email: u.emailAddresses[0]?.emailAddress })));
  } catch (err) {
    console.error('Failed to connect to Clerk:', err.message || err);
  }
}

test();

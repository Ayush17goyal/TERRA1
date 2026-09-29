const axios = require('axios');

async function check() {
  try {
    const res = await axios.get('http://localhost:4000/health');
    console.log('STATUS:', res.status);
    console.log(JSON.stringify(res.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.log('STATUS:', error.response.status);
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

check();

// Test the contacts API endpoint directly
const https = require('https');

async function testContactsAPI() {
  console.log('Testing contacts API endpoint...\n');

  // First, let's check with curl to see the raw response
  const { exec } = require('child_process');

  exec('curl -s https://claude-wootestnew-api.lilboo.workers.dev/api/v1/contacts -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlMjg0ZjczMS1hYTBjLTRmYTAtYjA1Yy01YzFhNTJkYTA2OWIiLCJjb21wYW55SWQiOiJhNGRjYzZiMC02MzA0LTQ1YzQtYmI5Yy01ZWJkZmQ1OTBmNmYiLCJpYXQiOjE3NjE3MTY3NTIsImV4cCI6MTc2MTgwMzE1Mn0.QW0l0Qoz8v9F0ZKcxQ_OQq3bTm4EbIqQF2DZmyHdg0E"', (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('API Response:');
    console.log(stdout);

    try {
      const data = JSON.parse(stdout);
      if (data.success && data.data && data.data.contacts) {
        console.log(`\n✅ Found ${data.data.contacts.length} contacts`);
        data.data.contacts.forEach((contact, i) => {
          console.log(`\n${i + 1}. ${contact.name || 'Unknown'}`);
          console.log(`   Phone: ${contact.phoneNumber}`);
          console.log(`   Calls: ${contact.callCount}`);
          console.log(`   Conversations: ${contact.conversationCount}`);
        });
      } else {
        console.log('\n❌ Unexpected response structure:', data);
      }
    } catch (e) {
      console.error('\n❌ Failed to parse JSON:', e.message);
    }
  });
}

testContactsAPI();

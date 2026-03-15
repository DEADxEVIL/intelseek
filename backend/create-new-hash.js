const bcrypt = require('bcryptjs');

async function testLogin() {
    // The password you're typing
    const inputPassword = 'Owner@123';
    
    // Get the hash from database (you'll need to run this and paste the hash)
    console.log('STEP 1: First, get the current hash from database');
    console.log('Run this in MySQL:');
    console.log('SELECT password_hash FROM users WHERE username = "owner";');
    console.log('\nSTEP 2: Then run this script again with the hash');
    
    // For now, let's create a NEW hash
    const newHash = await bcrypt.hash(inputPassword, 10);
    console.log('\n✅ NEW HASH CREATED:');
    console.log(newHash);
    console.log('\nCopy this MySQL command:');
    console.log(UPDATE users SET password_hash = '' WHERE username = 'owner';);
}

testLogin();

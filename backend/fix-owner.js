const bcrypt = require('bcryptjs');

async function createUser() {
    const hash = await bcrypt.hash('Owner@123', 10);
    console.log('=================================');
    console.log('NEW HASH:');
    console.log(hash);
    console.log('=================================');
    console.log('\n📋 COPY THIS EXACT COMMAND:\n');
    console.log("INSERT INTO users (username, password_hash, role) VALUES ('owner', '" + hash + "', 'owner');");
}

createUser();
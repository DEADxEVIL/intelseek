const bcrypt = require('bcryptjs');

async function createOwner() {
    const hash = await bcrypt.hash('Owner@123', 10);
    console.log('=== NEW HASH ===');
    console.log(hash);
    console.log('\\n=== MySQL COMMAND ===');
    console.log(INSERT INTO users (username, password_hash, role) VALUES ('owner', '', 'owner'););
}

createOwner();

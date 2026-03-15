const bcrypt = require('bcryptjs');

async function resetOwner() {
    const hash = await bcrypt.hash('Owner@123', 10);
    console.log('=================================');
    console.log('NEW HASH:');
    console.log(hash);
    console.log('=================================');
    console.log('\nMYSQL UPDATE COMMAND:');
    console.log("UPDATE users SET password_hash = '" + hash + "' WHERE username = 'owner';");
    console.log('\nMYSQL INSERT COMMAND:');
    console.log("INSERT INTO users (username, password_hash, role) VALUES ('owner', '" + hash + "', 'owner');");
}

resetOwner();

const bcrypt = require('bcryptjs');

async function fixPassword() {
    const password = 'Owner@123';
    const hash = await bcrypt.hash(password, 10);
    console.log('Password:', password);
    console.log('Hash:', hash);
    
    // Print the MySQL command correctly
    console.log('\\nCopy this MySQL command:');
    console.log("UPDATE users SET password_hash = '" + hash + "' WHERE username = 'owner';");
}

fixPassword();

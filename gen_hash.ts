
import bcrypt from 'bcryptjs';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync('admin', salt);
console.log('Hash for admin:', hash);

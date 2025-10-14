// CommonJS wrapper for connect-pg-simple (doesn't support ESM)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const connectPgSimple = require('connect-pg-simple');

export default connectPgSimple;

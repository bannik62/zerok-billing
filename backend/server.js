import { app } from './app.js';
import { env } from './config/env.js';
import { log } from './lib/logger.js';

const PORT = env.PORT;

log('[zerok-billing] listening on port', PORT);

app.listen(PORT, () => {
  log(`[zerok-billing] Backend listening on port ${PORT} → http://localhost:${PORT}`);
  log('[zerok-billing] Routes: GET /api/auth/csrf-token, /api/auth/me, /api/health, etc.');
});

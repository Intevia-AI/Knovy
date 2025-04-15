import { GeminiProxyServer } from '../app/api/ai/proxy';

const PORT = 8080;

const proxyServer = new GeminiProxyServer(PORT);
console.log(`[Proxy] Server started on port ${PORT}`); 
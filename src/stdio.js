#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRishaClaudeServer, MAX_STDIN_BUFFER } from './server.js';

const transport = new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: MAX_STDIN_BUFFER });
const server = createRishaClaudeServer();
// Safe operational errors only. stdout remains reserved for official MCP JSON-RPC.
server.server.onerror = () => { process.stderr.write('Risha MCP could not process a protocol message.\n'); };
await server.connect(transport);
process.stdin.once('end', () => { server.close().catch(() => {}); });

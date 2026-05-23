#!/usr/bin/env node
/**
 * Local dev proxy for Firestore REST API.
 *
 * The iOS simulator cannot reach firestore.googleapis.com directly,
 * but CAN reach localhost. This proxy runs on localhost:9199 and
 * forwards requests to the Firestore REST API.
 *
 * Usage: node scripts/firestore-proxy.js
 */
const http = require('http');
const https = require('https');

const PORT = 9199;
const FIRESTORE_HOST = 'firestore.googleapis.com';
const PROJECT = 'masscoms';
const BASE_PATH = `/v1/projects/${PROJECT}/databases/(default)/documents`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const targetPath = BASE_PATH + req.url;
  console.log(`[proxy] ${req.method} ${req.url} -> ${FIRESTORE_HOST}${targetPath}`);

  const headers = { ...req.headers, host: FIRESTORE_HOST };
  delete headers['connection'];

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const options = {
      hostname: FIRESTORE_HOST,
      port: 443,
      path: targetPath,
      method: req.method,
      headers,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      console.log(`[proxy] <- ${proxyRes.statusCode} ${req.url}`);
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[proxy] ERROR ${req.url}:`, err.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: err.message }));
    });

    if (body) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[proxy] Firestore REST proxy running on http://0.0.0.0:${PORT}`);
  console.log(`[proxy] Forwarding to https://${FIRESTORE_HOST}${BASE_PATH}`);
});

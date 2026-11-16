#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');

const DEFAULT_API = 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 10_000;

function usage() {
  return [
    'Usage:',
    '  snip add <url>    Create a short link',
    '  snip ls           List all links',
    '  snip open <code>  Open a short link in your browser',
    '  snip help         Show this help',
  ].join('\n');
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function requestApi(apiBase, path, options = {}) {
  let response;
  try {
    response = await fetch(new URL(path, apiBase), {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error && error.name === 'TimeoutError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
    }
    throw new Error(`Could not reach the Snip API at ${apiBase}: ${errorMessage(error)}`);
  }
  return response;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error(`The API returned invalid JSON (HTTP ${response.status}).`);
  }
}

function apiError(payload, status) {
  const detail = payload && typeof payload.error === 'string' ? payload.error : `HTTP ${status}`;
  return new Error(`API error: ${detail}`);
}

function validateUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Provide a valid http or https URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('Only http and https URLs are supported.');
  }
}

function validateLink(link) {
  if (
    !link ||
    typeof link.code !== 'string' ||
    typeof link.url !== 'string' ||
    !Number.isFinite(link.hits)
  ) {
    throw new Error('The API returned a link with an invalid shape.');
  }
}

async function addLink(apiBase, value, stdout) {
  validateUrl(value);
  const response = await requestApi(apiBase, '/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: value }),
  });
  const payload = await readJson(response);
  if (response.status !== 201) {
    throw apiError(payload, response.status);
  }
  if (!payload || typeof payload.shortUrl !== 'string') {
    throw new Error('The API response did not include a short URL.');
  }
  stdout.write(`${payload.shortUrl}\n`);
}

async function listLinks(apiBase, stdout) {
  const response = await requestApi(apiBase, '/api/links');
  const links = await readJson(response);
  if (!response.ok) {
    throw apiError(links, response.status);
  }
  if (!Array.isArray(links)) {
    throw new Error('The API returned an invalid links list.');
  }
  if (links.length === 0) {
    stdout.write('No links yet.\n');
    return;
  }
  links.forEach(validateLink);

  const rows = links.map(({ code, hits, url }) => [code, String(hits), url]);
  const widths = [
    Math.max(4, ...rows.map(([code]) => code.length)),
    Math.max(4, ...rows.map(([, hits]) => hits.length)),
  ];
  const formatRow = ([code, hits, url]) =>
    `${code.padEnd(widths[0])}  ${hits.padStart(widths[1])}  ${url}`;
  stdout.write(`${formatRow(['CODE', 'HITS', 'URL'])}\n`);
  stdout.write(`${'-'.repeat(widths[0])}  ${'-'.repeat(widths[1])}  ${'-'.repeat(3)}\n`);
  rows.forEach((row) => stdout.write(`${formatRow(row)}\n`));
}

function openInBrowser(targetUrl) {
  let command;
  let args;
  let env = process.env;
  if (process.platform === 'win32') {
    command = 'powershell.exe';
    args = ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process -FilePath $env:SNIP_OPEN_URL'];
    env = { ...process.env, SNIP_OPEN_URL: targetUrl };
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [targetUrl];
  } else {
    command = 'xdg-open';
    args = [targetUrl];
  }

  return new Promise((resolve, reject) => {
    const processHandle = childProcess.spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env,
    });
    processHandle.once('error', reject);
    processHandle.once('spawn', resolve);
    processHandle.unref();
  });
}

async function openLink(apiBase, code, stdout) {
  if (!/^[A-Za-z0-9]{6}$/.test(code)) {
    throw new Error('Provide a valid six-character short code.');
  }
  const response = await requestApi(apiBase, `/${encodeURIComponent(code)}`, {
    redirect: 'manual',
  });
  if (response.status === 404) {
    throw new Error(`No link found for code "${code}".`);
  }
  const location = response.headers.get('location');
  if (response.status < 300 || response.status >= 400 || !location) {
    throw new Error(`The API did not return a redirect for code "${code}" (HTTP ${response.status}).`);
  }

  let target;
  try {
    target = new URL(location, apiBase);
  } catch {
    throw new Error('The API returned an invalid redirect target.');
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('The API returned an unsupported redirect target.');
  }
  await openInBrowser(target.href);
  stdout.write(`Opened ${target.href}\n`);
}

async function run(argv = process.argv.slice(2), streams = { stdout: process.stdout, stderr: process.stderr }) {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    streams.stdout.write(`${usage()}\n`);
    return 0;
  }

  const apiBase = process.env.SNIP_API || DEFAULT_API;
  try {
    if (command === 'add' && args.length === 1) {
      await addLink(apiBase, args[0], streams.stdout);
    } else if (command === 'ls' && args.length === 0) {
      await listLinks(apiBase, streams.stdout);
    } else if (command === 'open' && args.length === 1) {
      await openLink(apiBase, args[0], streams.stdout);
    } else {
      throw new Error(`Invalid command or arguments.\n${usage()}`);
    }
    return 0;
  } catch (error) {
    streams.stderr.write(`Error: ${errorMessage(error)}\n`);
    return 1;
  }
}

if (require.main === module) {
  run().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

module.exports = { openInBrowser, run };

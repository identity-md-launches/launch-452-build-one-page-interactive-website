import { chromium } from 'playwright';
import { runBrowserChecks } from './browser-checks.mjs';
const baseURL = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch({ ...(process.env.CTM_CHROMIUM_PATH ? { executablePath: process.env.CTM_CHROMIUM_PATH } : {}) });
try {
  const page = await browser.newPage();
  console.log(JSON.stringify(await runBrowserChecks(page, baseURL),null,2));
} finally { await browser.close(); }

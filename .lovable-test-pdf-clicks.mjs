import { chromium } from 'playwright';

const url = 'https://f73d3b52-ac71-4df5-835a-6a9b98a06a92.lovableproject.com/presidente/relazione';
const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium' });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const pdfLogs = [];
const errors = [];
const downloads = [];
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[PDF]')) pdfLogs.push(text);
});
page.on('pageerror', err => errors.push(err.message));
page.on('download', download => downloads.push(download.suggestedFilename()));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
const button = page.getByRole('button', { name: /Genera PDF|Generazione in corso/i }).first();
await button.waitFor({ state: 'visible', timeout: 60000 });
await button.evaluate((el) => {
  for (let i = 0; i < 10; i += 1) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }
});
await page.waitForTimeout(7000);
const toastCount = await page.locator('text=/Relazione PDF generata/i').count().catch(() => -1);
const buttonText = await button.textContent().catch(() => '');
console.log(JSON.stringify({ pdfLogs, downloads, toastCount, buttonText, errors }, null, 2));
await browser.close();

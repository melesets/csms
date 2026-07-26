const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE_URL = 'http://localhost:5173/isbar';
const OUTPUT_DIR = path.join(__dirname, 'images');
const delay = ms => new Promise(r => setTimeout(r, ms));

async function login(page, user = 'admin', pass = 'admin123') {
  await page.goto(`${BASE_URL}/isbar/login`, { waitUntil: 'networkidle2', timeout: 15000 });
  await delay(2000);
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type(user, { delay: 15 });
    await inputs[1].click({ clickCount: 3 });
    await inputs[1].type(pass, { delay: 15 });
    await delay(300);
    const btn = await page.$('button[type="submit"]');
    if (btn) await btn.click();
    else await inputs[1].press('Enter');
    await delay(5000);
  }
}

async function expandSections(page) {
  // Force-expand all collapsible sections by clicking their toggle buttons
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    for (const b of btns) {
      const txt = b.textContent?.trim();
      // Click the small section header buttons (Clinical, Admin)
      if (txt === 'Clinical' || txt === 'Admin' || txt === 'Analytics') {
        b.click();
      }
    }
  });
  await delay(800);
}

async function nav(page, text) {
  // First expand all collapsed sections
  await expandSections(page);

  const found = await page.evaluate((txt) => {
    // Look through all sidebar buttons — they have the label in a <span>
    const btns = Array.from(document.querySelectorAll('button'));
    for (const b of btns) {
      const spans = b.querySelectorAll('span');
      for (const sp of spans) {
        const t = sp.textContent?.trim();
        if (t && t.toLowerCase() === txt.toLowerCase() && b.offsetWidth > 0) {
          b.click();
          return t;
        }
      }
      // Also check direct textContent of the button
      const directText = b.textContent?.trim();
      if (directText && directText.toLowerCase() === txt.toLowerCase() && b.offsetWidth > 0 && b.offsetWidth < 300) {
        b.click();
        return directText;
      }
    }
    return null;
  }, text);
  return found;
}

async function shot(page, name) {
  await delay(3500);
  // Get the actual content height by measuring the main scrollable area
  const contentHeight = await page.evaluate(() => {
    // Find the main content area
    const main = document.querySelector('main');
    if (main) {
      // Temporarily expand to measure true height
      const orig = main.style.cssText;
      main.style.overflow = 'visible';
      main.style.height = 'auto';
      const h = main.scrollHeight;
      main.style.cssText = orig;
      return h + 100; // add header height
    }
    return document.body.scrollHeight;
  });
  // Resize viewport to fit all content
  await page.setViewport({ width: 1440, height: Math.max(900, contentHeight) });
  await delay(300);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`), fullPage: true });
  console.log(`  ✓ ${name}.png (h=${contentHeight})`);
  // Reset viewport for next navigation
  await page.setViewport({ width: 1440, height: 900 });
}

async function capture() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Login page
  console.log('1. Login');
  await page.goto(`${BASE_URL}/isbar/login`, { waitUntil: 'networkidle2', timeout: 15000 });
  await delay(2000);
  await shot(page, '01-login');

  // 2. Login as admin
  console.log('2. Logging in as admin...');
  await login(page, 'admin', 'admin123');
  await delay(2000);

  // Check sidebar items
  const items = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t && t.length < 50 && t.length > 2);
  });
  console.log('  Sidebar items:', [...new Set(items)].join(' | '));

  // 3. Dashboard
  console.log('3. Dashboard');
  await shot(page, '02-dashboard');

  // 4. AI Dashboard
  console.log('4. AI Dashboard');
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => {
      if (b.textContent?.includes('AI Dashboard')) b.click();
    });
  });
  await shot(page, '03-ai-dashboard');

  // 5. Active Staff
  console.log('5. Active Staff');
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => {
      if (b.textContent?.includes('Active Staff')) b.click();
    });
  });
  await shot(page, '04-active-staff');

  // Clinical pages
  const clinical = [
    ['Report', '05-report'],
    ['Department Activity', '06-dept-activity'],
    ['Resources', '07-resources'],
    ['All Records', '08-all-records'],
    ['Analytics', '09-analytics'],
    ['Staff Schedule', '10-staff-schedule'],
  ];

  for (const [text, name] of clinical) {
    console.log(`6+. ${name}`);
    await nav(page, text);
    await shot(page, name);
  }

  // Admin pages - expand Admin section first
  console.log('Expanding Admin section...');
  await expandSections(page);
  // Click Admin section header again to be sure
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    for (const b of btns) {
      const txt = b.textContent?.trim();
      if (txt === 'Admin') {
        // Make sure it's expanded (click to open if collapsed)
        b.click();
      }
    }
  });
  await delay(1000);

  // Check what admin items are visible
  const adminItems = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button'))
      .map(b => ({ text: b.textContent?.trim(), visible: b.offsetWidth > 0, w: b.offsetWidth }))
      .filter(b => b.visible && b.text && b.text.length < 40 && b.text.length > 2);
  });
  console.log('  Visible sidebar items:', adminItems.map(i => i.text).join(' | '));

  const admin = [
    ['Form Builder', '11-form-builder'],
    ['Custom Tabs', '12-custom-tabs'],
    ['Dashboard Mapping', '13-dashboard-mapping'],
    ['Integrations', '14-integrations'],
    ['Check-In Logs', '15-checkin-logs'],
    ['Attendance Reports', '16-attendance'],
    ['User Management', '17-user-mgmt'],
    ['Settings', '18-admin-settings'],
  ];

  for (const [text, name] of admin) {
    console.log(`Admin: ${name}`);
    // Re-expand admin section before each nav in case it collapsed
    await expandSections(page);
    const found = await nav(page, text);
    if (found) {
      await shot(page, name);
    } else {
      console.log(`  RETRY: ${text} not found, trying alternate match...`);
      // Try alternate: match partial text
      const altFound = await page.evaluate((txt) => {
        const btns = Array.from(document.querySelectorAll('button'));
        for (const b of btns) {
          const t = b.textContent?.trim();
          if (t && t.toLowerCase().includes(txt.toLowerCase()) && b.offsetWidth > 0 && b.offsetWidth < 300) {
            b.click();
            return t;
          }
        }
        return null;
      }, text);
      if (altFound) {
        await shot(page, name);
      } else {
        console.log(`  SKIP: ${text} still not found`);
      }
    }
  }

  await browser.close();
  console.log('\nDone!');
}

capture().catch(console.error);

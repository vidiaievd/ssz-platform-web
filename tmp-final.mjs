import { chromium } from '@playwright/test';
const WS='f17c0fb5-7ca6-4760-94d1-e673dd447cce';
const SCHOOL='f3ced490-5f8b-4d04-bd05-45ab1a101ff8';
const SP=process.env.SP;
const browser = await chromium.launch();

// phone, tutor
const page = await browser.newPage({ viewport:{width:390,height:900} });
await page.goto('http://localhost:3000/en/login');
await page.fill('#email','tutor@email.com'); await page.fill('#password','!Password1234');
await page.click('button[type=submit]');
await page.waitForURL((u)=>!u.pathname.endsWith('/login'),{timeout:60000});
await page.goto(`http://localhost:3000/en/w/${WS}/schedule?on=2026-09-14`, { waitUntil:'domcontentloaded', timeout:120000 });
await page.waitForTimeout(7000);
await page.screenshot({ path:`${SP}/97-phone.png`, fullPage:true });
console.log('phone overflow:', await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1));
const text = await page.locator('body').innerText();
console.log('says school:', /school/i.test(text), '| says group:', /\bgroup\b/i.test(text));

// keyboard: the actions menu opens from the keyboard
await page.setViewportSize({ width: 1280, height: 900 });
await page.reload({ waitUntil:'domcontentloaded' });
await page.waitForTimeout(4000);
const menu = page.getByRole('button', { name: /^Actions for/ }).first();
await menu.focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
console.log('menu items via keyboard:', (await page.getByRole('menuitem').count()));
await page.keyboard.press('Escape');

// school side: no Schedule entry in a school's nav
const page2 = await browser.newPage({ viewport:{width:1280,height:900} });
await page2.goto('http://localhost:3000/en/login');
await page2.fill('#email','school@email.com'); await page2.fill('#password','!Password1234');
await page2.click('button[type=submit]');
await page2.waitForURL((u)=>!u.pathname.endsWith('/login'),{timeout:60000});
await page2.goto(`http://localhost:3000/en/w/${SCHOOL}/dashboard`, { waitUntil:'domcontentloaded', timeout:120000 });
await page2.waitForTimeout(5000);
const nav = await page2.locator('nav').first().innerText();
console.log('school nav:', JSON.stringify(nav.replace(/\n+/g,' | ').slice(0,160)));
await browser.close();

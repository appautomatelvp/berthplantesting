const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://berthplantesting.vercel.app/window', { waitUntil: 'networkidle' });
  
  const blocks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.window-block')).map(el => {
      return {
        className: el.className,
        style: el.getAttribute('style'),
        text: el.innerText.split('\n')[0]
      };
    }).slice(0, 5);
  });
  console.log('Blocks on Vercel:', blocks);
  
  await browser.close();
})();

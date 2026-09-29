const assert = {
  equal(actual, expected, message = '') { if (actual !== expected) throw new Error(`${message} Expected ${expected}, received ${actual}`); },
  notEqual(actual, expected) { if (actual === expected) throw new Error('Expected distinct values'); },
  ok(value) { if (!value) throw new Error('Expected a truthy value'); },
  match(value, pattern) { if (!pattern.test(value)) throw new Error(`Expected ${value} to match ${pattern}`); },
};

/** Exercises the committed export; can run in a standalone or provided Playwright browser. */
export async function runBrowserChecks(page, baseURL) {
  const passed = [];
  const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const rpcPattern = /^https:\/\/(ethereum-rpc\.publicnode\.com|eth\.llamarpc\.com)\/?$/;
  const known = { 0: 0, 20000000: 1717281407, 20001000: 1717293443 };
  const requests = [];
  let providerMode = 'success';
  const releases = [];
  const serve = async route => {
    const request = route.request().postDataJSON();
    requests.push(request);
    if (providerMode === 'delayed') await new Promise(resolve => { releases.push(resolve); });
    if (providerMode === 'offline') { await route.fulfill({status:503,body:'Unavailable'}); return; }
    const block = Number(request.params[0]);
    const result = Object.hasOwn(known, block) ? {number:request.params[0],timestamp:`0x${known[block].toString(16)}`,hash:`0x${'a'.repeat(64)}`} : null;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:1,result})});
  };
  await page.route(rpcPattern, serve);
  const submit = async () => {
    await page.locator('form .primary-button').click();
    await page.waitForFunction(() => !document.querySelector('.primary-button').disabled);
  };
  await page.goto(baseURL);
  await page.getByRole('heading', {name:'Every address. A moment in time.'}).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.preview-label').innerText(),'Example preview');
  assert.equal(await page.locator('time').getAttribute('datetime'),'2024-06-01T22:36:47.000Z');
  passed.push('Initial example is explicitly labelled and has a real recorded UTC date');

  await page.locator('#address').fill(''); await page.locator('#blockA').fill('1.5');
  await submit();
  assert.equal(await page.locator('#address').getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('#blockA').getAttribute('aria-invalid'),'true');
  assert.equal(await page.evaluate(() => document.activeElement.id),'address');
  assert.match(await page.locator('.live-message').innerText(),/Check the form/);
  assert.equal(requests.length,0);
  passed.push('Invalid/empty fields focus the first error, expose descriptions, and make no request');

  await page.getByRole('button',{name:'Try an example',exact:true}).click();
  assert.equal(await page.locator('#address').inputValue(), address);
  await page.locator('#blockA').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.preview-label').textContent === 'Snapshot ready');
  assert.match(await page.locator('.live-message').innerText(),/Snapshot ready/);
  assert.ok(requests.every(request => request.method === 'eth_getBlockByNumber' && !JSON.stringify(request).includes(address)));
  passed.push('Example reset and keyboard Enter submit produce a snapshot; address is never sent to RPC');

  const shape = await page.locator('.fingerprint-art g').first().innerHTML();
  await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(baseURL).origin});
  await page.getByRole('button',{name:'Copy ethereum address',exact:true}).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), address);
  await page.getByRole('button',{name:'Copy block number',exact:true}).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '20000000');
  await page.evaluate(() => { window.__originalCopy = navigator.clipboard.writeText; navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied for test'); }; });
  await page.getByRole('button',{name:'Ethereum address copied',exact:true}).click();
  assert.match(await page.locator('.live-message').innerText(), /copy it manually/);
  await page.evaluate(() => { navigator.clipboard.writeText = window.__originalCopy; delete window.__originalCopy; });
  passed.push('Address and raw block number copy to the real clipboard; permission failure has manual recovery');

  await page.locator('#address').fill(address.toLowerCase()); await submit();
  assert.equal(await page.locator('.fingerprint-art g').first().innerHTML(),shape);
  await page.locator('#address').fill('0x000000000000000000000000000000000000001a'); await submit();
  const otherShape = await page.locator('.fingerprint-art g').first().innerHTML();
  await page.locator('#address').fill('0x0000000000000000000000000000000000000028'); await submit();
  assert.notEqual(await page.locator('.fingerprint-art g').first().innerHTML(),otherShape);
  passed.push('Fingerprint is case invariant; formerly colliding addresses now render distinct geometry');

  await page.getByRole('group',{name:'Explorer mode'}).getByRole('button',{name:'Compare blocks'}).click();
  assert.match(await page.locator('.compare-empty').innerText(),/Two blocks/);
  await submit();
  assert.equal(await page.locator('.difference strong').first().innerText(),'1,000');
  assert.equal(await page.locator('.difference strong').last().innerText(),'3 hours, 20 minutes, 36 seconds');
  assert.equal(await page.locator('.preview-label').innerText(),'Comparison ready');
  await page.getByRole('button',{name:'Copy second block number',exact:true}).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()),'20001000');
  await page.locator('#blockA').fill('20001000'); await page.locator('#blockB').fill('20000000'); await submit();
  assert.equal(await page.locator('.difference strong').last().innerText(),'3 hours, 20 minutes, 36 seconds');
  await page.locator('#blockA').fill('20000000'); await submit();
  assert.equal(await page.locator('.difference strong').first().innerText(),'0');
  assert.equal(await page.locator('.difference strong').last().innerText(),'0 seconds');
  passed.push('Comparison empty, success, copy, reversed order and equal blocks show exact differences');

  await page.locator('#blockA').fill('0'); await page.locator('#blockB').fill('0'); await submit();
  assert.equal(await page.locator('time').first().getAttribute('datetime'),'1970-01-01T00:00:00.000Z');
  await page.locator('#blockB').fill('999999999'); await submit();
  assert.match(await page.locator('.request-error').innerText(),/not available yet/);
  assert.equal(await page.locator('.difference strong').last().innerText(),'0 seconds');
  assert.match(await page.locator('.result-caption').innerText(),/Inputs changed/);
  passed.push('Genesis is valid; future blocks show recovery and preserve clearly stale previous results');

  providerMode = 'offline'; await page.locator('#blockB').fill('20000000'); await submit();
  assert.match(await page.locator('.request-error').innerText(),/Check your connection/);
  providerMode = 'success'; await submit();
  assert.equal(await page.locator('.request-error').count(),0);
  passed.push('Total provider outage shows a recoverable error; submitting again recovers');

  providerMode = 'delayed'; await page.locator('form .primary-button').click();
  await page.locator('.loading-message').waitFor();
  assert.equal(await page.locator('.primary-button').isDisabled(),true);
  assert.equal(await page.locator('.result-panel').getAttribute('aria-busy'),'true');
  await page.getByRole('group',{name:'Explorer mode'}).getByRole('button',{name:'Snapshot',exact:true}).click();
  providerMode = 'success'; releases.splice(0).forEach(resolve => resolve());
  assert.equal(await page.locator('.primary-button').isDisabled(),false);
  await submit();
  assert.equal(await page.locator('.snapshot-card').getAttribute('aria-label'),'Snapshot card');
  passed.push('Loading disables repeat submit; changing mode cancels stale work and permits a new request');

  for (const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    const dimensions = await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.equal(dimensions.scroll,dimensions.width,`Overflow at ${width}px`);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(() => { document.documentElement.style.fontSize='32px'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth),1440);
  await page.evaluate(() => { document.documentElement.style.fontSize=''; document.documentElement.dir='rtl'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth),1440);
  await page.evaluate(() => { document.documentElement.dir='ltr'; });
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(() => {const node=document.createElement('span'); node.className='spinner'; document.body.append(node); const animation=getComputedStyle(node).animationName; node.remove();return animation;}),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  passed.push('320/390/768/1024/1440px reflow, 200% text resize, RTL smoke test and reduced-motion styles');

  await page.goto(baseURL);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent),'Skip to content');
  const stops=[];
  for(let i=0;i<12;i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => ({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineStyle,width:parseFloat(getComputedStyle(document.activeElement).outlineWidth)})));
  }
  assert.ok(stops.every(stop=>stop.outline==='solid'&&stop.width>=2));
  passed.push('Keyboard order starts with skip link; next 12 native controls all expose a visible 2px focus ring');
  await page.unroute(rpcPattern,serve);
  return {passed:passed.length,checks:passed,requestCount:requests.length,limitations:['Synthetic RPC responses used in this suite; real PublicNode flow checked separately.','Chromium desktop engine, not native iOS/Android or assistive-technology testing.','200% test changes root text size; native browser zoom remains a separate manual check.']};
}

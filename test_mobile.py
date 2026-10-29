from pathlib import Path
from playwright.sync_api import sync_playwright
from threading import Thread
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os, time, json
root=Path('/mnt/data/The_Little_Kitchen_V8_Exact_Reference')
os.chdir(root)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',8765),Quiet)
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files'])
 context=browser.new_context(viewport={'width':393,'height':852},device_scale_factor=2,is_mobile=True,has_touch=True,service_workers='block')
 page=context.new_page()
 issues=[]
 page.on('pageerror',lambda e:issues.append(str(e)))
 page.on('console',lambda m: issues.append('console '+m.text) if m.type=='error' else None)
 page.goto('file:///mnt/data/The_Little_Kitchen_V8_Exact_Reference/index.html',wait_until='domcontentloaded',timeout=15000)
 page.wait_for_timeout(800)
 def capture(n):
  page.screenshot(path=f'/mnt/data/Little_Kitchen_V8_{n}.png',full_page=True)
  print(n,'scene',page.locator('#tab-scene-img').get_attribute('src'),'image loaded',page.locator('#tab-scene-img').evaluate('(e)=>e.complete && e.naturalWidth>0'), 'screen',page.locator('#screen').bounding_box())
 capture('Groceries')
 page.locator('#grocery-quick-input').fill('Whole milk')
 page.locator('#grocery-quick-form button').click();page.wait_for_timeout(400)
 print('milk visible',page.get_by_text('Whole milk').count())
 page.locator('input[data-action="grocery-toggle"]').first.check();page.wait_for_timeout(220)
 capture('Groceries_Filled')
 for name in ['Recipes','Food','Drinks','Desserts']:
  page.get_by_role('button',name=name,exact=True).first.click();page.wait_for_timeout(270);capture(name)
 # settings via top left button
 page.get_by_role('button',name='Open Settings').click();page.wait_for_timeout(270);capture('Settings')
 print('settings visible',page.get_by_text('Shared cloud').count(), 'nav visible',page.locator('#bottom-nav').is_visible())
 page.get_by_role('button',name='Toggle cute sounds').click();page.wait_for_timeout(100)
 # recipe view
 page.get_by_role('button',name='Back to groceries').count() if False else None
 print('page errors',issues[:15], 'total',len(issues))
 browser.close()
server.shutdown()

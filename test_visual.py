from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,re
root=Path('/mnt/data/The_Little_Kitchen_V8_Exact_Reference')
html=(root/'index.html').read_text()
js=(root/'app.js').read_text()
st=js.index('function openDB()');en=js.index('// Cloud is opt-in.',st)
mockdb='''const __testdb={recipes:[],groceries:[],meta:[],outbox:[]};
function openDB(){return Promise.resolve({});}
function readAll(store){return Promise.resolve(structuredClone(__testdb[store]));}
function rawPut(store,obj){const key=store==='meta'?'key':store==='outbox'?'key':'id';const i=__testdb[store].findIndex(v=>v[key]===obj[key]);if(i>=0)__testdb[store][i]=structuredClone(obj);else __testdb[store].push(structuredClone(obj));return Promise.resolve();}
function rawDel(store,k){const key=store==='meta'?'key':store==='outbox'?'key':'id';__testdb[store]=__testdb[store].filter(v=>v[key]!==k);return Promise.resolve();}
function rawClear(store){__testdb[store]=[];return Promise.resolve();}
'''
js2=js[:st]+mockdb+js[en:]
def data_uri(p):
 f=(root/'assets'/p)
 mime='image/webp' if f.suffix=='.webp' else 'image/png'
 return 'data:'+mime+';base64,'+base64.b64encode(f.read_bytes()).decode()
for nm in ['pumpkin-soup','herb-pasta','chai-latte','spiced-cider','cinnamon-rolls','apple-crumble','strawberry','brownie']:
 js2=js2.replace('./assets/reference-recipe-'+nm+'.webp',data_uri('reference-recipe-'+nm+'.webp'))
a=html.index('<script>\n(() => {');z=html.index('</script>',a);html=html[:a]+'<script>\n'+js2+'\n'+html[z:]
html=html.replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/dist/umd/supabase.min.js"></script>','')
html=html.replace("url('./assets/reference-grocery-bunny.webp')",'url("'+data_uri('reference-grocery-bunny.webp')+'")')
scenes=['grocery','recipes','food','drink','dessert','settings']
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':393,'height':852},device_scale_factor=2,is_mobile=True,has_touch=True)
 issues=[];page.on('pageerror',lambda e:issues.append('ERROR:'+str(e)));page.on('console', lambda m: issues.append('CONSOLE:'+m.text) if m.type=='error' else None)
 page.set_content(html,wait_until='load',timeout=45000)
 page.wait_for_timeout(400)
 print('initial state',page.locator('#screen').inner_text()[:100], 'problems',issues[:5], flush=True)
 def shot(tab):
  data=data_uri('reference-'+tab+'.png')
  page.locator('#tab-scene-img').evaluate('(e,src)=>e.src=src',data)
  page.wait_for_timeout(360)
  page.screenshot(path='/mnt/data/Little_Kitchen_V8_'+tab.title()+'.png',full_page=True)
  print('SHOT',tab,page.locator('.screen').count(),page.locator('main').inner_text()[:48])
 shot('grocery')
 print('form count',page.locator('#grocery-quick-input').count(),flush=True)
 page.locator('#grocery-quick-input').fill('Whole milk')
 page.locator('#grocery-quick-form button').click()
 page.wait_for_timeout(250)
 print('groceries add',page.get_by_text('Whole milk').count())
 page.locator('input[data-action="grocery-toggle"]').first.check()
 print('groceries checked',page.locator('input[data-action="grocery-toggle"]').first.is_checked())
 shot('grocery')
 for tab in ['recipes','food','drink','dessert']:
  page.locator('.nav-btn[data-tab="'+tab+'"]').click()
  shot(tab)
 page.locator('[data-action="settings"]').click()
 shot('settings')
 print('Settings cloud',page.locator('#cloud-login-form').count(),'sounds',page.locator('[data-action="toggle-sounds"]').count())
 page.locator('[data-action="toggle-sounds"]').click()
 page.locator('[data-action="settings-back"]').click()
 page.locator('.recipe-card [data-action="open"]').first.click()
 print('details',page.get_by_text('Cooking steps').count(),page.locator('.step-photo-btn').count())
 page.locator('[data-action="edit"]').first.click()
 print('editor',page.locator('#f-title').count())
 print('errors',issues[:5],len(issues))
 b.close()

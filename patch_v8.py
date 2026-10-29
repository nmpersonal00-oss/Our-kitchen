from pathlib import Path
import re
root=Path('/mnt/data/The_Little_Kitchen_V8_Exact_Reference')
js=(root/'app.js').read_text()
# Only replace original demo illustration URLs; uploaded photos and custom recipes retain their saved images.
redirects={'pumpkin-soup':'pumpkin-soup','herb-pasta':'herb-pasta','chai-latte':'chai-latte','spiced-cider':'spiced-cider','cinnamon-rolls':'cinnamon-rolls','apple-crumble':'apple-crumble','rice-pudding':'strawberry','brownie':'brownie'}
mapping='\n'.join(f" './assets/{name}.svg': './assets/reference-recipe-{target}.webp'," for name,target in redirects.items())
new=f"const REFERENCE_RECIPE_ART={{\n{mapping}\n}};\nconst displayArt = src => REFERENCE_RECIPE_ART[src] || BUNDLED_ART[src] || src;"
old="const displayArt = src => BUNDLED_ART[src] || src;"
assert old in js
js=js.replace(old,new,1)
# exactly the user-provided cleaned scenes, one per tab
start=js.index('function updateTabScene()')
end=js.index('\nfunction openDB()',start)
scene_js='''const REFERENCE_SCENES=Object.freeze({
 grocery:'./assets/reference-grocery.png',
 recipes:'./assets/reference-recipes.png',
 food:'./assets/reference-food.png',
 drink:'./assets/reference-drink.png',
 dessert:'./assets/reference-dessert.png',
 settings:'./assets/reference-settings.png'
});
function updateTabScene(){
 const el=$('#tab-scene-img');
 const scene=tab==='settings'?'settings':tab;
 if(el && el.dataset.scene!==scene){el.dataset.scene=scene;el.src=REFERENCE_SCENES[scene]||REFERENCE_SCENES.recipes;}
 document.getElementById('app')?.setAttribute('data-scene',scene);
}
'''
js=js[:start]+scene_js+js[end:]
# Don't overlay the old flat vector bunny on the user's large, exact reference image.
mini='''<img class="list-bunny-mini" src="${BUNNY_MINIS[isAll?'recipes':tab]||BUNNY_MINIS.recipes}" alt="" aria-hidden="true">'''
assert mini in js
js=js.replace(mini,'',1)
# extra icon only where reference example lacks a matching existing symbol
needle='const icon=(name,size=18)=>'
assert needle in js
js=js.replace(needle,"ICONS.music='<path d=\"M9 18V5l12-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"18\" cy=\"16\" r=\"3\"/>';\n"+needle,1)
# Cloud card follows user-provided Settings EXAMPLE.  Keep form id and action data attributes intact.
start=js.index('function cloudSettings()')
end=js.index('\nfunction setCloudState(',start)
cloud='''function cloudSettings(){return `<section class="glass setting-card lk-cloud-card">
<div class="lk-setting-head"><span class="lk-setting-emblem">${icon('upload',26)}</span><div class="lk-setting-title"><h3>Shared cloud</h3><p id="cloud-status" class="hint" role="status">${esc(cloudLabel())}</p></div></div>
${cloudUser?`<p class="hint">Signed in as ${esc(cloudUser.email||'your shared account')}</p><div class="action-row"><button class="btn small" data-action="cloud-sync">${icon('upload',15)} Sync now</button><button class="btn small secondary" data-action="cloud-logout">Sign out</button></div>`:`<form id="cloud-login-form" autocomplete="on"><label class="form-label" for="cloud-email">EXISTING APP EMAIL</label><input class="form-input" type="email" id="cloud-email" required autocomplete="username" placeholder="Email"><label class="form-label" for="cloud-password">PASSWORD</label><input class="form-input" type="password" id="cloud-password" required autocomplete="current-password" placeholder="Password"><button class="btn" type="submit">${icon('upload',17)} Sign in to shared cloud</button></form>`}
<p class="hint cloud-intro">Uses your existing Closet / multi-app Supabase account. Local changes are queued until synced. Both devices must sign in with the same account.</p>
</section>`;}'''
js=js[:start]+cloud+js[end:]
start=js.index('function settingsView()')
end=js.index('\nfunction renderEditor(',start)
settings='''function settingsView(){return `<div class="eyebrow">PREFERENCES</div><h1 class="page-title">Settings</h1>
${cloudSettings()}
<section class="glass setting-card lk-simple-card"><div class="lk-setting-head"><span class="lk-setting-emblem">${icon('music',26)}</span><div class="lk-setting-title"><h3>Sounds</h3><p class="hint">Cute tap sounds</p></div><button type="button" class="switch ${prefs.sounds?'on':''}" role="switch" aria-checked="${!!prefs.sounds}" data-action="toggle-sounds" aria-label="Toggle cute sounds"></button></div></section>
<section class="glass setting-card"><div class="lk-setting-head"><span class="lk-setting-emblem">${icon('upload',26)}</span><div class="lk-setting-title"><h3>Backups</h3><p class="hint">Export recipes, grocery list, and uploaded photos.</p></div></div><div class="action-row"><button class="btn small" data-action="export">${icon('download')} Export</button><button class="btn small secondary" data-action="import">${icon('upload')} Import</button></div></section>
<section class="glass setting-card"><div class="lk-setting-head"><span class="lk-setting-emblem">${icon('book',26)}</span><div class="lk-setting-title"><h3>Recipes</h3><p class="hint">${recipes.length} recipes saved</p></div></div><div class="setting-row"><strong>Sample recipes</strong><button class="btn small secondary" data-action="restore-demos">Restore samples</button></div><div class="setting-row"><strong>Delete every recipe</strong><button class="btn danger small" data-action="confirm-clear">${icon('trash',15)} Delete all</button></div></section>
<details class="lk-more-settings"><summary>More settings</summary><section class="glass setting-card"><h3>Appearance</h3><div class="setting-row"><div><strong>Ambient glow</strong></div><button class="switch ${prefs.glow?'on':''}" role="switch" aria-checked="${prefs.glow}" aria-label="Toggle ambient glow" data-action="toggle-glow"></button></div><div class="setting-row"><div><strong>Color palette</strong></div><button class="btn small secondary" data-action="toggle-theme">${prefs.theme==='cinnamon'?'Cinnamon':'Maple'}</button></div></section><section class="glass setting-card"><h3>Shopping</h3><label class="form-label" for="settings-budget">Shopping budget ($)</label><div class="inline-form"><input id="settings-budget" class="form-input" type="number" min="0" step="0.01" value="${esc(prefs.budget)}"><button class="btn small" data-action="save-budget">Save</button></div><div class="setting-row"><strong>${groceries.length} grocery items</strong><button class="btn small secondary" data-action="confirm-clear-bought">Remove purchased</button></div><div class="setting-row"><strong>Clear grocery list</strong><button class="btn danger small" data-action="confirm-clear-groceries">Clear list</button></div></section></details>
`;}'''
js=js[:start]+settings+js[end:]
# Remove previous scene from HTML: retain all app interactions in JS.
(root/'app.js').write_text(js)
style=(root/'styles.css').read_text()+'\n\n'+(root/'reference-visual.css').read_text()
(root/'styles.css').write_text(style)
html=(root/'index.html').read_text()
html=re.sub(r'(?<=<style>).*?(?=</style>)',lambda _: '\n'+style+'\n',html,count=1,flags=re.S)
html=re.sub(r'(?<=<script>\n\(\(\) => \{).*?(?=</script>)',lambda _: js[len('(() => {'):],html,count=1,flags=re.S) if False else html
# Raw inline app script is byte-identical to app.js before patch, so use script boundaries.
script_open='<script>\n(() => {\n'
idx=html.find(script_open)
assert idx>0
close=html.index('</script>',idx)
html=html[:idx]+ '<script>\n'+js+'\n'+ html[close:]
# Cache bust and explicit version identity, preserving IndexedDB / Supabase settings.
html=html.replace("./sw.js?v=9","./sw.js?v=10")
(root/'index.html').write_text(html)
# Cache app / reference assets for installed offline PWA, versioned to invalidate previous UI.
sw=(root/'sw.js').read_text()
print('sw-before',sw[:460])
print('saved',len(js),len(style),len(html))

(()=>{'use strict';
// iPhone Home Screen viewport: iOS can report a smaller 100dvh than the
// device display. Use the greater of its real screen and visible viewport.
// Respond to scaling and rotation without changing recipe or background logic.
function resizeInstalledPhone(){
 const root=document.documentElement;
 if(!root.classList.contains('lk-installed-phone'))return;
 const deviceHeight=matchMedia('(orientation: landscape)').matches
  ?Math.min(screen.width,screen.height):Math.max(screen.width,screen.height);
 const nums=[deviceHeight,screen.availHeight,window.innerHeight,
  root.clientHeight,window.visualViewport?.height]
  .filter(n=>Number.isFinite(n)&&n>0);
 const h=Math.ceil(Math.max(...nums));
 if(h>=400&&h<6000)root.style.setProperty('--lk-installed-height',h+'px');
}
resizeInstalledPhone();
window.addEventListener('resize',resizeInstalledPhone,{passive:true});
window.addEventListener('orientationchange',resizeInstalledPhone,{passive:true});
window.visualViewport?.addEventListener('resize',resizeInstalledPhone,{passive:true});
window.addEventListener('pageshow',resizeInstalledPhone);

const $=s=>document.querySelector(s), content=$('#content'), overlay=$('#overlay'), scene=$('#scene');
const SCENES={grocery:'../reference-grocery.png',recipes:'../reference-recipes.png',food:'../reference-food.png',drink:'../reference-drink.png',dessert:'../reference-dessert.png',settings:'../reference-settings.png'};
// Keep the existing artwork visible while the next large background loads and
// decodes. Crossfade the predecoded image instead of showing an empty scene.
const sceneFade=document.createElement('div');
sceneFade.className='scene scene-fade';
scene.after(sceneFade);
const sceneImages=new Map();
let requestedScene=SCENES.grocery,sceneGeneration=0,sceneFinishTimer=0;
function warmScene(path){
 const cached=sceneImages.get(path);
 if(cached)return cached.loaded;
 const image=new Image();
 image.decoding='async';
 const loaded=new Promise(resolve=>{
  image.onload=()=>{
   if(typeof image.decode==='function')image.decode().then(()=>resolve(true),()=>resolve(true));
   else resolve(true);
  };
  image.onerror=()=>{sceneImages.delete(path);resolve(false)};
  image.src=path;
 });
 // Keep decoded backgrounds available for near-instant repeat tab switches.
 sceneImages.set(path,{image,loaded});
 return loaded;
}
function prefetchScenes(){
 // Start after first paint and load sequentially to avoid choking mobile networks.
 const paths=[SCENES.recipes,SCENES.food,SCENES.drink,SCENES.dessert,SCENES.settings];
 const warm=async()=>{for(const path of paths)await warmScene(path)};
 if('requestIdleCallback' in window)window.requestIdleCallback(warm,{timeout:1200});
 else setTimeout(warm,200);
}
function paintScene(path){
 if(path===requestedScene)return;
 requestedScene=path;
 const generation=++sceneGeneration;
 warmScene(path).then(ready=>{
  if(!ready||generation!==sceneGeneration)return;
  clearTimeout(sceneFinishTimer);
  // When switching rapidly, preserve the currently visible image as the base.
  if(sceneFade.style.opacity==='1')scene.style.backgroundImage=sceneFade.style.backgroundImage;
  sceneFade.style.transition='none';
  sceneFade.style.opacity='0';
  sceneFade.style.backgroundImage="url('"+path+"')";
  // Wait until the new bitmap is in the layer before animating opacity.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(generation!==sceneGeneration)return;
   sceneFade.style.transition='';
   sceneFade.style.opacity='1';
   sceneFinishTimer=setTimeout(()=>{
    if(generation!==sceneGeneration)return;
    scene.style.backgroundImage="url('"+path+"')";
    sceneFade.style.transition='none';
    sceneFade.style.opacity='0';
   },280);
  }));
 });
}

const CATS={food:'Food',drink:'Drinks',dessert:'Desserts'};
const DB_NAME='little-kitchen-recipes-v1',DB_VERSION=3;
const CLOUD_URL='https://pptbmupnpxigwfqkdpzt.supabase.co',CLOUD_KEY='sb_publishable_HBQoTJb2-tXAaOHifY9x4A_SXMDZLgr',BUCKET='lk-private-photos';
let db=null, recipes=[],groceries=[],tab='grocery',filter='all',search='',grocerySearch='',selected=null,editDraft=null,cloud=null,cloudUser=null,cloudStatus='Not connected',syncing=false,cloudReady=false,syncTimer=null,syncAgain=false,cloudChannel=null,photoPending=null,prefs={sounds:true},toastTimer=null;
let groceryPhotoDraft='',groceryPhotoPending=null,groceryPhotoRevision=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>window.crypto?.randomUUID?.()||'lk-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const now=()=>new Date().toISOString();
// Grocery checks belong to the shopping day that begins at 3 p.m. local time.
// Stored grocery items are permanent; a past day's checkmark simply expires.
function groceryDayStart(at=new Date()){
 const boundary=new Date(at);
 boundary.setHours(15,0,0,0);
 if(at.getTime()<boundary.getTime())boundary.setDate(boundary.getDate()-1);
 return boundary.getTime();
}
function isGroceryChecked(item){
 if(!item.checked)return false;
 const checkedAt=Date.parse(item.checkedAt||item.updatedAt||'');
 return Number.isFinite(checkedAt)&&checkedAt>=groceryDayStart();
}
let groceryResetTimer=0,lastGroceryCycle=0;
function refreshGroceryDay(){
 const cycle=groceryDayStart();
 if(cycle===lastGroceryCycle)return;
 lastGroceryCycle=cycle;
 if(db&&tab==='grocery')render(true);
}
function scheduleGroceryReset(){
 clearTimeout(groceryResetTimer);
 const boundary=new Date();
 boundary.setHours(15,0,0,0);
 if(boundary.getTime()<=Date.now())boundary.setDate(boundary.getDate()+1);
 groceryResetTimer=setTimeout(()=>{
  refreshGroceryDay();
  scheduleGroceryReset();
 },Math.max(100,boundary.getTime()-Date.now()+100));
}
const SRC=p=>typeof p==='string'&&p.startsWith('lk-photo:')?'':typeof p==='string'&&p.startsWith('./')?'../'+p.slice(2):(p||'');
const dsrc=p=>esc(SRC(p));
const label=t=>CATS[t]||'Recipes';
const showToast=msg=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000)};
const readBlob=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file)});
async function imageData(file){if(!file)return'';if(!file.type.startsWith('image/'))throw Error('Choose an image file');const raw=await readBlob(file);return await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{const canvas=document.createElement('canvas'),ratio=Math.min(1,1100/Math.max(im.width,im.height));canvas.width=Math.max(1,Math.round(im.width*ratio));canvas.height=Math.max(1,Math.round(im.height*ratio));canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.81))};im.onerror=()=>reject(Error('This photo could not be opened. Try a JPEG, PNG or WebP image.'));im.src=raw})}
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;for(const name of ['recipes','groceries','outbox','meta'])if(!d.objectStoreNames.contains(name))d.createObjectStore(name,{keyPath:name==='meta'?'key':name==='outbox'?'key':'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function getAll(store){return new Promise((resolve,reject)=>{const q=db.transaction(store,'readonly').objectStore(store).getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
function write(store,value){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
function remove(store,key){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
const kind=store=>store==='recipes'?'recipe':'grocery';
// Every local edit and its outgoing cloud task are committed together. This
// also works when Supabase has not loaded or the phone is offline.
function changeLocal(store,id,record,deleted=false){
 const task={key:kind(store)+':'+id,kind:kind(store),recordId:id,deleted,at:now(),ownerId:cloudUser?.id||null};
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([store,'outbox'],'readwrite');
  if(deleted)tx.objectStore(store).delete(id);
  else tx.objectStore(store).put(record);
  tx.objectStore('outbox').put(task);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error||Error('Local save was interrupted'));
 });
}
async function queue(store,id,deleted=false){
 await write('outbox',{key:kind(store)+':'+id,kind:kind(store),recordId:id,deleted,at:now(),ownerId:cloudUser?.id||null});
 requestSync();
}
async function save(store,record){
 record.updatedAt=now();
 await changeLocal(store,record.id,record);
 await reload();
 requestSync();
}
async function destroy(store,id){
 await changeLocal(store,id,null,true);
 await reload();
 requestSync();
}
async function reload(){[recipes,groceries]=await Promise.all([getAll('recipes'),getAll('groceries')]);render()}
const SAMPLE=[
 ['demo-soup','Velvety Pumpkin Soup','food','exact-pumpkin-soup.webp',35,4,['2 tbsp olive oil','1 onion','2 garlic cloves','3 cups pumpkin purée','2 cups vegetable broth','½ cup cream'],['Sauté onion in oil until soft.','Add pumpkin, garlic and warm spices.','Pour in stock and simmer for 15 minutes.','Blend until smooth, add cream, and serve.']],
 ['demo-pasta','Garden Herb Pasta','food','exact-herb-pasta.webp',25,3,['12 oz pasta','½ cup fresh herbs','2 tbsp olive oil','1 clove garlic','½ cup parmesan'],['Boil pasta in salted water.','Chop herbs and sauté garlic in olive oil.','Toss pasta with herbs and a splash of cooking water.','Finish with parmesan.']],
 ['demo-chai','Honey Chai Latte','drink','exact-chai-latte.webp',12,2,['2 cups milk','2 chai tea bags','2 tsp honey','¼ tsp cinnamon'],['Heat milk with tea bags.','Steep for 5 minutes.','Stir in honey, froth, and sprinkle cinnamon.']],
 ['demo-cider','Spiced Apple Cider','drink','exact-spiced-cider.webp',30,4,['4 cups apple cider','2 cinnamon sticks','2 star anise','1 orange'],['Combine cider and spices.','Warm gently for 25 minutes.','Strain into mugs and serve.']],
 ['demo-rolls','Maple Cinnamon Rolls','dessert','exact-cinnamon-rolls.webp',110,9,['3 cups flour','1 packet yeast','½ cup milk','3 tbsp cinnamon','½ cup brown sugar','¼ cup maple syrup'],['Make a soft dough and allow to rise.','Roll out and spread with cinnamon sugar.','Cut into spirals and bake.','Drizzle maple glaze over warm rolls.']],
 ['demo-crumble','Sunday Apple Crumble','dessert','exact-apple-crumble.webp',55,6,['5 apples','½ cup flour','½ cup oats','½ cup brown sugar','½ cup butter'],['Slice apples into a baking dish.','Combine flour, oats, sugar and butter.','Sprinkle crumbs on the apples.','Bake until golden and bubbling.']],
 ['demo-cake','Strawberry Cream Cake','dessert','exact-strawberry-cake.webp',75,8,['2 cake layers','2 cups strawberries','1 cup cream','¼ cup sugar'],['Bake and cool the cake layers.','Whip cream with sugar.','Layer cake with berries and cream.','Decorate and chill before slicing.']],
 ['demo-brownies','Chocolate Berry Brownies','dessert','exact-brownies.webp',45,9,['1 cup chocolate','½ cup butter','¾ cup sugar','2 eggs','½ cup flour','½ cup berries'],['Melt chocolate with butter.','Whisk in sugar, eggs and flour.','Fold in berries.','Bake until the center is fudgy.']]
];
async function seedOnce(){const meta=await getAll('meta');if(meta.some(x=>x.key==='initialized'))return;const existing=await getAll('recipes');if(existing.length===0)for(const s of SAMPLE){await write('recipes',{id:s[0],title:s[1],category:s[2],photo:'../'+s[3],minutes:s[4],servings:s[5],favorite:false,difficulty:'Easy',ingredients:s[6],steps:s[7].map((text,i)=>({id:'step-'+i,text,photo:'',note:''})),createdAt:now(),updatedAt:now()})}await write('meta',{key:'initialized',value:true})}
function setScene(){const art=SCENES[tab]||SCENES.recipes;paintScene(art);$('#header-action').textContent=tab==='settings'?'×':'+';$('#header-action').dataset.action=tab==='settings'?'close-settings':'new-recipe';$('#header-action').style.visibility=tab==='grocery'?'hidden':'visible';$('#add-float').style.display=['recipes','food','drink','dessert'].includes(tab)?'block':'none';$('#bottom-tabs').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false')})}
function listForTab(){const items=recipes.filter(r=>tab==='recipes'||r.category===tab).filter(r=>filter!=='fav'||r.favorite).filter(r=>filter!=='easy'||/easy/i.test(r.difficulty||'')).filter(r=>filter!=='project'||!(/easy/i.test(r.difficulty||''))).filter(r=>{const q=search.toLowerCase().trim();return !q||String(r.title||'').toLowerCase().includes(q)||(r.ingredients||[]).join(' ').toLowerCase().includes(q)});return items.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))}
// Built-in covers remain available even when a cloud recipe temporarily has no
// downloadable image. Never mutate saved photos just to display a fallback.
const RECIPE_FALLBACKS={
 'demo-soup':'../reference-recipe-pumpkin-soup.webp',
 'demo-pasta':'../reference-recipe-herb-pasta.webp',
 'demo-chai':'../reference-recipe-chai-latte.webp',
 'demo-cider':'../reference-recipe-spiced-cider.webp',
 'demo-rolls':'../reference-recipe-cinnamon-rolls.webp',
 'demo-crumble':'../reference-recipe-apple-crumble.webp',
 'demo-cake':'../reference-recipe-strawberry.webp',
 'demo-brownies':'../reference-recipe-brownie.webp'
};
const recipeCover=r=>{
 const source=SRC(r.photo);
 if(source)return source;
 const demo=SAMPLE.find(item=>item[0]===r.id);
 return demo?'../'+demo[3]:'';
};
const recipeImage=r=>`src="${esc(recipeCover(r))}" data-recipe-image="true" data-fallback-image="${esc(RECIPE_FALLBACKS[r.id]||'')}"`;
function recipeCard(r){return `<article class="recipe-card"><div class="thumb-wrap"><button class="card-open" data-action="open-recipe" data-id="${esc(r.id)}" aria-label="Open ${esc(r.title)}">${recipeCover(r)?`<img class="thumb" ${recipeImage(r)} alt="${esc(r.title)}" loading="lazy" decoding="async">`:'<span class="recipe-no-photo" aria-label="No photo added">♡</span>'}</button><button class="fav ${r.favorite?'on':''}" data-action="favorite" data-id="${esc(r.id)}" aria-label="Toggle favorite">${r.favorite?'♥':'♡'}</button></div><div class="card-inner"><div class="card-cat">${esc(label(r.category).toUpperCase())}</div><button class="card-open" data-action="open-recipe" data-id="${esc(r.id)}"><h2 class="card-title">${esc(r.title)}</h2></button><div class="card-meta"><span>◷ ${Number(r.minutes)||0} min</span><span>♧ ${Number(r.servings)||1} servings</span></div></div></article>`}
// The photo files themselves are preserved. Failed requests try the matching
// alternate demo cover once, then show a clean card background rather than
// an endless broken-image icon or a stretched generic scene background.
document.addEventListener('error',event=>{
 const img=event.target;
 if(!(img instanceof HTMLImageElement)||!img.matches('img[data-recipe-image]'))return;
 const alt=img.getAttribute('data-fallback-image');
 if(alt&&img.dataset.imageRetry!=='1'&&img.getAttribute('src')!==alt){
  img.dataset.imageRetry='1';
  img.src=alt;
  return;
 }
 img.classList.add('recipe-image-unavailable');
},true);
function renderCards(){const el=$('#cards');if(!el)return;const items=listForTab();el.innerHTML=items.length?items.map(recipeCard).join(''):`<div class="panel empty" style="grid-column:1/-1"><span class="empty-symbol">♡</span><h2>No matching recipes</h2><p>Tap + to add your first recipe.</p></div>`;const count=$('#match-count');if(count)count.textContent=String(items.length)}
function renderRecipes(){const title=tab==='recipes'?'Recipe <em>book</em>':tab==='food'?'Food':tab==='drink'?'Drinks':'Desserts';const tag=tab==='recipes'?'ALL RECIPES':label(tab).toUpperCase();return `<div class="hero"><div class="label">✦ ${tag} ✦</div><h1>${title}</h1></div><div class="hero-gap"></div><div class="search"><span class="search-icon">⌕</span><input id="search-recipes" aria-label="Search recipes" type="search" placeholder="Search a recipe or ingredient…" value="${esc(search)}"><span id="match-count" class="search-count">${listForTab().length}</span></div><div class="filters">${[['all','All recipes'],['fav','♡ Favorites'],['easy','Easy'],['project','Cozy projects']].map(([k,v])=>`<button class="pill ${filter===k?'active':''}" data-action="filter" data-filter="${k}">${v}</button>`).join('')}</div><div class="cards" id="cards">${listForTab().map(recipeCard).join('')||'<div class="panel empty" style="grid-column:1/-1"><span class="empty-symbol">♡</span><h2>No recipes yet</h2><p>Tap + to add a recipe.</p></div>'}</div>`}
function groceryCard(g){return `<div class="grocery-row ${isGroceryChecked(g)?'done':''}"><label class="grocery-check-hit" title="Mark ${esc(g.name)} as ${isGroceryChecked(g)?'needed':'purchased'}"><input type="checkbox" data-action="check-grocery" data-id="${esc(g.id)}" ${isGroceryChecked(g)?'checked':''} aria-label="Mark ${esc(g.name)} as ${isGroceryChecked(g)?'needed':'purchased'}"></label><button type="button" class="grocery-name grocery-open" data-action="open-grocery" data-id="${esc(g.id)}" aria-label="View ${esc(g.name)} details"><span class="grocery-main"><span class="grocery-title" title="${esc(g.name)}">${esc(g.name)}${g.priority?' ✦':''}</span><span class="grocery-qty-inline">${esc(g.qty??1)}${g.unit?' '+esc(g.unit):''}</span></span>${g.notes?`<span class="grocery-notes">${esc(g.notes)}</span>`:''}</button><div class="row-actions"><button class="text-button" data-action="edit-grocery" data-id="${esc(g.id)}" aria-label="Edit grocery">✎</button><button class="text-button" data-action="delete-grocery" data-id="${esc(g.id)}" aria-label="Delete grocery">×</button></div></div>`}
function groceryRows(){
 const q=grocerySearch.trim().toLowerCase();
 const hits=groceries.filter(g=>!q||[g.name,g.notes,g.category,g.store,g.unit].some(v=>String(v||'').toLowerCase().includes(q)));
 if(!hits.length)return groceries.length?'<div class="empty"><h2>No matching items</h2><p>Try another search.</p></div>':'<div class="empty"><div class="empty-symbol">♙</div><h2>Your list is empty</h2><p>Tap Add item to start your shopping list.</p></div>';
 return hits.filter(g=>!isGroceryChecked(g)).map(groceryCard).join('')+hits.filter(isGroceryChecked).map(groceryCard).join('');
}
function renderGrocery(){
 const pending=groceries.filter(g=>!isGroceryChecked(g)),done=groceries.filter(isGroceryChecked);
 return `<div class="grocery-hero"><img class="grocery-bunny" src="./groceries-bunny.webp?v=2" alt="" aria-hidden="true" decoding="async"><div class="grocery-hero-copy"><div class="label">✦ MY SHOPPING LIST ✦</div><h1>Groceries</h1><p>${pending.length} to buy &nbsp;·&nbsp; ${done.length} checked off</p></div></div><div class="quick-add"><input id="grocery-search" type="search" autocomplete="off" aria-label="Search grocery items" placeholder="Search groceries…" value="${esc(grocerySearch)}" maxlength="140"><button class="primary" type="button" data-action="add-grocery-detail">＋ Add item</button></div><div class="panel" id="grocery-items">${groceryRows()}</div>${done.length?'<div class="actions"><button class="secondary" type="button" data-action="uncheck-purchased">Uncheck purchased</button></div>':''}`;
}
function renderSettings(){return `<div class="hero"><div class="label">✦ PREFERENCES ✦</div><h1>Settings</h1></div><div class="hero-gap" style="height:25px"></div><div class="panel settings-card"><h2>☁ Shared cloud</h2><p id="cloud-state">${esc(cloudStatus)}</p>${cloudUser?`<p>Signed in as ${esc(cloudUser.email||'your account')}</p><button class="primary" data-action="cloud-sync">Sync now</button><button class="secondary" data-action="cloud-signout">Sign out</button>`:`<form id="cloud-login"><input type="email" name="email" autocomplete="email" placeholder="Existing app email" required><input type="password" name="password" autocomplete="current-password" placeholder="Password" required><button class="primary" type="submit">Sign in to shared cloud</button></form>`}<p>Sign in with the same existing account on both phones. Changes sync automatically when online; offline edits are saved until they can sync.</p></div><div class="panel settings-card"><div class="toggle"><div><h2>♫ Sounds</h2><p>Cute tap sounds</p></div><input id="sounds" type="checkbox" ${prefs.sounds?'checked':''} aria-label="Toggle sounds"></div></div><div class="panel settings-card"><h2>↥ Backups</h2><p>Save or restore your recipes, groceries, and photos as a JSON file.</p><button class="primary" data-action="export">Export backup</button><button class="secondary" data-action="import">Import backup</button></div><div class="panel settings-card"><h2>Recipe book</h2><p>${recipes.length} recipes saved · ${groceries.length} grocery items</p><button class="secondary" data-action="tab" data-tab="recipes">View recipes</button></div>`}
function render(keepScroll=false){const y=content.scrollTop;setScene();content.innerHTML=tab==='grocery'?renderGrocery():tab==='settings'?renderSettings():renderRecipes();if(keepScroll)content.scrollTop=y;else content.scrollTop=0}
function activate(t){const next=SCENES[t]?t:'recipes',changed=next!==tab;tab=next;filter='all';search='';grocerySearch='';closeOverlay();render();if(changed){content.classList.remove('tab-reveal');void content.offsetWidth;content.classList.add('tab-reveal')}}
function showOverlay(html,mode='editor'){
 const isGroceryDetail=mode==='grocery-detail',isRecipeDetail=mode==='recipe-detail';
 overlay.classList.add('card-popup-overlay');
 overlay.classList.toggle('grocery-detail-overlay',isGroceryDetail);
 overlay.classList.toggle('recipe-detail-overlay',isRecipeDetail);
 overlay.classList.toggle('editor-overlay',mode==='editor');
 const sheetClass=isGroceryDetail?'grocery-detail-sheet':isRecipeDetail?'recipe-detail-sheet':'editor-sheet';
 const headingId=isGroceryDetail?'grocery-detail-title':'popup-sheet-heading';
 overlay.innerHTML=`<div class="sheet ${sheetClass}" role="dialog" aria-modal="true" aria-labelledby="${headingId}">${html}</div>`;
 overlay.hidden=false;
 $('#add-float').hidden=true;
}
function closeOverlay(){
 overlay.hidden=true;overlay.innerHTML='';
 overlay.classList.remove('card-popup-overlay','grocery-detail-overlay','recipe-detail-overlay','editor-overlay');
 editDraft=null;$('#add-float').hidden=false;
}
function sheetHead(title){return `<div class="sheet-head"><h2 id="popup-sheet-heading">${esc(title)}</h2><button class="close" data-action="close" aria-label="Close">×</button></div>`}

/* A temporary image viewer inside the existing recipe dialog. The underlying
   recipe, scroll position, image data, and editing state stay untouched. */
const stepZoom={
 scale:1,x:0,y:0,pointers:new Map(),gesture:null,lastTap:null,returnFocus:null
};
function clampStepZoom(v,min,max){return Math.max(min,Math.min(max,v))}
function applyStepZoom(){
 const viewer=overlay.querySelector('.step-lightbox');
 if(!viewer)return;
 const stage=viewer.querySelector('.step-lightbox-stage');
 const img=viewer.querySelector('.step-lightbox-image');
 if(!stage||!img)return;
 const maxX=Math.max(0,(img.offsetWidth*stepZoom.scale-stage.clientWidth)/2);
 const maxY=Math.max(0,(img.offsetHeight*stepZoom.scale-stage.clientHeight)/2);
 stepZoom.x=clampStepZoom(stepZoom.x,-maxX,maxX);
 stepZoom.y=clampStepZoom(stepZoom.y,-maxY,maxY);
 img.style.transform='translate3d('+stepZoom.x+'px,'+stepZoom.y+'px,0) scale('+stepZoom.scale+')';
 const value=viewer.querySelector('.step-lightbox-level');
 if(value)value.textContent=Math.round(stepZoom.scale*100)+'%';
}
function setStepZoom(next,clientX,clientY){
 const stage=overlay.querySelector('.step-lightbox-stage');
 if(!stage)return;
 const rect=stage.getBoundingClientRect();
 const cx=Number.isFinite(clientX)?clientX:rect.left+rect.width/2;
 const cy=Number.isFinite(clientY)?clientY:rect.top+rect.height/2;
 const old=stepZoom.scale;
 stepZoom.scale=clampStepZoom(next,1,5);
 const ratio=stepZoom.scale/old;
 stepZoom.x-=((cx-rect.left-rect.width/2)-stepZoom.x)*(ratio-1);
 stepZoom.y-=((cy-rect.top-rect.height/2)-stepZoom.y)*(ratio-1);
 if(stepZoom.scale===1){stepZoom.x=0;stepZoom.y=0}
 applyStepZoom();
}
function resetStepZoom(){setStepZoom(1)}
function closeStepPhoto(){
 const viewer=overlay.querySelector('.step-lightbox');
 if(!viewer)return;
 viewer.remove();
 const sheet=overlay.querySelector('.sheet');
 if(sheet){sheet.removeAttribute('aria-hidden');sheet.inert=false}
 stepZoom.pointers.clear();stepZoom.gesture=null;stepZoom.scale=1;
 stepZoom.x=0;stepZoom.y=0;
 if(stepZoom.returnFocus?.isConnected)stepZoom.returnFocus.focus({preventScroll:true});
 stepZoom.returnFocus=null;
}
function beginStepZoomGesture(){
 const pts=[...stepZoom.pointers.values()];
 if(pts.length>=2){
  const a=pts[0],b=pts[1];
  stepZoom.gesture={
   mode:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),
   midX:(a.x+b.x)/2,midY:(a.y+b.y)/2,
   scale:stepZoom.scale,x:stepZoom.x,y:stepZoom.y
  };
 }else if(pts.length===1){
  stepZoom.gesture={mode:'pan',startX:pts[0].x,startY:pts[0].y,
    x:stepZoom.x,y:stepZoom.y};
 }else stepZoom.gesture=null;
}
function openStepPhoto(id,index){
 const r=recipes.find(item=>item.id===id);
 const photo=r?.steps?.[index]?.photo;
 const source=SRC(photo);
 if(!source){showToast('This step photo is not available yet');return}
 closeStepPhoto();
 const viewer=document.createElement('div');
 viewer.className='step-lightbox';
 viewer.setAttribute('role','dialog');
 viewer.setAttribute('aria-modal','true');
 viewer.setAttribute('aria-label','Zoomable photo for step '+(index+1));
 viewer.innerHTML=
  '<div class="step-lightbox-bar">'+
   '<strong>Step '+(index+1)+' photo</strong>'+
   '<button type="button" class="step-lightbox-close" data-action="close-step-photo" aria-label="Close photo viewer">×</button>'+
  '</div>'+
  '<div class="step-lightbox-stage" aria-label="Pinch to zoom or drag the image">'+
   '<img class="step-lightbox-image" alt="Zoomable photo for step '+(index+1)+'" draggable="false">'+
  '</div>'+
  '<div class="step-lightbox-controls">'+
   '<button type="button" data-action="step-photo-zoom-out" aria-label="Zoom out">−</button>'+
   '<span class="step-lightbox-level" aria-live="off">100%</span>'+
   '<button type="button" data-action="step-photo-zoom-in" aria-label="Zoom in">+</button>'+
   '<button type="button" data-action="step-photo-reset" aria-label="Reset zoom">Reset</button>'+
  '</div>'+
  '<p class="step-lightbox-tip">Pinch to zoom · Drag to move · Double-tap to magnify</p>';
 viewer.querySelector('.step-lightbox-image').src=source;
 const stage=viewer.querySelector('.step-lightbox-stage');
 stage.addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse'&&event.button!==0)return;
  event.preventDefault();
  try{stage.setPointerCapture(event.pointerId)}catch(_){}
  stepZoom.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  beginStepZoomGesture();
 });
 stage.addEventListener('pointermove',event=>{
  if(!stepZoom.pointers.has(event.pointerId))return;
  event.preventDefault();
  stepZoom.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  const g=stepZoom.gesture;
  if(!g)return;
  const pts=[...stepZoom.pointers.values()];
  if(pts.length>=2&&g.mode==='pinch'){
   const a=pts[0],b=pts[1],mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
   const distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));
   stepZoom.scale=clampStepZoom(g.scale*distance/g.distance,1,5);
   const ratio=stepZoom.scale/g.scale,rect=stage.getBoundingClientRect();
   stepZoom.x=g.x+(mx-g.midX)-(ratio-1)*(g.midX-rect.left-rect.width/2-g.x);
   stepZoom.y=g.y+(my-g.midY)-(ratio-1)*(g.midY-rect.top-rect.height/2-g.y);
  }else if(pts.length===1&&g.mode==='pan'){
   stepZoom.x=g.x+pts[0].x-g.startX;
   stepZoom.y=g.y+pts[0].y-g.startY;
  }
  applyStepZoom();
 });
 const finishPointer=event=>{
  if(!stepZoom.pointers.has(event.pointerId))return;
  const point=stepZoom.pointers.get(event.pointerId);
  const gesture=stepZoom.gesture;
  const isTap=event.type==='pointerup'&&stepZoom.pointers.size===1&&
    gesture?.mode==='pan'&&Math.hypot(point.x-gesture.startX,point.y-gesture.startY)<12;
  stepZoom.pointers.delete(event.pointerId);
  beginStepZoomGesture();
  if(isTap){
   const last=stepZoom.lastTap;
   if(last&&Date.now()-last.time<330&&Math.hypot(point.x-last.x,point.y-last.y)<32){
    setStepZoom(stepZoom.scale>1?1:2.5,point.x,point.y);
    stepZoom.lastTap=null;
   }else stepZoom.lastTap={time:Date.now(),x:point.x,y:point.y};
  }else stepZoom.lastTap=null;
 };
 stage.addEventListener('pointerup',finishPointer);
 stage.addEventListener('pointercancel',finishPointer);
 stage.addEventListener('lostpointercapture',event=>{
  if(stepZoom.pointers.has(event.pointerId)){
   stepZoom.pointers.delete(event.pointerId);beginStepZoomGesture();
  }
 });
 overlay.appendChild(viewer);
 const sheet=overlay.querySelector('.sheet');
 if(sheet){sheet.setAttribute('aria-hidden','true');sheet.inert=true}
 stepZoom.scale=1;stepZoom.x=0;stepZoom.y=0;
 stepZoom.pointers.clear();stepZoom.gesture=null;stepZoom.lastTap=null;
 stepZoom.returnFocus=[...overlay.querySelectorAll('[data-action="zoom-step-photo"]')].find(btn=>btn.dataset.id===id&&Number(btn.dataset.index)===index)||null;
 viewer.querySelector('.step-lightbox-close').focus({preventScroll:true});
 viewer.querySelector('.step-lightbox-image').addEventListener('load',applyStepZoom);
 applyStepZoom();
}

function openRecipe(id){const r=recipes.find(x=>x.id===id);if(!r)return;selected=id;showOverlay(`${sheetHead(r.title)}${recipeCover(r)?`<img class="detail-photo" ${recipeImage(r)} alt="Photo of ${esc(r.title)}">`:'<div class="recipe-detail-no-photo">♡<small>No photo added yet</small></div>'}<p>${esc(label(r.category))} · ${Number(r.minutes)||0} min · ${Number(r.servings)||1} servings</p><p>${esc(r.description||'')}</p><div class="actions"><button class="primary" data-action="edit-recipe" data-id="${esc(id)}">✎ Edit recipe</button><button class="secondary" data-action="recipe-to-grocery" data-id="${esc(id)}">+ Shopping list</button></div><h2>Ingredients</h2><ul class="detail-list">${(r.ingredients||[]).map(x=>`<li>${esc(typeof x==='string'?x:x.name||'')}</li>`).join('')}</ul><h2>Steps</h2>${(r.steps||[]).map((st,i)=>`<section class="detail-step"><h3>Step ${i+1}</h3><p>${esc(st.text||'')}</p>${st.photo?`<button type="button" class="step-photo-button" data-action="zoom-step-photo" data-id="${esc(r.id)}" data-index="${i}" aria-label="Open zoomable image for step ${i+1}"><img src="${dsrc(st.photo)}" alt="Photo for step ${i+1}" loading="lazy"></button>`:''}</section>`).join('')}<p>${esc(r.notes||'')}</p><div class="actions"><button class="secondary" data-action="delete-recipe" data-id="${esc(id)}">Delete recipe</button></div>`,'recipe-detail')}
function newDraft(category){return {id:uid(),title:'',category:category||'food',description:'',difficulty:'Easy',minutes:30,servings:2,photo:'',favorite:false,ingredients:[],steps:[{id:uid(),text:'',note:'',photo:''}],createdAt:now()}}
function formField(name,title,value='',type='text'){return `<div class="field"><label for="f-${name}">${esc(title)}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}"></div>`}
function editRecipe(id){const r=recipes.find(x=>x.id===id);editDraft=r?structuredClone(r):newDraft(['food','drink','dessert'].includes(tab)?tab:'food');renderEditor()}
function readEditor(){if(!editDraft)return;const f=$('#recipe-form');if(!f)return;const fd=new FormData(f);for(const name of ['title','category','description','difficulty','minutes','servings','notes']){const val=fd.get(name);editDraft[name]=['minutes','servings'].includes(name)?Number(val)||0:String(val||'')}editDraft.ingredients=String(fd.get('ingredients')||'').split('\n').map(x=>x.trim()).filter(Boolean);editDraft.steps.forEach((s,i)=>{s.text=String(fd.get('step-text-'+i)||'').trim()})}
function renderEditor(){const r=editDraft;if(!r)return;showOverlay(`${sheetHead(r.title?'Edit recipe':'New recipe')}<form id="recipe-form">${formField('title','Recipe name',r.title)}<div class="form-grid"><div class="field"><label for="f-category">Category</label><select id="f-category" name="category">${Object.entries(CATS).map(([k,v])=>`<option value="${k}" ${r.category===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="f-difficulty">Difficulty</label><select id="f-difficulty" name="difficulty">${['Easy','Medium','Cozy project'].map(x=>`<option ${r.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></div>${formField('minutes','Minutes',r.minutes,'number')}${formField('servings','Servings',r.servings,'number')}</div><div class="field"><label>Description</label><textarea name="description">${esc(r.description)}</textarea></div><div class="field"><label>Cover photo</label>${r.photo?`<img class="image-preview" src="${dsrc(r.photo)}" alt="Cover preview"><button type="button" class="secondary recipe-remove-photo" data-action="remove-recipe-cover" aria-label="Remove recipe cover photo">Remove cover photo</button>`:''}<input type="file" name="cover-photo" accept="image/*"></div><div class="field"><label>Ingredients (one per line)</label><textarea name="ingredients" rows="6">${esc((r.ingredients||[]).map(x=>typeof x==='string'?x:x.name||'').join('\n'))}</textarea></div><h2>Cooking steps & photos</h2>${r.steps.map((st,i)=>`<div class="step-editor"><h3>Step ${i+1}</h3><div class="field"><label>Instruction</label><textarea name="step-text-${i}" rows="3">${esc(st.text)}</textarea></div>${st.photo?`<img src="${dsrc(st.photo)}" alt="Step photo"><button type="button" class="secondary recipe-remove-photo" data-action="remove-recipe-step-photo" data-index="${i}" aria-label="Remove photo from step ${i+1}">Remove step photo</button>`:''}<div class="field"><label>Photo for this step</label><input type="file" accept="image/*" data-step-file="${i}"></div><button class="secondary" type="button" data-action="remove-step" data-index="${i}">Remove step</button></div>`).join('')}<button class="secondary" type="button" data-action="add-step">+ Add step</button><div class="field"><label>Notes</label><textarea name="notes">${esc(r.notes||'')}</textarea></div><div class="actions"><button class="primary" type="submit">Save recipe</button><button class="secondary" type="button" data-action="close">Cancel</button></div></form>`)}
function openGrocery(id){
 const g=groceries.find(x=>x.id===id);
 if(!g)return;
 selected=id;
 showOverlay(`<div class="grocery-detail-heading">
  <button class="grocery-detail-close" type="button" data-action="close" aria-label="Close grocery details">×</button>
  <h2 id="grocery-detail-title">${esc(g.name)}</h2>
 </div>
 <div class="grocery-detail-image">
  ${g.photo?`<img class="grocery-detail-photo" src="${dsrc(g.photo)}" alt="Product photo for ${esc(g.name)}">`:'<div class="grocery-detail-photo-empty"><span aria-hidden="true">♡</span><p>Add a photo of the exact product you want to buy</p></div>'}
 </div>
 <div class="grocery-detail-facts">
  <div class="grocery-detail-fact">
   <span class="grocery-detail-fact-label">Quantity</span>
   <strong class="grocery-detail-fact-value grocery-detail-qty-value">${esc(g.qty??1)}${g.unit?' '+esc(g.unit):''}</strong>
  </div>
  ${g.notes?`<div class="grocery-detail-fact">
   <span class="grocery-detail-fact-label">Notes</span>
   <strong class="grocery-detail-fact-value grocery-detail-notes">${esc(g.notes)}</strong>
  </div>`:''}
 </div>
 <div class="actions grocery-detail-actions">
  <button class="primary" type="button" data-action="edit-grocery" data-id="${esc(g.id)}">Edit item / photo</button>
  <button class="secondary" type="button" data-action="close">Close</button>
 </div>`,'grocery-detail');
}
function groceryPhotoPreview(){
 const node=$('#grocery-photo-preview');
 if(node)node.innerHTML=groceryPhotoDraft
  ?`<img class="grocery-product-preview" src="${dsrc(groceryPhotoDraft)}" alt="Selected product photo">`
  :'<div class="grocery-photo-placeholder">Add a photo of the exact product to buy</div>';
 const remove=$('#remove-grocery-photo');
 if(remove)remove.hidden=!groceryPhotoDraft;
}
function editGrocery(id){
 const g=groceries.find(x=>x.id===id)||{id:uid(),name:'',qty:1,unit:'',notes:'',category:'pantry',priority:false,checked:false,photo:''};
 selected=id||null;
 groceryPhotoRevision++;
 groceryPhotoDraft=g.photo||'';
 groceryPhotoPending=null;
 showOverlay(`${sheetHead(id?'Edit item':'New item')}<form id="grocery-form">
 ${formField('name','Item name',g.name)}
 <div class="form-grid">${formField('qty','Quantity',g.qty,'number')}${formField('unit','Unit',g.unit)}</div>
 ${formField('notes','Notes',g.notes)}
 <label><input type="checkbox" name="priority" ${g.priority?'checked':''}> Important item</label>
 <div class="field grocery-photo-field"><label for="grocery-photo">Product photo (optional)</label>
 <div id="grocery-photo-preview" aria-live="polite">${groceryPhotoDraft?`<img class="grocery-product-preview" src="${dsrc(groceryPhotoDraft)}" alt="Selected product photo">`:'<div class="grocery-photo-placeholder">Add a photo of the exact product to buy</div>'}</div>
 <input id="grocery-photo" name="grocery-photo" type="file" accept="image/*">
 <button class="secondary" id="remove-grocery-photo" type="button" data-action="remove-grocery-photo" ${groceryPhotoDraft?'':'hidden'}>Remove photo</button>
 <p class="hint">Saved on your phone for offline shopping and synced privately when online.</p></div>
 <div class="actions"><button class="primary" type="submit">Save item</button><button type="button" class="secondary" data-action="close">Cancel</button></div></form>`);
}
function download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000)}
async function exportBackup(){download('little-kitchen-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({app:'the-little-kitchen',version:3,exportedAt:now(),recipes,groceries,prefs},null,2),'application/json');showToast('Backup exported')}
async function importBackup(file){if(!file)return;try{if(file.size>90*1024*1024)throw Error('Backup is too large');const v=JSON.parse(await file.text());if(v.app!=='the-little-kitchen'||!Array.isArray(v.recipes))throw Error('Not a Little Kitchen backup');const n=confirm(`Import ${v.recipes.length} recipes and ${(v.groceries||[]).length} groceries? Existing entries with the same IDs will be updated.`);if(!n)return;for(const r of v.recipes){if(!r||typeof r.id!=='string'||typeof r.title!=='string')continue;await saveRaw('recipes',r)}for(const g of v.groceries||[]){if(!g||typeof g.id!=='string'||typeof g.name!=='string')continue;await saveRaw('groceries',g)}await reload();showToast('Backup imported')}catch(e){showToast(e.message||'Import failed')}}
async function saveRaw(store,value){value.updatedAt=value.updatedAt||now();await changeLocal(store,value.id,value);requestSync()}
function exportCsv(){const rows=[['Item','Quantity','Unit','Notes','Purchased'],...groceries.map(g=>[g.name,g.qty,g.unit,g.notes,g.checked?'Yes':'No'])];download('little-kitchen-groceries.csv',rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv')}
async function addIngredients(id){const r=recipes.find(x=>x.id===id);if(!r)return;let count=0;for(const x of r.ingredients||[]){const name=String(typeof x==='string'?x:x.name||'').trim();if(!name)continue;await saveRaw('groceries',{id:uid(),name,qty:1,unit:'',checked:false,category:'pantry',source:r.id,createdAt:now(),updatedAt:now()});count++}closeOverlay();activate('grocery');await reload();showToast(count+' ingredients added')}
function requestSync(){
 if(!cloudUser)return;
 if(syncing){syncAgain=true;return}
 clearTimeout(syncTimer);
 syncTimer=setTimeout(()=>syncCloud().catch(console.error),650);
}
function cloudLabel(x){cloudStatus=x;const el=$('#cloud-state');if(el)el.textContent=x}
async function cloudImageIn(v){
 if(!v?.startsWith?.('lk-photo:')||!cloud)return v||'';
 // A failed download must not silently replace a recipe photo with blank data.
 const {data,error}=await cloud.storage.from(BUCKET).download(v.slice(9));
 if(error)throw Error('Could not download a shared photo: '+error.message);
 return await readBlob(data);
}
async function cloudImageOut(v,id,slot){
 if(!v?.startsWith?.('data:image/')||!cloudUser)return v||'';
 const blob=await(await fetch(v)).blob();
 const mime=['image/jpeg','image/png','image/webp'].includes(blob.type)?blob.type:'image/jpeg';
 const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
 const path=`${cloudUser.id}/${encodeURIComponent(id)}/${encodeURIComponent(slot)}-${uid()}.${ext}`;
 const {error}=await cloud.storage.from(BUCKET).upload(path,blob,{contentType:mime,upsert:false});
 if(error)throw Error('Photo upload failed: '+error.message);
 return 'lk-photo:'+path;
}
async function cloudExpand(kind,v){
 const x=structuredClone(v||{});
 if(kind==='recipe'){
  // Keep local image bytes so every cover and step photo works offline.
  // Save private cloud references separately for later metadata-only edits.
  x.photoCloud=x.photo?.startsWith?.('lk-photo:')?x.photo:null;
  x.photo=await cloudImageIn(x.photo);
  for(const step of x.steps||[]){
   step.photoCloud=step.photo?.startsWith?.('lk-photo:')?step.photo:null;
   step.photo=await cloudImageIn(step.photo);
  }
 }else if(kind==='grocery'){
  x.photoCloud=x.photo?.startsWith?.('lk-photo:')?x.photo:null;
  x.photo=await cloudImageIn(x.photo);
 }
 return x;
}
async function cloudPrepare(kind,r){
 const x=structuredClone(r);
 if(kind==='recipe'){
  // Never upload the same photo again when changing text, favorites or steps.
  // Only upload new images; local cached photo bytes stay available offline.
  x.photo=x.photo?.startsWith?.('data:image/')&&x.photoCloud?.startsWith?.('lk-photo:')
   ?x.photoCloud:await cloudImageOut(x.photo,r.id,'cover');
  delete x.photoCloud;
  for(const st of x.steps||[]){
   st.photo=st.photo?.startsWith?.('data:image/')&&st.photoCloud?.startsWith?.('lk-photo:')
    ?st.photoCloud:await cloudImageOut(st.photo,r.id,st.id||'step');
   delete st.photoCloud;
  }
 }else if(kind==='grocery'){
  x.photo=x.photo?.startsWith?.('data:image/')&&x.photoCloud?.startsWith?.('lk-photo:')
   ?x.photoCloud:await cloudImageOut(x.photo,r.id,'product');
  delete x.photoCloud;
 }
 return x;
}
async function syncCloud(){
 if(syncing){syncAgain=true;return}
 if(!cloud||!cloudUser)return;
 if(!navigator.onLine){cloudLabel('Offline · changes saved here, waiting to sync');return}
 syncing=true;
 const accountId=cloudUser.id;
 cloudLabel('Syncing…');
 try{
  const {data:remote,error}=await cloud.from('lk_entries')
   .select('kind,record_id,payload,deleted,updated_at')
   .eq('user_id',accountId).limit(10000);
  if(error)throw error;
  if((remote||[]).length===10000)throw Error('Too many cloud records; sync is incomplete');
  const outstanding=await getAll('outbox');
  const pendingKeys=new Set(outstanding.filter(t=>!t.ownerId||t.ownerId===accountId).map(t=>t.key));
  const remoteKeys=new Set();
  const snapshots={recipes:await getAll('recipes'),groceries:await getAll('groceries')};
  for(const row of remote||[]){
   const store=row.kind==='recipe'?'recipes':row.kind==='grocery'?'groceries':null;
   if(!store)continue;
   const key=row.kind+':'+row.record_id;
   remoteKeys.add(key);
   if(pendingKeys.has(key))continue; // Never replace an edit awaiting upload.
   const local=snapshots[store].find(x=>x.id===row.record_id);
   if(row.deleted){
    if(local && !(await getAll('outbox')).some(t=>t.key===key))await remove(store,row.record_id);
    continue;
   }
   if(!row.payload?.id)continue;
   // A newly installed phone seeds demo recipes with fresh local timestamps.
   // Compare against the cloud payload, not the phone's seed creation time.
   if(local && String(local.updatedAt||'')===String(row.payload.updatedAt||''))continue;
   // Preserve edits made by older offline app versions before they used an outbox.
   if(local && !String(local.id).startsWith('demo-') &&
      Date.parse(local.updatedAt||0)>Date.parse(row.payload.updatedAt||row.updated_at||0)){
    await queue(store,local.id);pendingKeys.add(key);continue;
   }
   const item=await cloudExpand(row.kind,row.payload);
   if(!(await getAll('outbox')).some(t=>t.key===key))await write(store,item);
  }
  const current={recipes:await getAll('recipes'),groceries:await getAll('groceries')};
  for(const store of ['recipes','groceries'])for(const item of current[store]){
   const key=kind(store)+':'+item.id;
   if(!remoteKeys.has(key)&&!pendingKeys.has(key)){
    await queue(store,item.id);pendingKeys.add(key);
   }
  }
  for(const task of await getAll('outbox')){
   if(task.ownerId && task.ownerId!==accountId)continue;
   if(cloudUser?.id!==accountId)throw Error('Shared account changed during sync');
   const store=task.kind==='recipe'?'recipes':task.kind==='grocery'?'groceries':null;
   if(!store)continue;
   const record=(await getAll(store)).find(x=>x.id===task.recordId);
   const deleted=task.deleted||!record;
   const payload=deleted?{}:await cloudPrepare(task.kind,record);
   const {data:saved,error:pushError}=await cloud.from('lk_entries')
    .upsert({user_id:accountId,kind:task.kind,record_id:task.recordId,
      payload,deleted,updated_at:now()},{onConflict:'user_id,kind,record_id'})
    .select('record_id').single();
   if(pushError)throw pushError;
   if(saved?.record_id!==task.recordId)throw Error('Cloud did not confirm the save');
   // Keep successfully uploaded references locally, without modifying
   // timestamps or re-uploading photos on text/favorite/checkbox changes.
   if(task.kind==='grocery'&&payload.photo?.startsWith?.('lk-photo:')){
    const latest=(await getAll('groceries')).find(x=>x.id===task.recordId);
    if(latest?.photo===record?.photo&&latest.photoCloud!==payload.photo)
     await write('groceries',{...latest,photoCloud:payload.photo});
   }
   if(task.kind==='recipe'&&!deleted){
    const latest=(await getAll('recipes')).find(x=>x.id===task.recordId);
    if(latest){
     let changed=false;
     if(payload.photo?.startsWith?.('lk-photo:')&&latest.photo===record.photo&&latest.photoCloud!==payload.photo){
      latest.photoCloud=payload.photo;changed=true;
     }
     const sentSteps=new Map((payload.steps||[]).map(st=>[st.id,st]));
     const originalSteps=new Map((record.steps||[]).map(st=>[st.id,st]));
     for(const step of latest.steps||[]){
      const sent=sentSteps.get(step.id),old=originalSteps.get(step.id);
      if(sent?.photo?.startsWith?.('lk-photo:')&&old&&step.photo===old.photo&&step.photoCloud!==sent.photo){
       step.photoCloud=sent.photo;changed=true;
      }
     }
     if(changed)await write('recipes',latest);
    }
   }
   const taskNow=(await getAll('outbox')).find(x=>x.key===task.key);
   if(taskNow?.at===task.at)await remove('outbox',task.key);
  }
  cloudLabel((await getAll('outbox')).length?'Some changes still waiting':'Cloud up to date');
  await reload();
 }catch(e){
  console.error('Cloud sync',e);
  cloudLabel('Cloud sync failed · '+String(e?.message||'please try again').slice(0,110)+' · local changes saved');
 }finally{
  syncing=false;
  if(syncAgain){syncAgain=false;requestSync()}
 }
}
function watchCloud(){
 if(cloudChannel){cloud.removeChannel(cloudChannel);cloudChannel=null}
 if(!cloudUser)return;
 cloudChannel=cloud.channel('little-kitchen-'+cloudUser.id)
  .on('postgres_changes',{
   event:'*',schema:'public',table:'lk_entries',filter:'user_id=eq.'+cloudUser.id
  },()=>requestSync())
  .subscribe();
}
async function startCloud(){
 try{
  if(!window.supabase?.createClient)throw Error('Cloud library did not load');
  cloud=window.supabase.createClient(CLOUD_URL,CLOUD_KEY,{
   auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  cloud.auth.onAuthStateChange((_event,session)=>{
   const next=session?.user||null,changed=cloudUser?.id!==next?.id;
   cloudUser=next;
   if(changed)watchCloud();
   cloudLabel(cloudUser?'Connected · checking changes…':'Sign in on both devices to share');
   if(cloudUser)requestSync();
   if(changed&&tab==='settings')setTimeout(()=>render(true),0);
  });
  const {data,error}=await cloud.auth.getSession();
  if(error)throw error;
  const previousId=cloudUser?.id;
  cloudUser=data.session?.user||null;
  cloudReady=true;
  if(previousId!==cloudUser?.id)watchCloud();
  cloudLabel(cloudUser?'Connected · checking changes…':'Sign in on both devices to share');
  if(cloudUser)requestSync();
 }catch(e){
  console.warn('Cloud unavailable:',e);
  cloudLabel('Cloud unavailable · local saves still work');
 }
}
function playSound(){if(!prefs.sounds)return;try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const osc=ctx.createOscillator(),vol=ctx.createGain();osc.type='sine';osc.frequency.value=740;vol.gain.setValueAtTime(.035,ctx.currentTime);vol.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.1);osc.connect(vol);vol.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.11);osc.onended=()=>ctx.close()}catch{}}
// Grocery detail is a floating card: tapping its dimmed backdrop or Escape closes it.
overlay.addEventListener('click',e=>{
 if(e.target===overlay&&(overlay.classList.contains('grocery-detail-overlay')||overlay.classList.contains('recipe-detail-overlay')))closeOverlay();
});
document.addEventListener('keydown',e=>{
 if(overlay.querySelector('.step-lightbox')){
  if(e.key==='Escape'){e.preventDefault();closeStepPhoto()}
  else if(e.key==='+'||e.key==='='){e.preventDefault();setStepZoom(stepZoom.scale+.5)}
  else if(e.key==='-'){e.preventDefault();setStepZoom(stepZoom.scale-.5)}
  else if(e.key==='0'){e.preventDefault();resetStepZoom()}
  return;
 }
 if(e.key==='Escape'&&!overlay.hidden&&(overlay.classList.contains('grocery-detail-overlay')||overlay.classList.contains('recipe-detail-overlay')))closeOverlay();
});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const act=b.dataset.action,id=b.dataset.id; if(act!=='check-grocery')playSound();try{
 switch(act){case'zoom-step-photo':openStepPhoto(id,Number(b.dataset.index));break;case'close-step-photo':closeStepPhoto();break;case'step-photo-zoom-in':setStepZoom(stepZoom.scale+.5);break;case'step-photo-zoom-out':setStepZoom(stepZoom.scale-.5);break;case'step-photo-reset':resetStepZoom();break;case'tab':activate(b.dataset.tab);break;case'close':closeOverlay();break;case'close-settings':activate('grocery');break;case'new-recipe':editRecipe();break;case'open-recipe':openRecipe(id);break;case'edit-recipe':editRecipe(id);break;case'favorite':{const r=recipes.find(x=>x.id===id);if(r)await save('recipes',{...r,favorite:!r.favorite});break}case'filter':filter=b.dataset.filter;render(true);break;
 case'open-grocery':openGrocery(id);break;case'edit-grocery':editGrocery(id);break;case'remove-grocery-photo':groceryPhotoRevision++;groceryPhotoDraft='';groceryPhotoPending=null;groceryPhotoPreview();break;case'add-grocery-detail':editGrocery(null);break;case'delete-grocery':if(confirm('Delete this grocery item?'))await destroy('groceries',id);break;case'uncheck-purchased':{const bought=groceries.filter(isGroceryChecked);for(const g of bought)await changeLocal('groceries',g.id,{...g,checked:false,checkedAt:null,updatedAt:now()});if(bought.length){await reload();requestSync()}break;}
 case'remove-recipe-cover':readEditor();editDraft.photo='';editDraft.photoCloud=null;renderEditor();break;
 case'remove-recipe-step-photo':readEditor();if(editDraft.steps[Number(b.dataset.index)]){editDraft.steps[Number(b.dataset.index)].photo='';editDraft.steps[Number(b.dataset.index)].photoCloud=null}renderEditor();break;
 case'add-step':readEditor();editDraft.steps.push({id:uid(),text:'',note:'',photo:''});renderEditor();break;case'remove-step':readEditor();editDraft.steps.splice(Number(b.dataset.index),1);if(!editDraft.steps.length)editDraft.steps.push({id:uid(),text:'',note:'',photo:''});renderEditor();break;
 case'delete-recipe':if(confirm('Delete this recipe?')){await destroy('recipes',id);closeOverlay()}break;case'recipe-to-grocery':await addIngredients(id);break;
 case'export':await exportBackup();break;case'import':$('#import-file').click();break;
 case'cloud-sync':await syncCloud();break;case'cloud-signout':if(cloud){await syncCloud();await cloud.auth.signOut();cloudUser=null;cloudLabel('Not connected');render(true)}break;
 }}catch(err){console.error(err);showToast(err.message||'Something went wrong')}});
document.addEventListener('input',e=>{if(e.target.id==='search-recipes'){search=e.target.value;renderCards()}else if(e.target.id==='grocery-search'){grocerySearch=e.target.value;const list=$('#grocery-items');if(list)list.innerHTML=groceryRows()}});
document.addEventListener('change',async e=>{try{if(e.target.dataset.action==='check-grocery'){const g=groceries.find(g=>g.id===e.target.dataset.id);if(g)await save('groceries',{...g,checked:e.target.checked,checkedAt:e.target.checked?now():null})}if(e.target.id==='sounds'){prefs.sounds=e.target.checked;await write('meta',{key:'sounds',value:prefs.sounds});showToast('Sound preference saved')}if(e.target.id==='grocery-photo'&&e.target.files?.[0]){
  const file=e.target.files[0],revision=++groceryPhotoRevision;
  if(file.size>15*1024*1024){showToast('Please choose a photo under 15 MB');e.target.value=''}
  else{
   const pending=imageData(file);
   groceryPhotoPending=pending;
   try{
    const photo=await pending;
    if(groceryPhotoRevision===revision){groceryPhotoDraft=photo;groceryPhotoPreview()}
   }catch(error){
    console.error('Grocery photo:',error);
    if(groceryPhotoRevision===revision)showToast(error.message||'Could not load product photo');
   }finally{
    if(groceryPhotoRevision===revision){groceryPhotoPending=null;e.target.value=''}
   }
  }
 }
 if(e.target.name==='cover-photo'&&e.target.files?.[0]){
 readEditor();const draft=editDraft;
 photoPending=imageData(e.target.files[0]);
 try{const photo=await photoPending;if(editDraft===draft){draft.photo=photo;draft.photoCloud=null;renderEditor()}}
 finally{photoPending=null}
 }
 if(e.target.dataset.stepFile!==undefined&&e.target.files?.[0]){
 readEditor();const draft=editDraft,index=Number(e.target.dataset.stepFile);
 photoPending=imageData(e.target.files[0]);
 try{const photo=await photoPending;if(editDraft===draft&&draft.steps[index]){draft.steps[index].photo=photo;draft.steps[index].photoCloud=null;renderEditor()}}
 finally{photoPending=null}
 }}catch(err){console.error(err);showToast(err.message)}});
document.addEventListener('submit',async e=>{const f=e.target;if(!['recipe-form','grocery-form','cloud-login'].includes(f.id))return;e.preventDefault();try{if(f.id==='recipe-form'){if(photoPending)await photoPending;readEditor();if(!editDraft.title.trim())throw Error('Enter a recipe name');const cover=f.querySelector('[name="cover-photo"]');if(cover.files?.[0]){editDraft.photo=await imageData(cover.files[0]);editDraft.photoCloud=null}editDraft.steps=editDraft.steps.filter(st=>st.text.trim());await save('recipes',editDraft);closeOverlay();showToast('Recipe saved')}if(f.id==='grocery-form'){const data=new FormData(f);const n=String(data.get('name')||'').trim();if(!n)throw Error('Enter item name');const original=groceries.find(x=>x.id===selected)||{id:uid(),checked:false,category:'pantry',createdAt:now()};if(groceryPhotoPending){groceryPhotoDraft=await groceryPhotoPending}const stillChecked=isGroceryChecked(original);await save('groceries',{...original,checked:stillChecked,checkedAt:stillChecked?(original.checkedAt||original.updatedAt):null,name:n,qty:Math.max(.01,Number(data.get('qty'))||1),unit:String(data.get('unit')||''),notes:String(data.get('notes')||''),priority:data.has('priority'),photo:groceryPhotoDraft,photoCloud:groceryPhotoDraft===original.photo?(original.photoCloud||null):null});closeOverlay();showToast('Item saved')}if(f.id==='cloud-login'){if(!cloud)throw Error('Cloud unavailable');cloudLabel('Signing in…');const data=new FormData(f);const res=await cloud.auth.signInWithPassword({email:String(data.get('email')||''),password:String(data.get('password')||'')});if(res.error)throw res.error;cloudUser=res.data.user;cloudReady=true;requestSync();render(true)}}catch(err){console.error(err);showToast(err.message||'Could not save')}});
$('#import-file').addEventListener('change',e=>{const f=e.target.files?.[0];e.target.value='';importBackup(f)});
// An offline launch still works from IndexedDB. Load the cloud client once
// connectivity returns so offline grocery edits are uploaded automatically.
let cloudScriptLoading=false;
function ensureCloudLibrary(){
 if(cloud||cloudScriptLoading||!navigator.onLine)return;
 if(window.supabase?.createClient){startCloud();return}
 cloudScriptLoading=true;
 const script=document.createElement('script');
 script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/dist/umd/supabase.min.js';
 script.onload=()=>{cloudScriptLoading=false;startCloud()};
 script.onerror=()=>{cloudScriptLoading=false;script.remove();cloudLabel('Offline · local saves still work')};
 document.head.appendChild(script);
}
window.addEventListener('online',()=>{ensureCloudLibrary();refreshGroceryDay();scheduleGroceryReset();requestSync()});
window.addEventListener('focus',()=>{ensureCloudLibrary();refreshGroceryDay();scheduleGroceryReset();requestSync()});
window.addEventListener('pageshow',()=>{refreshGroceryDay();scheduleGroceryReset()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){ensureCloudLibrary();refreshGroceryDay();scheduleGroceryReset();requestSync()}});
setInterval(()=>{if(cloudUser)requestSync()},30000);
async function init(){try{db=await openDB();await seedOnce();const meta=await getAll('meta');const settings=meta.find(x=>x.key==='sounds');if(settings)prefs.sounds=settings.value!==false;[recipes,groceries]=await Promise.all([getAll('recipes'),getAll('groceries')]);render();lastGroceryCycle=groceryDayStart();scheduleGroceryReset();prefetchScenes();ensureCloudLibrary()}catch(err){console.error(err);content.innerHTML='<div class="panel">Could not open saved recipes. Please use a regular browser window.</div>'}}
init();
})();
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const en=JSON.parse(fs.readFileSync('public/locales/en.json','utf8'));
const source=p=>fs.readFileSync(p,'utf8');
function storage(blocked=false) {
 const data=new Map();return {getItem:k=>{if(blocked)throw Error('storage denied');return data.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('storage denied');data.set(k,v);},removeItem:k=>data.delete(k)};
}
function app(fetch,blocked=false) {
 const listeners={};
 const nodes={bootstrapRtl:{disabled:true},languageAvailability:{}};
 const document={documentElement:{},querySelectorAll:()=>[],getElementById:id=>nodes[id]||null,addEventListener:(e,f)=>{(listeners[e]??=[]).push(f);},dispatchEvent:e=>(listeners[e.type]||[]).forEach(f=>f(e))};
 const window={BIRDNET_ENGLISH:en,PATH_PREFIX:'/birdnet-live-analyzer/',addEventListener:()=>{}};
 const ctx=vm.createContext({window,document,fetch,localStorage:storage(blocked),navigator:{language:'en-US'},location:{search:''},d3:{},Intl,URLSearchParams,console,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}}});
 vm.runInContext(source('public/js/languages.js'),ctx);ctx.BirdLanguages=window.BirdLanguages;
 vm.runInContext(source('public/js/app.js'),ctx);
 return {ctx,nodes,document,window,run:s=>vm.runInContext(s,ctx)};
}
function localeFetch(url) {const code=url.match(/locales\/([a-z]+)\.json/)[1];return Promise.resolve({ok:true,json:async()=>JSON.parse(source('public/locales/'+code+'.json'))});}
test('100+ unique language choices, native names, regional normalization, RTL',()=>{
 const a=app(localeFetch); const r=a.window.BirdLanguages;
 assert.ok(r.languages.length>=100);assert.equal(new Set(r.languages.map(l=>l.code)).size,r.languages.length);
 assert.equal(r.normalize('he-IL'),'he'); assert.equal(r.normalize('../../evil'),'en');
 assert.equal(r.languages.find(l=>l.code==='ar').dir,'rtl');assert.equal(r.languages.find(l=>l.code==='en').dir,'ltr');
});
test('English Hebrew Arabic cover every UI key and preserve interpolation tokens',()=>{
 for(const lang of ['he','ar']) {
 const translated=JSON.parse(source('public/locales/'+lang+'.json'));
 assert.deepEqual(Object.keys(translated).sort(),Object.keys(en).sort());
 for(const [key,value] of Object.entries(en)) assert.deepEqual(translated[key].match(/\{\d+\}/g)||[],value.match(/\{\d+\}/g)||[],lang+':'+key);
 }
});
test('switch to Hebrew then Arabic then English updates UI, RTL and saved preference',async()=>{
 const a=app(localeFetch);
 for(const lang of ['he','ar','en']) {await a.run(`loadTranslations('${lang}')`);assert.equal(a.document.documentElement.lang,lang);assert.equal(a.document.documentElement.dir,lang==='en'?'ltr':'rtl');assert.equal(a.nodes.bootstrapRtl.disabled,lang==='en');assert.equal(a.ctx.localStorage.getItem('bn_ui_lang'),lang);}
});
test('untranslated choice retains species preference while identifying English UI',async()=>{
 const a=app(localeFetch);await a.run("loadTranslations('ja')");assert.equal(a.document.documentElement.lang,'en');assert.equal(a.run('currentUiLang'),'ja');assert.match(a.nodes.languageAvailability.textContent,/English/);
});
test('offline and blocked storage retain readable embedded English',async()=>{
 const a=app(async()=>{throw Error('offline');},true);await a.run("loadTranslations('he')");assert.equal(a.run("t('btn_start')"),'Start');assert.equal(a.document.documentElement.lang,'en');
});
test('partial pre-existing locale falls back per key to English',async()=>{
 const a=app(async url=>url.includes('/de.')?{ok:true,json:async()=>({btn_start:'Starten'})}:localeFetch(url));
 await a.run("loadTranslations('de')");assert.equal(a.run("t('btn_start')"),'Starten');assert.equal(a.run("t('species_details')"),'Species details');
});
test('an intentionally empty Arabic translation clears the English fallback text',async()=>{
 const a=app(localeFetch);const el={innerHTML:' probability',getAttribute:()=> 'msg_occurrence_hint_post'};
 a.document.querySelectorAll=selector=>selector==='[data-i18n]'?[el]:[];
 await a.run("loadTranslations('ar')");assert.equal(el.innerHTML,'');
});
test('late translation response cannot overwrite a newer selection',async()=>{
 let release;const hold=new Promise(r=>release=r);
 const a=app(async url=>{if(url.includes('/he.'))await hold;return localeFetch(url);});
 const old=a.run("loadTranslations('he')");await a.run("loadTranslations('ar')");release();await old;assert.equal(a.document.documentElement.lang,'ar');
});
function enrichment(fetch,blocked=false){
 const window={PATH_PREFIX:'/birdnet-live-analyzer/'};const ctx=vm.createContext({window,localStorage:storage(blocked),fetch,AbortSignal,URLSearchParams,console:{warn:()=>{}},Date});
 vm.runInContext(source('public/js/birdDataEnricher.js'),ctx);return window.BirdEnricher;
}
function speciesFetch(options={}){
 const calls=[];
 const fetch=async url=>{calls.push(url);let data;
 if(url.includes('w/api.php'))data={query:{pages:{1:{title:'House sparrow',pageprops:{wikibase_item:'Q1'},langlinks:options.noTranslation?[]:[{lang:'he','*':'דרור הבית'}]}}}};
 else if(url.includes('Special:EntityData'))data={entities:{Q1:{claims:{P225:[{mainsnak:{datavalue:{value:options.mismatch?'Wrong species':'Passer domesticus'}}}]}}}};
 else if(url.includes('page/summary'))data={extract:'Description',thumbnail:{source:'https://upload.wikimedia.org/bird.jpg'}};
 else data={results:[{id:10,name:options.inatMismatch?'Wrong species':'Passer domesticus',default_photo:{medium_url:'https://example.org/bird.jpg'}}]};
 return {ok:true,json:async()=>data};};return {fetch,calls};
}
test('verified scientific identity resolves Hebrew name and attributed description',async()=>{
 const f=speciesFetch();const b=enrichment(f.fetch);const r=await b.enrich('Passer domesticus','he');assert.equal(r.localizedName,'דרור הבית');assert.equal(r.descriptionLanguage,'he');assert.equal(r.descriptionSource,'Wikipedia');assert.match(r.wikiUrl,/he.wikipedia.org/);assert.ok(r.imageSourceUrl);
});
test('missing Hebrew source falls back explicitly to English',async()=>{
 const f=speciesFetch({noTranslation:true});const r=await enrichment(f.fetch).enrich('Passer domesticus','he');assert.equal(r.descriptionLanguage,'en');assert.equal(r.nameLanguage,'en');
});
test('wrong species never contributes a localized name, description or iNaturalist ID',async()=>{
 const f=speciesFetch({mismatch:true,inatMismatch:true});const r=await enrichment(f.fetch).enrich('Passer domesticus','he');assert.equal(r.description,undefined);assert.equal(r.localizedName,undefined);assert.equal(r.inatId,null);assert.equal(r.imageUrl,'/birdnet-live-analyzer/img/dummy.webp');
});
test('same species-language shares in-flight lookups and cache; languages stay separate',async()=>{
 const f=speciesFetch();const b=enrichment(f.fetch);const [a,c]=await Promise.all([b.enrich('Passer domesticus','he'),b.enrich('Passer domesticus','he')]);assert.equal(a.description,c.description);const n=f.calls.length;await b.enrich('Passer domesticus','he');assert.equal(f.calls.length,n);await b.enrich('Passer domesticus','en');assert.ok(f.calls.length>n);
});
test('outage, rate limit and storage denial always return a placeholder',async()=>{
 for(const fetch of [async()=>{throw Error('offline');},async()=>({ok:false,status:429})]){
 const b=enrichment(fetch,true);const r=await b.enrich('Passer domesticus','ar');assert.match(r.imageUrl,/dummy.webp$/);assert.ok(b.errors.length>0);
 }
});
test('source concurrency stays bounded',async()=>{
 let active=0,max=0;const b=enrichment(async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;throw Error('offline');});
 await Promise.all(Array.from({length:12},(_,i)=>b.enrich('Species '+i,'en')));assert.ok(max<=4);
});
test('service-worker core includes every new local asset',()=>{
 const sw=source('public/sw.js');for(const path of ['js/languages.js','js/birdDetails.js','locales/he.json','locales/ar.json','vendor/bootstrap/bootstrap.rtl.min.css'])assert.ok(sw.includes('"'+path+'"'));
});
test('localized summary outage retries English without losing the Hebrew name',async()=>{
 const f=speciesFetch();const b=enrichment(async url=>url.includes('he.wikipedia.org/api/rest')?{ok:false,status:503}:f.fetch(url));
 const r=await b.enrich('Passer domesticus','he');assert.equal(r.descriptionLanguage,'en');assert.equal(r.localizedName,'דרור הבית');assert.equal(r.nameLanguage,'he');
});
test('WordPress bridge creates an encoded bilingual link and rejects HTML',()=>{
 const window={};const ctx=vm.createContext({window,URL,document:{createElement:()=>({})}});
 vm.runInContext(source('public/js/birdsOnEarthBridge.js'),ctx);
 const link=window.BirdsOnEarthBridge.createSpeciesLink('Passer domesticus','he');
 const url=new URL(link.href);assert.equal(url.pathname,'/birdnet-live-analyzer/species/');assert.equal(url.searchParams.get('species'),'Passer domesticus');assert.equal(url.searchParams.get('lang'),'he');assert.equal(link.rel,'noopener noreferrer');
 assert.throws(()=>window.BirdsOnEarthBridge.createSpeciesLink('<script>alert(1)</script>'));
});
test('species dialog renders source text without HTML, retains bilingual names and shares the lightweight route',async()=>{
 const a=app(localeFetch);a.ctx.URL=URL;a.ctx.location={origin:'https://example.org',search:''};
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};}
  append(el){this.children.push(el);} replaceChildren(){this.children=[];}
  setAttribute(k,v){this.attributes[k]=v;} focus(){a.document.activeElement=this;}
  showModal(){this.open=true;} close(){this.open=false;}
 }
 a.document.createElement=tag=>new Element(tag);a.document.body=new Element('body');
 a.ctx.BirdEnricher={enrich:async(name,lang)=>({localizedName:lang==='he'?'דרור הבית':'House sparrow',nameLanguage:lang,description:'<img onerror="evil()">',descriptionLanguage:lang,imageUrl:'/bird.jpg',wikiUrl:'https://en.wikipedia.org/wiki/House_sparrow',inatUrl:'https://www.inaturalist.org/taxa/1'}),fallbackImage:()=>'/dummy.webp'};
 vm.runInContext(source('public/js/birdDetails.js'),a.ctx);
 await a.window.BirdDetails.open('Passer domesticus');
 const dialog=a.document.body.children[0];assert.equal(dialog.open,true);assert.equal(dialog.attributes['aria-labelledby'],'speciesDialogTitle');
 const flatten=el=>[el,...el.children.flatMap(flatten)];const nodes=flatten(dialog);
 assert.ok(nodes.some(n=>n.textContent==='HE: דרור הבית'));assert.ok(nodes.some(n=>n.textContent==='EN: House sparrow'));assert.ok(nodes.some(n=>n.textContent==='<img onerror="evil()">'));assert.equal(nodes.filter(n=>n.tag==='img').length,1);
 const share=nodes.find(n=>n.tag==='input');assert.match(share.value,/\/birdnet-live-analyzer\/species\//);assert.equal(new URL(share.value).searchParams.get('species'),'Passer domesticus');
 const count=a.document.body.children.length;await a.window.BirdDetails.open('<svg onload=evil()>');assert.equal(a.document.body.children.length,count);
});
test('species page has no analyzer element and worker remains gated to Live/Explore',()=>{
 assert.ok(!source('src/species.njk').includes('recordButton'));
 assert.match(source('public/js/app.js'),/if \(!isLive && !isExplore\) return;\s+initWorker\(\)/);
});
test('a precached worker response cannot replace its requested configuration URL',async()=>{
 const cached=new Response('/* worker source */',{headers:{'Content-Type':'text/javascript'}});
 Object.defineProperty(cached,'url',{value:'https://example.org/birdnet-live-analyzer/js/birdnet-worker.js'});
 const context=vm.createContext({self:{addEventListener:()=>{}},caches:{open:async()=>({match:async()=>cached})},Response,Request,URL,fetch:async()=>{throw Error('offline');},console});
 vm.runInContext(source('public/sw.js'),context);
 const result=await vm.runInContext("handleConfiguredWorker(new Request('https://example.org/birdnet-live-analyzer/js/birdnet-worker.js?tf=%2Fbirdnet-live-analyzer%2Fjs%2Ftfjs-4.14.0.min.js&lang=ar'))",context);
 assert.equal(result.url,'');assert.equal(await result.text(),'/* worker source */');assert.equal(result.headers.get('Content-Type'),'text/javascript');
});

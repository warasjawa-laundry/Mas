import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createElement,type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const realRequire=createRequire(process.cwd()+'/package.json');
function moduleAt(path:string,mocks:Record<string,unknown>={}){
 const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const out={exports:{} as Record<string,any>};runInNewContext(source,{exports:out.exports,module:out,require:(n:string)=>mocks[n]??realRequire(n),Intl,Map,Set,Number});return out.exports;
}
const catalog=moduleAt('lib/services/catalog.ts');
const Editor=moduleAt('components/admin/service-editor.tsx',{'@/lib/services/catalog':catalog,'@/app/admin/settings/services/actions':{saveService:async()=>({error:''})},'@/components/admin/pending-submit':{default:({label}:Record<string,string>)=>createElement('button',{className:'admin-primary',type:'submit'},label)}}).default;
const View=moduleAt('components/service-prices-view.tsx',{'@/lib/services/catalog':catalog}).default;
const styles=readFileSync('app/globals.css','utf8')+'\n'+readFileSync('app/admin/admin.css','utf8');
const service={id:'00000000-0000-4000-8000-000000000012',category:'Cuci sepatu',package_name:'Reguler',name:'Cuci sneakers',price_idr:35000,unit:'pasang',duration:'2–3 hari',position:20,is_visible:true,revision:1};
for(const width of [320,390,1440])test(`service editor and mixed categories stay usable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.setContent('<style>'+styles+'</style><div class="admin-root"><main class="admin-workspace"><section class="admin-content service-settings"><h1>Layanan dan harga</h1>'+renderToStaticMarkup(createElement(Editor,{service,categories:['Laundry kiloan','Cuci sepatu','Karpet']}))+'</section></main></div>');
 await expect(page.getByLabel('Kategori *',{exact:true})).toHaveValue('Cuci sepatu');await expect(page.getByLabel('Harga (Rp) *',{exact:true})).toHaveValue('35000');
 await expect(page.getByLabel('Satuan *',{exact:true})).toHaveValue('pasang');await page.getByLabel('Harga (Rp) *',{exact:true}).fill('40000');await expect(page.getByLabel('Harga (Rp) *',{exact:true})).toHaveValue('40000');await expect(page.getByRole('checkbox',{name:'Tampilkan di homepage'})).toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 mkdirSync('artifacts/screenshots',{recursive:true});await page.screenshot({path:'artifacts/screenshots/service-editor-'+width+'.png',fullPage:true});
 const services=[service,{...service,id:'b',category:'Karpet',package_name:'',name:'Cuci karpet',unit:'m²',price_idr:15000}];
 await page.setContent('<style>'+styles+'</style><main class="shell section"><h2>Daftar layanan dan harga</h2>'+renderToStaticMarkup(createElement(View,{services}))+'</main>');
 await expect(page.getByText('Rp35.000/pasang',{exact:true})).toBeVisible();await expect(page.getByText('Rp15.000/m²',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:'artifacts/screenshots/service-catalog-'+width+'.png',fullPage:true});
});
test('open homepage refreshes prices and new services automatically, including fallback and failures',async({page})=>{
 let services=[service],failed=false,revision=1;let requests=0;
 await page.clock.install();
 await page.route('**/api/services',async route=>{requests++;await route.fulfill({status:failed?503:200,contentType:'application/json',headers:{ETag:'"'+revision+'"'},body:JSON.stringify(failed?{error:'unavailable'}:{services})})});
 await page.goto('/');await page.clock.runFor(100);
 await expect(page.getByText('Rp35.000/pasang',{exact:true})).toBeVisible();
 services=[{...service,price_idr:40000},{...service,id:'carpet',category:'Karpet',package_name:'',name:'Cuci karpet',price_idr:15000,unit:'m²'}];revision++;
 await page.clock.fastForward(30000);await expect(page.getByText('Rp40.000/pasang',{exact:true})).toBeVisible();await expect(page.getByText('Rp15.000/m²',{exact:true})).toBeVisible();
 services=services.filter(s=>s.id==='carpet');revision++;await page.clock.fastForward(30000);await expect(page.getByText('Cuci sneakers',{exact:true})).toHaveCount(0);
 failed=true;await page.clock.fastForward(30000);await expect(page.getByRole('status').filter({hasText:'Daftar harga belum dapat diperbarui'})).toBeVisible();await expect(page.getByText('Rp15.000/m²',{exact:true})).toBeVisible();
 failed=false;services=[];revision++;await page.clock.fastForward(30000);await expect(page.getByText('Belum ada layanan yang ditampilkan.',{exact:false})).toBeVisible();expect(requests).toBeGreaterThanOrEqual(5);
});
test('catalogue API returns a conditional response and admin pricing requires a fresh owner session',async({request,page})=>{
 const first=await request.get('/api/services');expect(first.status()).toBe(200);const body=await first.json();expect(body.services.length).toBe(8);
 const unchanged=await request.get('/api/services',{headers:{'If-None-Match':first.headers().etag}});expect(unchanged.status()).toBe(304);
 await page.goto('/admin/settings/services');await expect(page).toHaveURL(/\/admin\/login/);await expect(page.getByLabel('Password',{exact:true})).toBeEmpty();
});

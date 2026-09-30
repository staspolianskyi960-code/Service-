
const $ = s => document.querySelector(s);
let db = null, sample = null, parts = [], filter = 'all', canWrite = true, car = null, scanMode = 'part', assets = null, newFiles = [];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s ?? '').trim().toUpperCase().replace(/\s+/g,'');
const docId = pn => norm(pn).replace(/[^A-Z0-9_\-.~:@+]/g,'_').replace(/^\.+$/,'_').slice(0,180) || 'x';
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^0-9.\-]/g,'')); return isNaN(n) ? 0 : n; };
function toast(t){ const el=$('#toast'); el.textContent=t; el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>el.hidden=true,2600); }
function state(p){ const q=p.qty||0, m=p.min||0; return q<=0?'out':(m>0&&q<=m?'low':'ok'); }
function stamp(){ const d=new Date(); return d.toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'}); }

function render(){
  const q = norm($('#q').value), ql = $('#q').value.trim().toLowerCase();
  let rows = parts.filter(p => filter==='all' || state(p)===filter || (filter==='low' && state(p)==='out'));
  if (q) rows = rows.filter(p => norm(p.pn).includes(q) || (p.name||'').toLowerCase().includes(ql) || norm(p.bin).includes(q));
  rows.sort((a,b)=> String(a.bin||'~').localeCompare(String(b.bin||'~'),'uk',{numeric:true}) || a.pn.localeCompare(b.pn));
  $('#sPos').textContent = parts.length;
  $('#sUnits').textContent = parts.reduce((s,p)=>s+(p.qty||0),0);
  const low = parts.filter(p=>state(p)!=='ok').length;
  $('#sLow').textContent = low; $('#sLowBox').classList.toggle('alert', low>0);
  const L = $('#list');
  if (!parts.length){ L.innerHTML = `<div class="empty"><strong>Склад поки порожній</strong>Додайте першу запчастину кнопкою «+ Нова запчастина», відскануйте коробку або завантажте список з Екселя.</div>`; return; }
  if (!rows.length){ L.innerHTML = `<div class="empty"><strong>Нічого не знайдено</strong>${q?`Номера «${esc($('#q').value)}» немає. <br><br><button class="primary" id="addFound">Додати ${esc($('#q').value.trim())}</button>`:'У цьому фільтрі порожньо.'}</div>`;
    const b=$('#addFound'); if(b) b.onclick=()=>openEdit({pn:$('#q').value.trim()}); return; }
  L.innerHTML = rows.slice(0,400).map(p=>{ const s=state(p); return `<button class="row" data-id="${esc(p.id)}">
    <span class="bin ${p.bin?'':'none'}">${esc(p.bin||'—')}</span>
    <span class="info" style="display:flex;gap:10px;align-items:center">${p.photos&&p.photos[0]?`<img class="thumb" src="${photoUrl(p.photos[0])}" alt="" loading="lazy">`:''}<span style="min-width:0"><div class="pn">${esc(p.pn)}</div><div class="nm">${esc(p.name||'Без назви')}</div></span></span>
    <span class="qty ${s==='ok'?'':s}">${p.qty||0}<small>${s==='out'?'немає':s==='low'?'мало':'шт'}</small></span></button>`; }).join('')
    + (rows.length>400?`<div class="empty">Показано 400 з ${rows.length}. Уточніть пошук.</div>`:'');
  L.querySelectorAll('.row').forEach(r=>r.onclick=()=>openPart(r.dataset.id));
}

function closeSheet(){ $('#scrim').hidden=true; $('#sheet').innerHTML=''; }
$('#scrim').addEventListener('click',e=>{ if(e.target.id==='scrim') closeSheet(); });

async function save(p){
  
  try{ const {id,...body}=p; await db.collection('parts').doc(id).set(body); return true; }
  catch(e){ if(e.code==='invalid_argument'){canWrite=false;} toast('Не вдалося зберегти. Можливо, закінчилось місце на пристрої.'); return false; }
}

function openPart(id){
  const p = parts.find(x=>x.id===id); if(!p) return;
  let delta = 0;
  const S=$('#sheet');
  const draw=()=>{
    const h=(p.history||[]).slice().reverse();
    S.innerHTML=`<div class="sheet-head"><div><h2 class="pn">${esc(p.pn)}</h2><div class="note">${esc(p.name||'Без назви')}${p.bin?` · полиця <b>${esc(p.bin)}</b>`:''}${p.price?` · $${p.price}`:''}</div></div><button class="close" id="x">Закрити</button></div>
    <div class="big"><button id="m" aria-label="Мінус один">−</button><div class="n" id="n">${(p.qty||0)+delta}</div><button id="pl" aria-label="Плюс один">+</button></div>
    <div class="note" style="text-align:center">${delta===0?`Зараз на складі. Мінімум: ${p.min||'не задано'}`:`${delta>0?'Прихід +':'Видача '}${delta} шт.${delta<0&&car?` для ${esc(carName(car))}`:''}`}</div>
    ${p.fits?`<div class="note">Підходить до: ${esc(p.fits)}</div>`:''}
    ${(p.photos&&p.photos.length)||assets?`<div><div class="sec">Фото</div><div class="photos">${(p.photos||[]).map(id=>`<button class="ph" data-ph="${esc(id)}" aria-label="Відкрити фото"><img src="${photoUrl(id)}" alt="Фото ${esc(p.pn)}" loading="lazy"></button>`).join('')}${assets?`<button class="ph add" id="addPh"><b>+</b>Додати</button>`:''}</div></div>`:''}
    <div class="actions"><button class="primary" id="ok" ${delta===0?'disabled':''}>Зберегти</button><button id="ed">Редагувати</button></div>
    ${h.length?`<div><div class="note">Історія</div><div class="hist">${h.map(x=>`<div><span>${esc(x.t)}${x.vin?` · …${esc(x.vin.slice(-6))}`:''}</span><span class="${x.d>0?'plus':'minus'}">${x.d>0?'+':''}${x.d}</span><span>→ ${x.q}</span></div>`).join('')}</div></div>`:''}`;
    $('#x').onclick=closeSheet;
    $('#m').onclick=()=>{ if((p.qty||0)+delta>0){delta--;draw();} };
    $('#pl').onclick=()=>{ delta++; draw(); };
    $('#ed').onclick=()=>openEdit(p);
    S.querySelectorAll('[data-ph]').forEach(b=>b.onclick=()=>viewPhoto(p,b.dataset.ph));
    const ap=$('#addPh'); if(ap) ap.onclick=()=>{ photoTarget=p.id; $('#photoFile').click(); };
    $('#ok').onclick=async()=>{
      const nq=(p.qty||0)+delta;
      const entry={t:stamp(),d:delta,q:nq}; if(delta<0&&car) entry.vin=car.vin;
      const hist=[...(p.history||[]),entry].slice(-40);
      const vins=(delta<0&&car)?[...new Set([...(p.vins||[]),car.vin])].slice(-50):(p.vins||[]);
      if(await save({...p,qty:nq,history:hist,vins,updated:Date.now()})){ toast(`${p.pn}: ${delta>0?'+':''}${delta}, залишок ${nq}`); closeSheet(); }
    };
  };
  draw(); $('#scrim').hidden=false;
}

function openEdit(p0){
  const isNew=!p0.id; const {_photo, ...rest}=p0; const p={pn:'',name:'',qty:0,min:0,bin:'',price:'',supplier:'',...rest};
  newFiles = _photo ? [_photo] : [];
  const S=$('#sheet');
  S.innerHTML=`<div class="sheet-head"><h2>${isNew?'Нова запчастина':'Редагувати'}</h2><button class="close" id="x">Закрити</button></div>
  <form id="f" class="grid2">
    <label>Номер деталі<input id="e_pn" value="${esc(p.pn)}" required></label>
    <label>Назва<input id="e_name" value="${esc(p.name)}" placeholder="напр. фільтр масляний"></label>
    <label>Кількість<input id="e_qty" type="number" inputmode="numeric" min="0" value="${p.qty||0}"></label>
    <label>Мінімум (попередити)<input id="e_min" type="number" inputmode="numeric" min="0" value="${p.min||0}"></label>
    <label>Полиця / місце<input id="e_bin" value="${esc(p.bin)}" placeholder="напр. A-03"></label>
    <label>Ціна, $<input id="e_price" type="number" inputmode="decimal" step="0.01" value="${esc(p.price)}"></label>
    <label style="grid-column:1/-1">Постачальник<input id="e_sup" value="${esc(p.supplier)}"></label>
    <label style="grid-column:1/-1">Підходить до (через ;)<input id="e_fits" value="${esc(p.fits||'')}" placeholder="Outlander 2014-2020 2.4; Outlander Sport 2011-2024"></label>
    ${isNew&&assets?`<div class="field" style="grid-column:1/-1"><span>Фото</span><div class="vinbar"><button type="button" id="e_ph">Додати фото</button><span id="e_phn" class="note">${newFiles.length?'Фото зі сканування буде збережено':''}</span></div></div>`:''}
    <div class="actions" style="grid-column:1/-1"><button class="primary" type="submit">Зберегти</button>${isNew?'':'<button type="button" class="danger" id="del">Видалити</button>'}</div>
    <div id="cf" style="grid-column:1/-1"></div>
  </form>`;
  $('#x').onclick=closeSheet;
  $('#f').onsubmit=async e=>{ e.preventDefault();
    const pn=$('#e_pn').value.trim(); if(!pn){toast('Вкажіть номер деталі');return;}
    const id=docId(pn);
    if(isNew && parts.some(x=>x.id===id)){ toast('Такий номер вже є'); openPart(id); return; }
    const rec={...p,id:isNew?id:p.id,pn:norm(pn),name:$('#e_name').value.trim(),qty:Math.max(0,Math.round(num($('#e_qty').value))),min:Math.max(0,Math.round(num($('#e_min').value))),bin:$('#e_bin').value.trim().toUpperCase(),price:$('#e_price').value?num($('#e_price').value):'',supplier:$('#e_sup').value.trim(),fits:$('#e_fits').value.trim(),updated:Date.now()};
    if(!isNew && (p.qty||0)!==rec.qty) rec.history=[...(p.history||[]),{t:stamp(),d:rec.qty-(p.qty||0),q:rec.qty}].slice(-40);
    if(isNew && newFiles.length && assets){ toast('Завантажую фото…'); rec.photos=await uploadFiles(newFiles); }
    if(await save(rec)){ toast('Збережено'); closeSheet(); }
  };
  const eph=$('#e_ph'); if(eph) eph.onclick=()=>{ photoTarget='__new'; $('#photoFile').click(); };
  const d=$('#del'); if(d) d.onclick=()=>{ $('#cf').innerHTML=`<div class="confirm">Видалити ${esc(p.pn)} зі складу назавжди?<div class="actions"><button type="button" class="danger" id="yes">Так, видалити</button><button type="button" id="no">Ні</button></div></div>`;
    $('#no').onclick=()=>$('#cf').innerHTML='';
    $('#yes').onclick=async()=>{ try{ await db.collection('parts').doc(p.id).delete(); toast('Видалено'); closeSheet(); }catch(e){ toast('Не вдалося видалити'); } }; };
  $('#scrim').hidden=false; if(isNew && !p.pn) setTimeout(()=>$('#e_pn').focus(),50);
}

/* ---------- Scanning ---------- */
$('#scanBtn').onclick=()=>openLive('part');
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej({code:'timeout'}),ms))]);
function stage(t){ const r=$('#vres'); if(scanMode==='vin' && r) r.innerHTML=`<p class="note">${esc(t)}</p>`; else toast(t); }
const asVin=s=>{ let raw=String(s||'').toUpperCase().trim(); if(raw.length===18&&raw[0]==='I') raw=raw.slice(1); const m=cleanVin(raw).match(/[A-HJ-NPR-Z0-9]{17}/); return m?m[0]:null; };
function foundCode(code, file){
  const c=norm(code);
  const hit=parts.find(p=>norm(p.pn)===c || norm(p.barcode)===c || docId(p.pn)===docId(c));
  if(hit){ openPart(hit.id); return; }
  $('#q').value=code; render();
  openEdit({pn:code, barcode:c, _photo:file||null});
  toast('Нова деталь — заповніть і збережіть');
}

/* ---------- Excel import ---------- */
$('#importBtn').onclick=()=>$('#xlsFile').click();
$('#xlsFile').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  if(!window.XLSX){ toast('Бібліотека Екселя не завантажилась'); return; }
  const wb=XLSX.read(await f.arrayBuffer());
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''}).filter(r=>r.some(c=>String(c).trim()));
  if(rows.length<2){ toast('У файлі немає рядків'); return; }
  const head=rows[0].map(h=>String(h).toLowerCase());
  const guess=re=>head.findIndex(h=>re.test(h));
  const map={pn:guess(/part|номер|артикул|number|№|p\/n|pn/), name:guess(/name|desc|назв|опис/), qty:guess(/qty|quant|кільк|кол|шт|stock|on hand/), bin:guess(/bin|loc|shelf|полиц|місц|место/), min:guess(/min|мін/), price:guess(/price|cost|ціна|цена/)};
  if(map.pn<0) map.pn=0;
  const opts=head.map((h,i)=>`<option value="${i}">${esc(rows[0][i]||('Колонка '+(i+1)))}</option>`).join('');
  const sel=(k,l)=>`<label>${l}<select id="m_${k}"><option value="-1">— немає —</option>${opts}</select></label>`;
  const S=$('#sheet');
  S.innerHTML=`<div class="sheet-head"><h2>Імпорт: ${rows.length-1} рядків</h2><button class="close" id="x">Закрити</button></div>
  <div class="note">Перевірте, яка колонка що означає. Якщо номер уже є на складі, дані оновляться.</div>
  <div class="grid2">${sel('pn','Номер деталі')}${sel('name','Назва')}${sel('qty','Кількість')}${sel('bin','Полиця')}${sel('min','Мінімум')}${sel('price','Ціна')}</div>
  <div class="preview"><table>${rows.slice(0,6).map((r,i)=>`<tr>${r.map(c=>i?`<td>${esc(c)}</td>`:`<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table></div>
  <div class="actions"><button class="primary" id="go">Імпортувати</button></div><div class="note" id="prog"></div>`;
  Object.entries(map).forEach(([k,v])=>$('#m_'+k).value=v);
  $('#x').onclick=closeSheet; $('#scrim').hidden=false;
  $('#go').onclick=async()=>{
    if(!db){ toast('Немає збереження'); return; }
    const m={}; Object.keys(map).forEach(k=>m[k]=+$('#m_'+k).value);
    if(m.pn<0){ toast('Виберіть колонку з номером'); return; }
    $('#go').disabled=true; let ok=0, skip=0;
    const byId=new Map(parts.map(p=>[p.id,p]));
    const data=rows.slice(1);
    for(let i=0;i<data.length;i++){
      const r=data[i], pn=String(r[m.pn]??'').trim(); if(!pn){skip++;continue;}
      const id=docId(pn), old=byId.get(id)||{};
      const rec={...old,pn:norm(pn),name:m.name>=0?String(r[m.name]).trim():(old.name||''),qty:m.qty>=0?Math.max(0,Math.round(num(r[m.qty]))):(old.qty||0),bin:m.bin>=0?String(r[m.bin]).trim().toUpperCase():(old.bin||''),min:m.min>=0?Math.round(num(r[m.min])):(old.min||0),price:m.price>=0&&String(r[m.price]).trim()?num(r[m.price]):(old.price||''),updated:Date.now()};
      delete rec.id;
      try{ await db.collection('parts').doc(id).set(rec); ok++; }catch(e){ if(e.code==='quota_exceeded'){ toast('Сховище заповнене'); break; } skip++; }
      if(i%20===0) $('#prog').textContent=`Завантажено ${ok} з ${data.length}…`;
    }
    toast(`Імпортовано ${ok}${skip?`, пропущено ${skip}`:''}`); closeSheet();
  };
};

/* ---------- Photos ---------- */
let photoTarget=null;
async function compress(file){
  try{
    const bmp=await createImageBitmap(file); const k=Math.min(1,1600/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas'); c.width=Math.round(bmp.width*k); c.height=Math.round(bmp.height*k);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||file),'image/jpeg',0.82));
  }catch(_){ return file; }
}
async function uploadFiles(files){
  const ids=[];
  for(const f of files){
    try{ const b=await compress(f); const r=await assets.upload(b,{type:b.type||'image/jpeg'}); ids.push(r.id); }
    catch(e){ toast(e.code==='too_large'?'Фото завелике':e.code==='quota_or_state'?'Місце для фото закінчилось':'Фото не завантажилось'); }
  }
  return ids;
}
$('#photoFile').onchange=async e=>{
  const files=[...e.target.files]; e.target.value=''; if(!files.length||!photoTarget||!assets) return;
  if(photoTarget==='__new'){ newFiles.push(...files); const l=$('#e_phn'); if(l) l.textContent=`Вибрано фото: ${newFiles.length}`; return; }
  const p=parts.find(x=>x.id===photoTarget); if(!p) return;
  toast(`Завантажую ${files.length} фото…`);
  const ids=await uploadFiles(files); if(!ids.length) return;
  const fresh=parts.find(x=>x.id===p.id)||p;
  if(await save({...fresh,photos:[...(fresh.photos||[]),...ids].slice(-12),updated:Date.now()})){ toast('Фото додано'); setTimeout(()=>openPart(p.id),300); }
};
function viewPhoto(p,id){
  const S=$('#sheet');
  S.innerHTML=`<div class="sheet-head"><h2 class="pn">${esc(p.pn)}</h2><button class="close" id="x">Назад</button></div>
  <img class="bigimg" src="${photoUrl(id)}" alt="Фото ${esc(p.pn)}">
  ${assets?`<div class="actions"><button class="danger" id="phDel">Видалити фото</button></div><div id="cf"></div>`:''}`;
  $('#x').onclick=()=>openPart(p.id);
  const d=$('#phDel'); if(d) d.onclick=()=>{ $('#cf').innerHTML=`<div class="confirm">Видалити це фото?<div class="actions"><button class="danger" id="yes">Так, видалити</button><button id="no">Ні</button></div></div>`;
    $('#no').onclick=()=>$('#cf').innerHTML='';
    $('#yes').onclick=async()=>{ const fresh=parts.find(x=>x.id===p.id)||p;
      if(await save({...fresh,photos:(fresh.photos||[]).filter(x=>x!==id),updated:Date.now()})){ try{ await assets.delete(id); }catch(_){} toast('Фото видалено'); setTimeout(()=>openPart(p.id),300); } }; };
}

/* ---------- VIN ---------- */
const WMI={"JA3": "Mitsubishi", "JA4": "Mitsubishi", "JA7": "Mitsubishi", "ML3": "Mitsubishi", "4A3": "Mitsubishi", "4A4": "Mitsubishi", "JMY": "Mitsubishi", "JMB": "Mitsubishi", "JA32": "Mitsubishi", "JM1": "Mazda", "JM3": "Mazda", "JM7": "Mazda", "3MZ": "Mazda", "3MV": "Mazda", "3MD": "Mazda", "4F2": "Mazda", "4F4": "Mazda", "1YV": "Mazda", "7MM": "Mazda", "JHM": "Honda", "JHL": "Honda", "JHG": "Honda", "1HG": "Honda", "2HG": "Honda", "3HG": "Honda", "5FN": "Honda", "5J6": "Honda", "5FP": "Honda", "7FA": "Honda", "2HK": "Honda", "3CZ": "Honda", "LUC": "Honda", "JH4": "Acura", "19U": "Acura", "19V": "Acura", "2HN": "Acura", "5J8": "Acura", "5FR": "Acura", "JTD": "Toyota", "JTE": "Toyota", "JTK": "Toyota", "JTL": "Toyota", "JTM": "Toyota", "JTN": "Toyota", "JTH": "Lexus", "JTJ": "Lexus", "2T2": "Lexus", "58A": "Lexus", "4T1": "Toyota", "4T3": "Toyota", "4T4": "Toyota", "5TD": "Toyota", "5TF": "Toyota", "5TB": "Toyota", "5TE": "Toyota", "5TN": "Toyota", "5YF": "Toyota", "2T1": "Toyota", "2T3": "Toyota", "3TM": "Toyota", "3TY": "Toyota", "7MU": "Toyota", "JN1": "Nissan", "JN6": "Nissan", "JN8": "Nissan", "1N4": "Nissan", "1N6": "Nissan", "3N1": "Nissan", "3N6": "Nissan", "5N1": "Nissan", "4N2": "Nissan", "JNK": "Infiniti", "JNR": "Infiniti", "5N3": "Infiniti", "JF1": "Subaru", "JF2": "Subaru", "4S3": "Subaru", "4S4": "Subaru", "4S6": "Subaru", "JS1": "Suzuki", "JS2": "Suzuki", "JS3": "Suzuki", "2S3": "Suzuki", "KL5": "Suzuki", "KMH": "Hyundai", "KM8": "Hyundai", "5NP": "Hyundai", "5NM": "Hyundai", "5NT": "Hyundai", "KMU": "Genesis", "KMT": "Genesis", "KNA": "Kia", "KNC": "Kia", "KND": "Kia", "KNM": "Kia", "5XX": "Kia", "5XY": "Kia", "3KP": "Kia", "1FA": "Ford", "1FB": "Ford", "1FC": "Ford", "1FD": "Ford", "1FM": "Ford", "1FT": "Ford", "1FU": "Ford", "1FV": "Ford", "2FA": "Ford", "2FM": "Ford", "2FT": "Ford", "3FA": "Ford", "3FT": "Ford", "3FM": "Ford", "NM0": "Ford", "WF0": "Ford", "MAJ": "Ford", "1LN": "Lincoln", "2LM": "Lincoln", "5LM": "Lincoln", "3LN": "Lincoln", "1ME": "Mercury", "2ME": "Mercury", "4M2": "Mercury", "1G1": "Chevrolet", "1GC": "Chevrolet", "1GB": "Chevrolet", "1GN": "Chevrolet", "2G1": "Chevrolet", "3G1": "Chevrolet", "3GC": "Chevrolet", "3GN": "Chevrolet", "KL1": "Chevrolet", "KL7": "Chevrolet", "1GT": "GMC", "1GK": "GMC", "2GT": "GMC", "3GT": "GMC", "3GK": "GMC", "1G4": "Buick", "2G4": "Buick", "5GA": "Buick", "KL4": "Buick", "LRB": "Buick", "1G6": "Cadillac", "1GY": "Cadillac", "3GY": "Cadillac", "1G2": "Pontiac", "2G2": "Pontiac", "5Y2": "Pontiac", "1G8": "Saturn", "5GZ": "Saturn", "5GR": "Hummer", "1C3": "Chrysler", "2C3": "Chrysler", "1C4": "Chrysler/Jeep/Dodge", "2C4": "Chrysler/Dodge", "3C4": "Chrysler/Dodge", "1C6": "Ram", "3C6": "Ram", "3C7": "Ram", "1D7": "Dodge", "1D3": "Dodge", "2B3": "Dodge", "2D3": "Dodge", "2D4": "Dodge", "1B3": "Dodge", "3D7": "Dodge", "1J4": "Jeep", "1J8": "Jeep", "ZAC": "Jeep", "ZFA": "Fiat", "3C3": "Fiat", "ZAR": "Alfa Romeo", "5YJ": "Tesla", "7SA": "Tesla", "LRW": "Tesla", "7FC": "Rivian", "WVW": "Volkswagen", "WVG": "Volkswagen", "WV1": "Volkswagen", "WV2": "Volkswagen", "3VW": "Volkswagen", "3VV": "Volkswagen", "1VW": "Volkswagen", "9BW": "Volkswagen", "WAU": "Audi", "WA1": "Audi", "TRU": "Audi", "WP0": "Porsche", "WP1": "Porsche", "TMB": "Skoda", "VSS": "SEAT", "ZHW": "Lamborghini", "SCB": "Bentley", "WBA": "BMW", "WBS": "BMW", "WBX": "BMW", "WBY": "BMW", "5UX": "BMW", "5UJ": "BMW", "4US": "BMW", "WMW": "Mini", "SCA": "Rolls-Royce", "WB1": "BMW Motorrad", "WDB": "Mercedes-Benz", "WDC": "Mercedes-Benz", "WDD": "Mercedes-Benz", "WDF": "Mercedes-Benz", "W1K": "Mercedes-Benz", "W1N": "Mercedes-Benz", "W1V": "Mercedes-Benz", "4JG": "Mercedes-Benz", "55S": "Mercedes-Benz", "WD3": "Mercedes-Benz", "WD4": "Mercedes-Benz", "WME": "Smart", "YV1": "Volvo", "YV4": "Volvo", "7JR": "Volvo", "LYV": "Volvo", "LPS": "Polestar", "SAL": "Land Rover", "SAJ": "Jaguar", "ZFF": "Ferrari", "ZAM": "Maserati", "SCC": "Lotus", "SCF": "Aston Martin", "VF1": "Renault", "VF3": "Peugeot", "VF7": "Citroen", "W0L": "Opel", "W0V": "Opel", "YS3": "Saab", "SAR": "Rover", "LVS": "Ford (China)", "LSG": "GM (China)", "LHG": "Honda (China)", "MR0": "Toyota (Thailand)", "MNT": "Nissan (Thailand)", "MA3": "Suzuki (India)"};
const REGION={"1": "США", "4": "США", "5": "США", "2": "Канада", "3": "Мексика", "J": "Японія", "K": "Корея", "L": "Китай", "W": "Німеччина", "S": "Велика Британія", "Z": "Італія", "V": "Франція/Іспанія", "Y": "Швеція/Фінляндія", "T": "Швейцарія/Чехія", "9": "Бразилія", "M": "Індія/Таїланд", "X": "Росія/Нідерланди"};
function makeOf(v){ return WMI[v.slice(0,3)]||''; }
function regionOf(v){ return REGION[v[0]]||''; }
const cleanVin=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/[IOQ]/g,c=>({I:'1',O:'0',Q:'0'}[c]));
function vinCheck(v){ const tr='0123456789.ABCDEFGH..JKLMN.P.R..STUVWXYZ', w=[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  let s=0; for(let i=0;i<17;i++){ const c=v[i]; const n=/\d/.test(c)?+c:((tr.indexOf(c)%10)); s+=n*w[i]; } const r=s%11; return (r===10?'X':String(r))===v[8]; }
function vinYear(v){ const k='ABCDEFGHJKLMNPRSTVWXY123456789', i=k.indexOf(v[9]); if(i<0) return null;
  const max=new Date().getFullYear()+1; let y=1980+i; while(y+30<=max) y+=30; return y; }
function carName(c){ return [c.year,c.make,c.model,c.engine].filter(Boolean).join(' ') || c.vin; }
const nm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9а-яіїєґ*.]/g,'');
function parseFits(str){ return String(str||'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>{
  const m=s.match(/(\d{4})\s*(?:[-–—]\s*(\d{4}))?/); let model=s, from=null, to=null, engine='';
  if(m){ model=s.slice(0,m.index).trim(); from=+m[1]; to=m[2]?+m[2]:+m[1]; engine=s.slice(m.index+m[0].length).trim(); }
  return {model,from,to,engine}; }); }
function fitsCar(p,c){
  if((p.vins||[]).includes(c.vin)) return 'used';
  const cm=nm(c.model), ce=String(c.engine||'');
  for(const f of parseFits(p.fits)){
    const fm=nm(f.model); if(!fm||!cm) continue;
    const okModel = fm.endsWith('*') ? cm.startsWith(fm.slice(0,-1)) : fm===cm;
    if(!okModel) continue;
    if(f.from && c.year && (c.year<f.from || c.year>f.to)) continue;
    const eng=(f.engine.match(/\d\.\d/)||[])[0]; if(eng && ce && !ce.includes(eng)) continue;
    return 'fits';
  }
  return null;
}
function setCar(c){ car=c; const ch=$('#carChip');
  if(!c){ ch.hidden=true; return; }
  ch.innerHTML=`<span>Авто: ${esc(carName(c))}</span><button id="carX" aria-label="Прибрати авто">✕</button>`; ch.hidden=false;
  $('#carX').onclick=()=>{ setCar(null); toast('Авто прибрано'); }; }
async function decodeVin(vin){
  const base={vin, year:vinYear(vin), make:makeOf(vin), country:regionOf(vin), model:'', engine:''};
  if(db){ try{ const s=await db.collection('vins').doc(vin).get(); if(s.exists) return {...base,...s.data(),cached:true}; }catch(_){} }
  return base;
}
function openVin(prefill){
  const S=$('#sheet');
  S.innerHTML=`<div class="sheet-head"><h2>Пошук по VIN</h2><button class="close" id="x">Закрити</button></div>
  <form id="vf" class="vinbar"><input id="vin" maxlength="20" placeholder="17 символів VIN" autocapitalize="characters" autocomplete="off" value="${esc(prefill||'')}" style="flex:1 1 200px;font-family:var(--f-mono)"><button class="primary" type="submit">Знайти</button></form>
  <div class="actions"><button type="button" class="primary" id="vinLive">Сканувати VIN камерою</button><button type="button" id="vinPhoto">З фото</button></div>
  <div id="vres"></div>`;
  $('#x').onclick=closeSheet;
  $('#vinPhoto').onclick=()=>{ scanMode='vin'; $('#scanFile').click(); };
  $('#vinLive').onclick=()=>openLive('vin');
  $('#vf').onsubmit=e=>{ e.preventDefault(); runVin($('#vin').value); };
  $('#scrim').hidden=false;
  if(prefill) runVin(prefill); else setTimeout(()=>$('#vin').focus(),50);
}
async function runVin(raw){
  const vin=cleanVin(raw), R=$('#vres');
  if(vin.length!==17){ R.innerHTML=`<p class="note">VIN має 17 символів, а введено ${vin.length}.</p>`; return; }
  const warn = vinCheck(vin) ? '' : '<p class="note" style="color:var(--warn)">Контрольна цифра не збігається — перевірте, чи правильно введено VIN.</p>';
  R.innerHTML=warn+'<p class="note">Шукаю…</p>';
  const c=await decodeVin(vin);
  R.innerHTML=`${warn}<div class="car">
    <div class="title" id="c_title">${esc(carName(c))}</div>
    <div class="note">${c.country?'Країна складання: '+esc(c.country):''}</div>
    <div class="note" id="c_note">${c.cached?'Це авто вже є в базі.':'Отримую дані з бази NHTSA…'}</div>
    <div class="grid2">
      <label>Марка<input id="c_make" value="${esc(c.make)}"></label>
      <label>Модель<input id="c_model" value="${esc(c.model)}" placeholder="напр. Outlander"></label>
      <label>Рік<input id="c_year" type="number" inputmode="numeric" value="${esc(c.year||'')}"></label>
      <label>Двигун<input id="c_eng" value="${esc(c.engine)}" placeholder="напр. 2.4L"></label>
    </div>
    <div class="actions"><button class="primary" id="c_ok">Показати запчастини</button></div>
  </div><div id="vparts"></div>`;
  $('#c_ok').onclick=async()=>{
    const cc={vin, make:$('#c_make').value.trim(), model:$('#c_model').value.trim(), year:+$('#c_year').value||null, engine:$('#c_eng').value.trim()};
    if(db){ try{ await db.collection('vins').doc(vin).set({...cc, updated:Date.now()}); }catch(_){} }
    setCar(cc); showCarParts(cc);
  };
  if(c.cached){ $('#c_ok').click(); return; }
  const a=await askVin(c);
  if(!$('#c_model') || cleanVin($('#vin')?.value)!==vin) return;
  if(a.err){ $('#c_note').textContent=a.err; return; }
  if(a.make) $('#c_make').value=a.make;
  if(a.model) $('#c_model').value=a.model;
  if(a.year) $('#c_year').value=a.year;
  if(a.engine) $('#c_eng').value=a.engine;
  $('#c_title').textContent=carName({...c,year:+$('#c_year').value||c.year,make:$('#c_make').value,model:$('#c_model').value,engine:$('#c_eng').value});
  $('#c_note').textContent=[a.trim,a.body,a.drive].filter(Boolean).join(' · ')||'Дані з бази NHTSA. Перевірте і натисніть «Показати запчастини».';
}
function showCarParts(c){
  const used=[], fits=[];
  parts.forEach(p=>{ const f=fitsCar(p,c); if(f==='used') used.push(p); else if(f) fits.push(p); });
  const row=p=>{ const s=state(p); return `<button class="row" data-id="${esc(p.id)}"><span class="bin ${p.bin?'':'none'}">${esc(p.bin||'—')}</span><span class="info"><div class="pn">${esc(p.pn)}</div><div class="nm">${esc(p.name||'Без назви')}</div></span><span class="qty ${s==='ok'?'':s}">${p.qty||0}<small>${s==='out'?'немає':s==='low'?'мало':'шт'}</small></span></button>`; };
  const V=$('#vparts');
  V.innerHTML = (used.length?`<div class="sec">Вже ставили на це авто</div><div class="list">${used.map(row).join('')}</div>`:'')
    + (fits.length?`<div class="sec">Підходять за моделлю і роком</div><div class="list">${fits.map(row).join('')}</div>`:'')
    + (!used.length&&!fits.length?`<div class="empty"><strong>Для ${esc(c.model||'цього авто')} нічого не знайдено</strong>Програма шукає за полем «Підходить до» у картках деталей. Заповніть його, наприклад «${esc(c.model||'Outlander')} ${c.year?(c.year-3)+'-'+(c.year+3):'2014-2020'}».</div>`:'')
    + `<p class="note">Авто вибране. Тепер при видачі деталі VIN запишеться в історію, і наступного разу вона з'явиться в «Вже ставили».</p>`;
  V.querySelectorAll('.row').forEach(r=>r.onclick=()=>openPart(r.dataset.id));
}
$('#vinBtn').onclick=()=>openVin(car?car.vin:'');

/* ---------- UI wiring ---------- */
$('#q').addEventListener('input',render);
$('#q').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const c=norm($('#q').value); const hit=parts.find(p=>norm(p.pn)===c); if(hit) openPart(hit.id); }});
document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{ filter=b.dataset.f; document.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x===b)); render(); });
$('#addBtn').onclick=()=>openEdit({});
render();

/* ---------- Local storage on this device (IndexedDB) ---------- */
const idb=(()=>{
  let p;
  const open=()=>p||(p=new Promise((res,rej)=>{ const r=indexedDB.open('sklad',1);
    r.onupgradeneeded=()=>{ for(const s of ['parts','vins','photos']) if(!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }));
  const run=async(store,mode,fn)=>{ const d=await open(); return new Promise((res,rej)=>{ const t=d.transaction(store,mode), st=t.objectStore(store); let out; const rq=fn(st); if(rq) rq.onsuccess=()=>{ out=rq.result; }; t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); }); };
  return {
    get:(s,k)=>run(s,'readonly',st=>st.get(k)),
    put:(s,k,v)=>run(s,'readwrite',st=>st.put(v,k)),
    del:(s,k)=>run(s,'readwrite',st=>st.delete(k)),
    entries:async s=>{ const [keys,vals]=await Promise.all([run(s,'readonly',st=>st.getAllKeys()),run(s,'readonly',st=>st.getAll())]); return keys.map((k,i)=>[k,vals[i]]); }
  };
})();
const listeners={};
async function emit(name){ const rows=await idb.entries(name); const snap={docs:rows.map(([k,v])=>({id:k,data:()=>v}))}; (listeners[name]||[]).forEach(cb=>cb(snap)); }
db={ collection(name){ return {
  doc(id){ return {
    async get(){ const v=await idb.get(name,id); return {exists:v!==undefined, data:()=>v}; },
    async set(v){ await idb.put(name,id,v); emit(name); },
    async delete(){ await idb.del(name,id); emit(name); } }; },
  onSnapshot(cb){ (listeners[name]||(listeners[name]=[])).push(cb); emit(name); return ()=>{}; } }; } };

const photoCache=new Map();
const BLANK='data:image/gif;base64,R0lGODlhAQABAAAAACw=';
function photoUrl(id){ return photoCache.get(id)||BLANK; }
assets={
  async upload(blob){ const id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); await idb.put('photos',id,blob); photoCache.set(id,URL.createObjectURL(blob)); return {id}; },
  async delete(id){ await idb.del('photos',id); const u=photoCache.get(id); if(u) URL.revokeObjectURL(u); photoCache.delete(id); }
};
async function loadPhotos(){ for(const [id,blob] of await idb.entries('photos')) if(blob instanceof Blob) photoCache.set(id,URL.createObjectURL(blob)); }

/* ---------- Live camera scanner ---------- */
let liveReader=null;
function stopLive(){ try{ liveReader&&liveReader.reset(); }catch(_){} liveReader=null; }
const _close=closeSheet; closeSheet=function(){ stopLive(); _close(); };
function openLive(mode){
  if(!window.ZXing){ toast('Сканер не завантажився. Перевірте інтернет.'); return; }
  const back = mode==='vin' ? ()=>{ stopLive(); openVin(''); } : closeSheet;
  const S=$('#sheet');
  S.innerHTML=`<div class="sheet-head"><h2>${mode==='vin'?'Сканер VIN':'Сканер'}</h2><button class="close" id="x">Закрити</button></div>
  <div class="cam"><video id="cam" playsinline muted autoplay></video><div class="aim"></div></div>
  <p class="note" id="camNote">${mode==='vin'?'Наведіть на штрихкод VIN — на наклейці у проємі водійських дверей або під лобовим склом.':'Наведіть на штрихкод на коробці чи наклейці.'}</p>
  <div class="actions"><button id="camPhoto">З фото</button><button id="camType">Ввести вручну</button></div>`;
  $('#x').onclick=back;
  $('#camPhoto').onclick=()=>{ stopLive(); scanMode=mode; if(mode==='vin') openVin(''); $('#scanFile').click(); };
  $('#camType').onclick=()=>{ stopLive(); if(mode==='vin') openVin(''); else { closeSheet(); $('#q').focus(); } };
  $('#scrim').hidden=false;
  const hints=new Map(); const F=ZXing.BarcodeFormat;
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS,[F.CODE_39,F.CODE_128,F.DATA_MATRIX,F.QR_CODE,F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E,F.CODE_93,F.ITF,F.PDF_417]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER,true);
  liveReader=new ZXing.BrowserMultiFormatReader(hints,250);
  liveReader.decodeFromConstraints({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}},$('#cam'),res=>{
    if(!res||!liveReader) return;
    const t=res.getText();
    if(mode==='vin'){ const v=asVin(t); if(!v){ $('#camNote').textContent=`Прочитано «${t}», але це не VIN. Шукаю далі…`; return; }
      stopLive(); if(navigator.vibrate) navigator.vibrate(80); openVin(v); return; }
    stopLive(); if(navigator.vibrate) navigator.vibrate(80); closeSheet(); foundCode(t);
  }).catch(err=>{
    const n=$('#camNote'); if(!n) return;
    n.style.color='var(--warn)';
    n.textContent = err&&err.name==='NotAllowedError' ? 'Немає доступу до камери. Дозвольте камеру для цього сайту в налаштуваннях браузера або скористайтесь «З фото».'
      : 'Камера не запустилась. Скористайтесь «З фото».';
  });
}

/* ---------- Photo: barcode, then text recognition on the device ---------- */
const SWAP={L:'1',S:'5','5':'S',B:'8','8':'B',Z:'2','2':'Z',G:'6','6':'G',T:'7','7':'T',A:'4','4':'A',D:'0','0':'D',U:'V',V:'U'};
const YEARCH='ABCDEFGHJKLMNPRSTVWXY123456789';
/* A real VIN: valid check digit, valid year character, last 4 characters digits,
   and a known manufacturer code or a valid country character. */
function plausibleVin(v){
  if(!v||v.length!==17||!vinCheck(v)) return false;
  if(!YEARCH.includes(v[9])) return false;
  if(!/^\d{4}$/.test(v.slice(13))) return false;
  return !!(makeOf(v)||REGION[v[0]]);
}
function vinFromText(text){
  const lines=String(text||'').toUpperCase().split(/\n/).map(l=>cleanVin(l.replace(/[^A-Z0-9]/g,'')));
  const cands=[];
  for(const c of lines) for(let i=0;i+17<=c.length;i++) cands.push(c.slice(i,i+17));
  for(const c of cands) if(plausibleVin(c)) return c;
  for(const c of cands){ for(let i=0;i<17;i++){ const alt=SWAP[c[i]]; if(!alt) continue; if((i>=12||i===8)&&/[A-Z]/.test(alt)) continue; const t=c.slice(0,i)+alt+c.slice(i+1); if(plausibleVin(t)) return t; } }
  return null;
}
/* Prepare the photo for text recognition: grayscale, stretch contrast, optionally invert and rotate. */
async function prep(file,{invert=false,angle=0}={}){
  const bmp=await createImageBitmap(file); const k=Math.min(1,2000/Math.max(bmp.width,bmp.height));
  const w=Math.round(bmp.width*k), h=Math.round(bmp.height*k), r=angle*Math.PI/180;
  const W=Math.round(Math.abs(w*Math.cos(r))+Math.abs(h*Math.sin(r))), H=Math.round(Math.abs(w*Math.sin(r))+Math.abs(h*Math.cos(r)));
  const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  x.fillStyle=invert?'#000':'#fff'; x.fillRect(0,0,W,H); x.translate(W/2,H/2); x.rotate(r); x.drawImage(bmp,-w/2,-h/2,w,h);
  const d=x.getImageData(0,0,W,H), p=d.data, hist=new Uint32Array(256);
  for(let i=0;i<p.length;i+=4){ const g=(p[i]*.299+p[i+1]*.587+p[i+2]*.114)|0; p[i]=g; hist[g]++; }
  const n=p.length/4; let lo=0,hi=255,acc=0; while(lo<255&&(acc+=hist[lo])<n*.02) lo++; acc=0; while(hi>0&&(acc+=hist[hi])<n*.02) hi--;
  const sc=255/Math.max(1,hi-lo);
  for(let i=0;i<p.length;i+=4){ let g=Math.max(0,Math.min(255,(p[i]-lo)*sc)); if(invert) g=255-g; p[i]=p[i+1]=p[i+2]=g; }
  x.setTransform(1,0,0,1,0,0); x.putImageData(d,0,0);
  return await new Promise(res=>c.toBlob(res,'image/png'));
}
let ocrWorker=null;
async function ocrPass(blob,label){
  if(!window.Tesseract) throw {code:'no_ocr'};
  if(!ocrWorker){ stage('Завантажую розпізнавання тексту (лише перший раз)…'); ocrWorker=await Tesseract.createWorker('eng'); }
  stage(label);
  const {data}=await ocrWorker.recognize(blob);
  return data.text||'';
}
/* For a VIN: try several versions of the photo until a real VIN is found. */
async function ocrVin(file){
  const tries=[[{},'Розпізнаю текст (1 з 4)…'],[{invert:true},'Розпізнаю світлий текст на темному (2 з 4)…'],[{invert:true,angle:-8},'Пробую з поворотом (3 з 4)…'],[{invert:true,angle:8},'Пробую з поворотом (4 з 4)…'],[{angle:-8},'Ще одна спроба…'],[{angle:8},'Остання спроба…']];
  for(const [o,label] of tries){ const v=vinFromText(await ocrPass(await prep(file,o),label)); if(v) return v; }
  return null;
}
async function ocr(file){ return ocrPass(await prep(file),'Розпізнаю текст…'); }
function pickCode(text, file){
  const toks=[...new Set(String(text).toUpperCase().split(/[\s,;:]+/).map(t=>t.replace(/[^A-Z0-9\-]/g,'')).filter(t=>t.length>=5&&t.length<=20&&/\d/.test(t)))].slice(0,12);
  if(!toks.length){ toast('На фото не знайшов номера. Введіть вручну.'); $('#q').focus(); return; }
  const S=$('#sheet');
  S.innerHTML=`<div class="sheet-head"><h2>Який це номер?</h2><button class="close" id="x">Закрити</button></div>
  <p class="note">Штрихкоду не знайшов, але прочитав текст. Виберіть номер деталі:</p>
  <div class="filters">${toks.map(t=>`<button class="chip pn" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  $('#x').onclick=closeSheet; $('#scrim').hidden=false;
  S.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ closeSheet(); foundCode(b.dataset.t, file); });
}
$('#scanFile').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  const isVin=scanMode==='vin'; scanMode='part';
  if(isVin) scanMode='vin';
  let code=null;
  stage('Шукаю штрихкод…');
  const url=URL.createObjectURL(f);
  try{ if('BarcodeDetector' in window){ const r=await withTimeout(new BarcodeDetector().detect(await createImageBitmap(f)),5000); const hit=r.find(x=>!isVin||asVin(x.rawValue)); if(hit) code=hit.rawValue; } }catch(_){}
  if(!code && window.ZXing){ try{ const r=await withTimeout(new ZXing.BrowserMultiFormatReader().decodeFromImageUrl(url),6000); if(!isVin||asVin(r.getText())) code=r.getText(); }catch(_){} }
  URL.revokeObjectURL(url);
  let text='', vinOcr=null;
  if(!code){ try{ if(isVin) vinOcr=await withTimeout(ocrVin(f),150000); else text=await withTimeout(ocr(f),90000); }catch(err){} }
  scanMode='part';
  if(isVin){
    const v=code?asVin(code):vinOcr;
    if(!v){ const msg='Не зміг надійно прочитати VIN з цього фото. Для наклейки на дверях краще «Сканувати VIN камерою» — вона читає штрихкод. Або введіть VIN вручну.'; const r=$('#vres'); if(r) r.innerHTML=`<p class="note" style="color:var(--warn)">${esc(msg)}</p>`; else toast(msg); return; }
    if($('#vin')) { $('#vin').value=v; runVin(v); } else openVin(v);
    return;
  }
  if(code){ foundCode(code, f); return; }
  pickCode(text, f);
};

/* ---------- VIN decode via NHTSA (official US database, free) ---------- */
const titleCase=s=>String(s||'').toLowerCase().replace(/(^|[\s\-\/])([a-z])/g,(m,a,b)=>a+b.toUpperCase());
async function askVin(c){
  try{
    const r=await withTimeout(fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(c.vin)}?format=json`),20000);
    const raw=((await r.json()).Results||[])[0]||{}; const x={};
    for(const k in raw){ const v=String(raw[k]??'').trim(); if(v && !/^not applicable$/i.test(v)) x[k]=v; }
    if(/^[1-9]/.test(x.ErrorCode||'') && !x.Model) return {err:'База NHTSA не впізнала цей VIN — перевірте, чи правильно він прочитаний.'};
    if(!x.Make && !x.Model) return {err:'У базі NHTSA цього VIN немає (буває з авто не для ринку США). Впишіть модель і двигун вручну.'};
    const cyl=+x.EngineCylinders||0, conf=String(x.EngineConfiguration||'');
    const layout=cyl?(/V/i.test(conf)?'V':/flat|boxer|horizontal/i.test(conf)?'H':'I')+cyl:'';
    const fuel=x.FuelTypePrimary&&!/gasoline/i.test(x.FuelTypePrimary)?x.FuelTypePrimary:'';
    const engine=[x.DisplacementL?(+x.DisplacementL).toFixed(1)+'L':'',layout,x.EngineModel||'',fuel].filter(Boolean).join(' ');
    return {make:titleCase(x.Make), model:x.Model||'', year:+x.ModelYear||null, engine, trim:x.Trim||'', body:x.BodyClass||'', drive:x.DriveType||''};
  }catch(e){ return {err:'Не вдалося з\'єднатись з базою NHTSA. Перевірте інтернет або впишіть модель вручну.'}; }
}

/* ---------- Export ---------- */
$('#exportBtn').onclick=()=>{
  if(!window.XLSX){ toast('Бібліотека Екселя не завантажилась'); return; }
  const rows=parts.map(p=>({'Номер деталі':p.pn,'Назва':p.name||'','Кількість':p.qty||0,'Мінімум':p.min||0,'Полиця':p.bin||'','Ціна':p.price||'','Постачальник':p.supplier||'','Підходить до':p.fits||''}));
  const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Склад');
  XLSX.writeFile(wb,`sklad-${new Date().toISOString().slice(0,10)}.xlsx`);
};

/* ---------- Start ---------- */
(async()=>{
  try{
    await loadPhotos();
    let seeded=false; try{ seeded=localStorage.getItem('seeded')==='1'; }catch(_){}
    if(!seeded){
      const ex=[['PRYKLAD-001','Приклад: фільтр масляний (можна видалити)',6,3,'A-01',8.5,'Outlander 2014-2020 2.4; Outlander Sport 2011-2024'],
                ['PRYKLAD-002','Приклад: колодки гальмівні передні (можна видалити)',1,2,'B-04',45,'Outlander 2014-2020'],
                ['PRYKLAD-003','Приклад: свічка запалювання (можна видалити)',0,4,'C-02',12,'Mirage 2014-2024']];
      if(!(await idb.entries('parts')).length) for(const [pn,name,qty,min,bin,price,fits] of ex) await idb.put('parts',pn,{pn,name,qty,min,bin,price,supplier:'',fits,updated:0});
      try{ localStorage.setItem('seeded','1'); }catch(_){}
    }
    if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
    db.collection('parts').onSnapshot(snap=>{ parts=snap.docs.map(d=>({id:d.id,...d.data()})); render(); });
    $('#status').textContent='Дані зберігаються на цьому пристрої';
  }catch(e){ $('#status').textContent='Не вдалося відкрити сховище на пристрої. Вимкніть приватний режим браузера.'; }
})();

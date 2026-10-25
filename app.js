const $=id=>document.getElementById(id);
const S=JSON.parse(localStorage.getItem('rr')||'{}');
const save=()=>localStorage.setItem('rr',JSON.stringify(S));
let loc=S.loc||{lat:52.37,lon:4.9,name:'Amsterdam'},tz='auto',map,marker,frames=[],layers=[],fi=0,timer,data;
const WMO={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
const fmt=(t,o)=>new Date(t*1e3).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',timeZone:tz,...o});
const label=m=>m<0.1?'dry':m<0.5?'drizzle':m<2.5?'light rain':m<7.6?'moderate rain':'heavy rain';

async function load(){
  $('place').textContent='📍 '+loc.name;
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&timezone=auto&timeformat=unixtime`+
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation`+
    `&minutely_15=precipitation&forecast_minutely_15=16&hourly=temperature_2m,precipitation_probability,weather_code&forecast_hours=24`+
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7`;
  try{const r=await fetch(u);const j=await r.json();if(!r.ok||!j.minutely_15)throw 0;data=j}catch(e){if(!data)$('summary').textContent='Forecast unavailable — retrying in 5 min';return}
  tz=data.timezone;render();checkNotify();
}
function render(){
  const m=data.minutely_15,now=Date.now()/1e3;
  const steps=m.time.map((t,i)=>({t,mm:(m.precipitation[i]||0)*4})).filter(s=>s.t+900>now).slice(0,8);
  const c=data.current;
  $('now').textContent=`${WMO[c.weather_code]||''} ${Math.round(c.temperature_2m)}°C (feels ${Math.round(c.apparent_temperature)}°) · wind ${Math.round(c.wind_speed_10m)} km/h`;
  const wet=steps.map(s=>s.mm>=0.1);
  let msg;
  if(!wet.some(Boolean))msg='☀️ Dry for the next 2 hours';
  else if(wet[0]){const e=wet.indexOf(false);msg=e<0?`🌧️ ${label(steps[0].mm)} for the next 2 hours`:`🌧️ ${label(steps[0].mm)}, dry from ${fmt(steps[e].t)}`}
  else{const i=wet.indexOf(true);msg=`🌧️ ${label(steps[i].mm)} starts at ${fmt(steps[i].t)} (in ${Math.max(0,Math.round((steps[i].t-now)/60))} min)`}
  $('summary').textContent=msg;
  const max=Math.max(2,...steps.map(s=>s.mm));
  $('bars').innerHTML=steps.map(s=>`<div class="${s.mm<0.1?'dry':''}" style="height:${Math.max(3,s.mm/max*100)}%" title="${s.mm.toFixed(1)} mm/h"></div>`).join('');
  $('barlabels').innerHTML=steps.map((s,i)=>`<span>${i%2?'':fmt(s.t,{hour:'2-digit',minute:'2-digit'})}</span>`).join('');
  const h=data.hourly;
  $('hourly').innerHTML=h.time.map((t,i)=>`<div>${fmt(t,{minute:undefined})}<br>${WMO[h.weather_code[i]]||''}<br>${Math.round(h.temperature_2m[i])}°<br><span class="muted">${h.precipitation_probability[i]??0}%</span></div>`).join('');
  const d=data.daily;
  $('daily').innerHTML=d.time.map((t,i)=>`<div><span>${new Date(t*1e3).toLocaleDateString([], {weekday:'short',timeZone:tz})} ${WMO[d.weather_code[i]]||''}</span><span>${d.precipitation_sum[i]} mm · ${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°</span></div>`).join('');
  if(marker)marker.setLatLng([loc.lat,loc.lon]);
}
// ---- notifications
function checkNotify(){
  if(!S.notif||!data||Notification.permission!=='granted')return;
  const now=Date.now()/1e3,m=data.minutely_15,thr=+S.thr||0.5,lead=(+S.lead||20)*60;
  for(let i=0;i<m.time.length;i++){
    const t=m.time[i],mm=(m.precipitation[i]||0)*4;
    if(t+900<=now||mm<thr)continue;
    if(i>0&&(m.precipitation[i-1]||0)*4>=thr&&m.time[i-1]+900>now)return; // already raining
    if(t-now<=lead&&S.last!==t){
      S.last=t;save();
      const body=`${label(mm)} expected at ${fmt(t)} (in ${Math.max(0,Math.round((t-now)/60))} min) — ${loc.name}`;
      navigator.serviceWorker.ready.then(r=>r.showNotification('🌧️ Rain coming',{body,icon:'icon.svg',tag:'rain'}));
    }
    return;
  }
}
$('notifOn').onchange=async e=>{
  if(e.target.checked&&await Notification.requestPermission()!=='granted'){e.target.checked=false;alert('Notifications blocked in browser settings.');return}
  S.notif=e.target.checked;save();checkNotify();
};
$('thr').onchange=e=>{S.thr=e.target.value;save()};$('lead').onchange=e=>{S.lead=e.target.value;save()};
$('notifOn').checked=!!S.notif;if(S.thr)$('thr').value=S.thr;if(S.lead)$('lead').value=S.lead;
// ---- radar
async function initMap(){
  map=L.map('map').setView([loc.lat,loc.lon],7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:12}).addTo(map);
  marker=L.marker([loc.lat,loc.lon]).addTo(map);
  loadRadar();
}
async function loadRadar(){
  try{
    const j=await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
    frames=[...(j.radar.past||[]),...(j.radar.nowcast||[])];
    layers.forEach(l=>map.removeLayer(l));
    layers=frames.map(f=>L.tileLayer(`${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,{opacity:0,maxNativeZoom:7,maxZoom:12,zIndex:5}).addTo(map));
    $('slider').max=frames.length-1;fi=frames.length-1;show(fi);play(true);
  }catch(e){$('ts').textContent='Radar unavailable'}
}
function show(i){
  fi=i;layers.forEach((l,k)=>l.setOpacity(k===i?0.7:0));$('slider').value=i;
  if(frames[i])$('ts').textContent=fmt(frames[i].time);
}
function play(on){clearInterval(timer);$('play').textContent=on?'⏸':'▶';if(on)timer=setInterval(()=>show((fi+1)%frames.length),600)}
$('play').onclick=()=>play($('play').textContent==='▶');
$('slider').oninput=e=>{play(false);show(+e.target.value)};
// ---- location
function setLoc(l){loc=l;S.loc=l;save();map.setView([l.lat,l.lon],7);load()}
$('locate').onclick=()=>navigator.geolocation.getCurrentPosition(p=>setLoc({lat:+p.coords.latitude.toFixed(3),lon:+p.coords.longitude.toFixed(3),name:'My location'}),()=>alert('Location denied'));
$('search').onsubmit=async e=>{
  e.preventDefault();
  const r=await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent($('q').value)}`)).json();
  if(r.results?.[0]){const x=r.results[0];setLoc({lat:x.latitude,lon:x.longitude,name:`${x.name}, ${x.country_code}`})}else alert('Not found');
};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
initMap();load();
setInterval(load,5*60e3);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});

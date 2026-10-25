const $=id=>document.getElementById(id);
const S=JSON.parse(localStorage.getItem('rr')||'{}');
const save=()=>localStorage.setItem('rr',JSON.stringify(S));
let loc=S.loc||{lat:52.37,lon:4.9,name:'Amsterdam'},tz='auto',map,marker,frames=[],layers=[],fi=0,timer,data;
const WMO={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
const fmt=(t,o)=>new Date(t*1e3).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',timeZone:tz,...o});
const label=m=>m<0.1?'dry':m<0.5?'drizzle':m<2.5?'light rain':m<7.6?'moderate rain':'heavy rain';

async function load(){
  $('place').textContent=loc.name;
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&timezone=auto&timeformat=unixtime`+
    `&current=is_day,temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation`+
    `&minutely_15=precipitation&forecast_minutely_15=16&hourly=temperature_2m,precipitation_probability,weather_code&forecast_hours=25`+
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7`;
  try{const r=await fetch(u);const j=await r.json();if(!r.ok||!j.minutely_15)throw 0;data=j}catch(e){if(!data)$('summary').textContent='Forecast unavailable — retrying in 5 min';return}
  tz=data.timezone;render();checkNotify();
}
function theme(c){
  const code=c.weather_code,day=c.is_day;
  return code>=95?'storm':code>=71&&code<=77||code==85||code==86?'snow':(code>=51&&code<=67)||(code>=80&&code<=82)?'rain':code>=2?'cloudy':day?'clear-day':'clear-night';
}
const DESC={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Fog',51:'Drizzle',53:'Drizzle',55:'Drizzle',61:'Rain',63:'Rain',65:'Heavy rain',71:'Snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
function render(){
  const m=data.minutely_15,now=Date.now()/1e3;
  const steps=m.time.map((t,i)=>({t,mm:(m.precipitation[i]||0)*4})).filter(s=>s.t+900>now).slice(0,8);
  const c=data.current;
  document.body.className=theme(c);
  document.querySelector('meta[name=theme-color]').content=getComputedStyle(document.body).getPropertyValue('--g1').trim();
  $('temp').textContent=Math.round(c.temperature_2m)+'°';
  $('cond').textContent=`${DESC[c.weather_code]||''} · feels ${Math.round(c.apparent_temperature)}° · ${Math.round(c.wind_speed_10m)} km/h`;
  const wet=steps.map(s=>s.mm>=0.1);
  let msg;
  if(!wet.some(Boolean))msg='No rain expected in the next 2 hours';
  else if(wet[0]){const e=wet.indexOf(false);msg=e<0?`${cap(label(steps[0].mm))} for the next 2 hours`:`${cap(label(steps[0].mm))} until ${fmt(steps[e].t)}`}
  else{const i=wet.indexOf(true);msg=`${cap(label(steps[i].mm))} in ${Math.max(1,Math.round((steps[i].t-now)/60))} min`}
  $('summary').textContent=msg;
  const max=Math.max(2,...steps.map(s=>s.mm));
  $('bars').innerHTML=steps.map(s=>`<div class="${s.mm<0.1?'dry':''}" style="height:${Math.max(4,s.mm/max*100)}%"></div>`).join('');
  $('barlabels').innerHTML=steps.map((s,i)=>`<span>${i%2?'':i===0?'Now':fmt(s.t)}</span>`).join('');
  const h=data.hourly;
  $('hourly').innerHTML=h.time.slice(0,24).map((t,i)=>`<div><span>${i?hr(t):'Now'}</span><span>${WMO[h.weather_code[i]]||''}</span><span>${Math.round(h.temperature_2m[i])}°</span><small>${h.precipitation_probability[i]>=20?h.precipitation_probability[i]+'%':'&nbsp;'}</small></div>`).join('');
  const d=data.daily;
  $('daily').innerHTML=d.time.map((t,i)=>`<div><span>${i?new Date(t*1e3).toLocaleDateString([], {weekday:'short',timeZone:tz}):'Today'}</span><span>${WMO[d.weather_code[i]]||''}</span><span class="r">${d.precipitation_sum[i]>=0.1?d.precipitation_sum[i].toFixed(1)+' mm':''}</span><span class="t">${Math.round(d.temperature_2m_max[i])}° <i>${Math.round(d.temperature_2m_min[i])}°</i></span></div>`).join('');
  if(marker)marker.setLatLng([loc.lat,loc.lon]);
}
const cap=s=>s[0].toUpperCase()+s.slice(1);
const hr=t=>new Date(t*1e3).toLocaleTimeString([], {hour:'numeric',timeZone:tz});
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
$('notifOn').checked=!!S.notif;$('thr').value=S.thr||'0.5';$('lead').value=S.lead||'20';
// ---- radar
async function initMap(){
  map=L.map('map',{zoomControl:false,attributionControl:true}).setView([loc.lat,loc.lon],7);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:12,className:'dark-tiles'}).addTo(map);
  map.createPane('radar').style.zIndex=300;
  marker=L.circleMarker([loc.lat,loc.lon],{radius:6,color:'#fff',weight:3,fillColor:'#ff453a',fillOpacity:1}).addTo(map);
  loadRadar();
}
async function loadRadar(){
  try{
    const j=await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
    frames=[...(j.radar.past||[]),...(j.radar.nowcast||[])];
    layers.forEach(l=>map.removeLayer(l));
    layers=frames.map(f=>L.tileLayer(`${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,{opacity:0,maxNativeZoom:7,maxZoom:12,pane:'radar'}).addTo(map));
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
function setLoc(l){closeSheets();loc=l;S.loc=l;save();map.setView([l.lat,l.lon],7);load()}
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

const sheet=id=>{$('scrim').classList.add('on');$(id).classList.add('on')};
const closeSheets=()=>{$('scrim').classList.remove('on');document.querySelectorAll('.sheet').forEach(x=>x.classList.remove('on'))};
$('cityBtn').onclick=()=>{sheet('citySheet');setTimeout(()=>$('q').focus(),300)};
$('bellBtn').onclick=()=>sheet('bellSheet');
$('scrim').onclick=closeSheets;

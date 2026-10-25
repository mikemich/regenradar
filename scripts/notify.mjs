// Background rain alerts via ntfy.sh (free). Env: LAT, LON, TOPIC, THRESHOLD (mm/h), LEAD (min)
const {LAT,LON,TOPIC,THRESHOLD='0.5',LEAD='20'}=process.env;
if(!LAT||!LON||!TOPIC)throw new Error('Set LAT, LON, TOPIC');
const r=await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&minutely_15=precipitation&forecast_minutely_15=8&timeformat=unixtime`)).json();
const now=Date.now()/1e3,m=r.minutely_15,steps=m.time.map((t,i)=>({t,mm:m.precipitation[i]*4})).filter(s=>s.t+900>now);
const raining=steps[0]?.mm>=+THRESHOLD;
const next=steps.find(s=>s.mm>=+THRESHOLD);
if(next&&!raining&&next.t-now<=LEAD*60){
  const min=Math.max(0,Math.round((next.t-now)/60));
  await fetch(`https://ntfy.sh/${TOPIC}`,{method:'POST',headers:{Title:'Rain coming',Tags:'cloud_with_rain'},body:`Rain (${next.mm.toFixed(1)} mm/h) in ~${min} min`});
  console.log('notified');
}else console.log('no alert');

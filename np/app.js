/* 胡公忠相年谱 · 互动时间线程序（一般无需修改） */
(function(){
"use strict";
var D = DATA;
function $(s,r){return (r||document).querySelector(s)}
function $$(s,r){return [].slice.call((r||document).querySelectorAll(s))}
function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function rich(t){t=t||'';if(/<[a-z][\s\S]*>/i.test(t))return t.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi,'');return esc(t).replace(/\r?\n/g,'<br>')}
function pd(s){var m=/(\d+)-(\d+)-(\d+)/.exec(s||'');return m?{y:+m[1],m:+m[2],d:+m[3]}:null}
function toY(p){var a=Date.UTC(p.y,p.m-1,p.d),b=Date.UTC(p.y,0,1),c=Date.UTC(p.y+1,0,1);return p.y+(a-b)/(c-b)}
function fmt(p,end){if(!end&&p.m==1&&p.d==1)return p.y+'年';if(end&&p.m==12&&p.d==31)return p.y+'年';if(end&&p.m==1&&p.d==1)return (p.y-1)+'年';return p.y+'年'+p.m+'月'+p.d+'日'}
function dateStr(s){var a=pd(s.startDate),b=pd(s.endDate),A=fmt(a),B=b?fmt(b,true):A;
  if(B===A||(b&&b.y===a.y&&b.m===a.m&&b.d===a.d))return A;
  if(/年$/.test(A)&&/年$/.test(B))return A.replace('年','')+'—'+B;
  return A+' — '+B}
function short(s){var a=pd(s.startDate),b=pd(s.endDate);var r=a.m==1&&a.d==1?String(a.y):a.y+'.'+a.m+'.'+a.d;if(b&&b.y!==a.y)r+=' — '+b.y;return r}

/* ---------- data prep ---------- */
var cats={},catList=D.categories.slice().sort(function(a,b){return a.title<b.title?-1:1});
catList.forEach(function(c,i){c.idx=i;c.name=c.title.replace(/^\d+\s*/,'');c.col='#'+c.colour;cats[c.id]=c});
var S=D.stories.map(function(s){
  var a=pd(s.startDate),b=pd(s.endDate)||a;
  var t=toY(a),te=Math.max(t,toY(b));
  var media=(s.media||[]).slice().sort(function(x,y){return (x.orderIndex||0)-(y.orderIndex||0)});
  var img=media.filter(function(m){return m.type==='Image'})[0];
  return {s:s,id:s.id,t:t,te:te,c:cats[s.category]||catList[0],media:media,thumb:img?(img.externalMediaThumb||img.src):'',
    full:(s.fullText||'').trim().replace(/^none$/i,''),txt:(s.text||'').trim(),
    key:(s.title+' '+s.text+' '+s.fullText).toLowerCase()};
}).sort(function(a,b){return a.t-b.t||a.te-b.te});
S.forEach(function(x,i){x.i=i});
var pref=S.filter(function(x){return /前言/.test(x.full)})[0];
var T0=Math.floor(S[0].t)-3, T1=Math.ceil(Math.max.apply(null,S.map(function(x){return x.te})))+3;
var ERAS=[[1636.3,1912.12,'清'],[1912.12,1949.75,'中华民国'],[1949.75,2100,'中华人民共和国']];

var state={view:'tl',t0:1866,ppy:40,cur:null,q:'',off:{}};
var vis=S.slice();
function applyFilter(){
  var q=state.q.trim().toLowerCase();
  S.forEach(function(x){x.on=!state.off[x.c.id]&&(!q||x.key.indexOf(q)>=0)});
  vis=S.filter(function(x){return x.on});
  $('#count').textContent='显示 '+vis.length+' / '+S.length+' 条';
  layoutTL();renderList();build3D();renderMini();
}

/* ---------- header ---------- */
$('#ttl').textContent=D.title;
catList.forEach(function(c){
  var n=S.filter(function(x){return x.c===c}).length;
  var b=document.createElement('button');b.className='chip';b.style.setProperty('--c',c.col);
  b.innerHTML='<i></i>'+esc(c.name)+' <span class="n">'+n+'</span>';
  b.onclick=function(){state.off[c.id]=!state.off[c.id];b.classList.toggle('off',!!state.off[c.id]);applyFilter()};
  $('#chips').appendChild(b)});
$('#q').addEventListener('input',function(){state.q=this.value;applyFilter()});
$$('#views button').forEach(function(b){b.onclick=function(){setView(b.dataset.v)}});
function setView(v){state.view=v;$('#hint').style.opacity=0;$$('#views button').forEach(function(b){b.classList.toggle('on',b.dataset.v===v)});
  $('#stage').style.display=v==='tl'?'':'none';$('#v3d').style.display=v==='3d'?'block':'none';$('#list').style.display=v==='list'?'block':'none';
  $('#mini').style.display=v==='list'?'none':'';$$('.zoomb').forEach(function(b){b.style.visibility=v==='tl'?'':'hidden'});
  if(v==='tl')renderTL();stop3D();if(v==='3d'){render3D()}renderMini()}

/* ---------- timeline view ---------- */
var stage=$('#stage'),lanesEl=$('#lanes'),scroller=$('#scroller');
var CW=196,CH=60,GAP=8,LH=CH+10,MAXL=5;
function W(){return stage.clientWidth}
function clampView(){var w=W();var minP=w/(T1-T0);state.ppy=Math.max(minP,Math.min(3000,state.ppy));
  state.t0=Math.max(T0,Math.min(T1-w/state.ppy,state.t0))}
var els=[];
function buildTL(){
  lanesEl.innerHTML='';els=[];
  catList.forEach(function(c){var b=document.createElement('div');b.className='band';b.style.setProperty('--c',c.col);
    b.innerHTML='<span class="blab">'+esc(c.name)+'</span>';c.band=b;lanesEl.appendChild(b)});
  S.forEach(function(x){
    var e=document.createElement('div');e.className='st';e.style.setProperty('--c',x.c.col);
    e.innerHTML=(x.thumb?'<img loading="lazy" src="'+esc(x.thumb)+'" alt="" onerror="this.remove()">':'')+'<div class="tx"><div class="d">'+esc(short(x.s))+'</div><div class="t">'+esc(x.s.title)+'</div></div>';
    e.title=x.s.title;e.onclick=function(ev){if(!moved)openStory(x)};
    var st=document.createElement('div');st.className='stem';st.style.setProperty('--c',x.c.col);
    var du=document.createElement('div');du.className='dur';du.style.setProperty('--c',x.c.col);
    var mk=document.createElement('div');mk.className='mk';mk.style.setProperty('--c',x.c.col);mk.title=short(x.s)+' '+x.s.title;mk.onclick=function(){if(!moved)openStory(x)};
    x.el=e;x.stem=st;x.dur=du;x.mk=mk;lanesEl.appendChild(du);lanesEl.appendChild(st);lanesEl.appendChild(e);lanesEl.appendChild(mk)});
}
var lay=null;
function layoutTL(){
  // lane assignment in pixel space for the current zoom
  var p=state.ppy,top=0;
  catList.forEach(function(c){
    var items=vis.filter(function(x){return x.c===c}),ends=[];
    items.forEach(function(x){
      var x0=x.t*p,lane=-1;
      for(var i=0;i<ends.length;i++)if(ends[i]<=x0){lane=i;break}
      if(lane<0&&ends.length<MAXL){lane=ends.length;ends.push(0)}
      if(lane>=0){ends[lane]=x0+CW+GAP;x.lane=lane}else x.lane=-1});
    });
  lay={p:p};
  renderTL();
}
function renderTL(){
  if(state.view!=='tl')return;
  clampView();
  if(!lay||lay.p!==state.ppy){layoutTL();return}
  var w=W(),p=state.ppy,t0=state.t0;
  // pass 1: which items are in view, how many lanes each band needs right now
  catList.forEach(function(c){c.need=0;c.any=false});
  S.forEach(function(x){
    var on=x.on&&!state.off[x.c.id],X=(x.t-t0)*p,XE=(x.te-t0)*p;
    x.X=X;x.XE=XE;x.iv=on&&X<w+50&&Math.max(XE,X+CW)>-50;
    if(x.iv){x.c.any=true;if(x.lane>=0)x.c.need=Math.max(x.c.need,x.lane+1)}});
  var top=0;
  catList.forEach(function(c){var hid=!!state.off[c.id];c.vt=top;c.vh=hid?0:(c.need?26+c.need*LH+16:44);top+=c.vh;
    c.band.style.top=c.vt+'px';c.band.style.height=c.vh+'px';c.band.classList.toggle('hid',hid)});
  lanesEl.style.height=top+'px';
  S.forEach(function(x){
    var X=x.X,XE=x.XE,c=x.c;
    if(!x.iv){x.el.classList.add('hid');x.stem.classList.add('hid');x.dur.classList.add('hid');x.mk.classList.add('hid');return}
    var mkY=c.vt+c.vh-12;
    x.mk.classList.remove('hid');x.mk.style.left=X+'px';x.mk.style.top=(mkY-5)+'px';
    if(XE-X>3){x.dur.classList.remove('hid');x.dur.style.left=X+'px';x.dur.style.width=(XE-X)+'px';x.dur.style.top=(mkY-2)+'px'}else x.dur.classList.add('hid');
    if(x.lane>=0){
      var y=c.vt+26+x.lane*LH;
      x.el.classList.remove('hid');x.el.style.left=X+'px';x.el.style.top=y+'px';
      x.stem.classList.remove('hid');x.stem.style.left=X+'px';x.stem.style.top=(y+CH)+'px';x.stem.style.height=Math.max(0,mkY-y-CH)+'px';
    }else{x.el.classList.add('hid');x.stem.classList.add('hid')}
    x.el.classList.toggle('sel',state.cur===x);
  });
  // ruler
  var steps=[1,2,5,10,20,50,100],step=steps[steps.length-1];
  for(var i=0;i<steps.length;i++)if(steps[i]*p>=78){step=steps[i];break}
  var minor=step>=10?step/5:(step===5?1:(p>=300?1/12:0));
  var h='',g='',a=Math.floor(t0/step)*step,b=t0+w/p;
  for(var y=a;y<=b+step;y+=step){var X=(y-t0)*p;h+='<div class="tick" style="left:'+X+'px">'+y+'</div>';g+='<div class="gl" style="left:'+X+'px"></div>'}
  if(minor&&minor*p>=7){var ma=Math.floor(t0/minor)*minor;for(var y2=ma;y2<=b;y2+=minor){if(Math.abs(y2/step-Math.round(y2/step))<1e-6)continue;h+='<div class="tick minor" style="left:'+((y2-t0)*p)+'px"></div>'}}
  $('#ticks').innerHTML=h;$('#grid').innerHTML=g;
  var e='';ERAS.forEach(function(r){var L=Math.max(0,(r[0]-t0)*p),R=Math.min(w,(r[1]-t0)*p);if(R>L)e+='<div class="era" style="left:'+L+'px;width:'+(R-L)+'px">'+r[2]+'</div>'});
  $('#era').innerHTML=e;
  renderMini();
}
function zoomAt(f,px){var w=W();if(px==null)px=w/2;var t=state.t0+px/state.ppy;state.ppy*=f;clampView();state.t0=t-px/state.ppy;renderTL()}
var anim=null;
function animateTo(t0,ppy,ms){
  cancelAnimationFrame(anim);var s0=state.t0,p0=state.ppy,start=performance.now();ms=ms||600;
  var w=W(),c0=s0+w/2/p0,c1=t0+w/2/ppy;
  (function step(now){var k=Math.min(1,(now-start)/ms);k=1-Math.pow(1-k,3);
    state.ppy=Math.exp(Math.log(p0)+(Math.log(ppy)-Math.log(p0))*k);var c=c0+(c1-c0)*k;state.t0=c-w/2/state.ppy;renderTL();
    if(k<1)anim=requestAnimationFrame(step)})(start)}
function focusTL(x){
  var w=W(),pw=$('#panel').classList.contains('open')&&w>900?480:0,usable=w-pw;
  var ppy=Math.max(state.ppy,Math.min(400,140/Math.max(.2,(x.te-x.t)||.2)));if(ppy<60)ppy=60;
  var t0=x.t-(usable*0.35)/ppy;animateTo(t0,ppy,650);
  // vertical: scroll so card is visible
  setTimeout(function(){var c=x.c,y=c.vt+26+Math.max(0,x.lane)*LH;var st=scroller.scrollTop,h=scroller.clientHeight;
    if(y<st||y+CH>st+h)scroller.scrollTo({top:Math.max(0,y-60),behavior:'smooth'})},700)}

// drag & wheel
var moved=false;
(function(){var sx,sy,st0,ss,down=false,pid;
  stage.addEventListener('pointerdown',function(e){if(e.button!==0)return;down=true;moved=false;sx=e.clientX;sy=e.clientY;st0=state.t0;ss=scroller.scrollTop;pid=e.pointerId});
  window.addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-sx,dy=e.clientY-sy;
    if(!moved&&Math.abs(dx)+Math.abs(dy)>5){moved=true;stage.classList.add('drag');try{stage.setPointerCapture(pid)}catch(_){}}
    if(moved){state.t0=st0-dx/state.ppy;scroller.scrollTop=ss-dy;renderTL()}});
  window.addEventListener('pointerup',function(){down=false;stage.classList.remove('drag');setTimeout(function(){moved=false},0)});
  stage.addEventListener('wheel',function(e){e.preventDefault();
    var r=stage.getBoundingClientRect();
    if(e.ctrlKey||e.metaKey){zoomAt(Math.exp(-e.deltaY*0.0025),e.clientX-r.left);return}
    if(e.shiftKey){scroller.scrollTop+=e.deltaY;return}
    var d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;state.t0+=d/state.ppy;renderTL()},{passive:false});
  stage.addEventListener('dblclick',function(e){var r=stage.getBoundingClientRect();zoomAt(1.8,e.clientX-r.left)});
  // pinch
  var pts={},pd0=0,pp0=0;
  stage.addEventListener('touchstart',function(e){if(e.touches.length===2){down=false;var a=e.touches[0],b=e.touches[1];pd0=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);pp0=state.ppy}},{passive:true});
  stage.addEventListener('touchmove',function(e){if(e.touches.length===2&&pd0){var a=e.touches[0],b=e.touches[1],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    var r=stage.getBoundingClientRect(),cx=(a.clientX+b.clientX)/2-r.left;zoomAt(pp0*d/pd0/state.ppy,cx)}},{passive:true});
  stage.addEventListener('touchend',function(){pd0=0},{passive:true});
})();
$('#zi').onclick=function(){zoomAt(1.6)};$('#zo').onclick=function(){zoomAt(1/1.6)};

/* ---------- mini overview ---------- */
var mdots=$('#mdots'),win=$('#win');
function mx(t){return (t-T0)/(T1-T0)}
function buildMini(){
  var h='';S.forEach(function(x){h+='<div class="md" data-i="'+x.i+'" style="--c:'+x.c.col+';left:'+(mx(x.t)*100)+'%;top:'+(3+x.c.idx*6.5)+'px"></div>'});
  mdots.innerHTML=h;
  var l='';for(var y=Math.ceil(T0/20)*20;y<=T1;y+=20)l+='<div class="ml" style="left:'+(mx(y)*100)+'%">'+y+'</div>';$('#mlab').innerHTML=l}
function renderMini(){
  $$('.md',mdots).forEach(function(d){d.classList.toggle('dim',!S[d.dataset.i].on)});
  var mw=mdots.clientWidth,a,b;
  if(state.view==='3d'){a=tOfU(cam.u-0.5);b=tOfU(cam.u+12)}else{a=state.t0;b=state.t0+W()/state.ppy}
  win.style.left=(12+mx(a)*mw)+'px';win.style.width=Math.max(6,(mx(b)-mx(a))*mw)+'px'}
(function(){var drag=false,off=0;var mini=$('#mini');
  function tAt(cx){var r=mdots.getBoundingClientRect();return T0+(cx-r.left)/r.width*(T1-T0)}
  function go(t,center){if(state.view==='3d'){go3DTime(t);return}
    var span=W()/state.ppy;state.t0=center?t-span/2:t;renderTL()}
  mini.addEventListener('pointerdown',function(e){drag=true;mini.setPointerCapture(e.pointerId);
    var wr=win.getBoundingClientRect();if(e.clientX>=wr.left&&e.clientX<=wr.right){off=state.view==='3d'?0:tAt(e.clientX)-state.t0}else{off=state.view==='3d'?0:(W()/state.ppy)/2}
    go(tAt(e.clientX)-off)});
  mini.addEventListener('pointermove',function(e){if(drag)go(tAt(e.clientX)-off)});
  mini.addEventListener('pointerup',function(){drag=false});
})();

/* ---------- detail panel ---------- */
var panel=$('#panel'),pbody=$('#pbody');
function openStory(x,noFocus){
  if(TTS.manual&&!LOOP.on)stopSpeak();
  state.cur=x;var c=x.c,imgs='',extra='';
  x.media.forEach(function(m){
    if(m.type==='Image')imgs+='<figure><img loading="lazy" src="'+esc(m.src)+'" alt="'+esc(m.caption)+'" onerror="this.parentNode.classList.add(\'off\')">'+(m.caption?'<figcaption>'+esc(m.caption)+'</figcaption>':'')+'</figure>';
    else if(m.type==='Audio')extra+='<div class="media">🔊 '+esc(m.caption||'音频')+'<audio controls preload="none" src="'+esc(m.src)+'"></audio></div>';
    else extra+='<div class="media">▶ <a href="'+esc(m.src)+'" target="_blank" rel="noopener">'+esc(m.caption||'观看视频')+'</a>（需联网）</div>'});
  pbody.style.setProperty('--c',c.col);
  pbody.innerHTML='<span class="ptag">'+esc(c.name)+'</span><div class="pdate">'+esc(dateStr(x.s))+'</div><h2>'+esc(x.s.title)+'</h2>'
    +(x.txt?'<div class="sum">'+rich(x.txt)+'</div>':'')+(x.full?'<div class="full">'+rich(x.full)+'</div>':'')
    +(imgs?'<div class="gal">'+imgs+'</div>':'')+extra
    +(x.s.externalLink?'<a class="ext" href="'+esc(x.s.externalLink)+'" target="_blank" rel="noopener">相关链接 ↗</a>':'');
  pbody.scrollTop=0;panel.classList.add('open');
  var k=vis.indexOf(x);$('#ppos').textContent=(k+1)+' / '+vis.length;
  $('#pprev').disabled=k<=0;$('#pnext').disabled=k>=vis.length-1;
  try{history.replaceState(null,'','#s'+x.id)}catch(_){}
  if(!noFocus){if(state.view==='tl')focusTL(x);else if(state.view==='3d')fly3D(x)}
  renderTL();mark3D();
}
function closePanel(){if(typeof stopSpeak==='function'&&TTS.manual)stopSpeak();if(LOOP.on&&!cam.play)stopLoop();panel.classList.remove('open');state.cur=null;try{history.replaceState(null,'',location.pathname+location.search)}catch(_){}renderTL();mark3D()}
function step(d){var k=vis.indexOf(state.cur);if(k<0)k=d>0?-1:vis.length;var n=vis[k+d];if(n)openStory(n)}
$('#pclose').onclick=closePanel;$('#pprev').onclick=function(){step(-1)};$('#pnext').onclick=function(){step(1)};
var lb=$('#lb'),lbList=[],lbI=0;
function lbOpen(){return lb.style.display==='flex'}
function lbShow(i){var n=lbList.length;if(!n)return;lbI=(i+n)%n;var it=lbList[lbI],im=$('#lbimg');
  im.classList.add('ld');im.onload=function(){im.classList.remove('ld')};im.onerror=function(){im.classList.remove('ld')};im.src=it.src;im.alt=it.cap;
  $('#lbcap').textContent=it.cap;$('#lbcnt').textContent=(lbI+1)+' / '+n;
  $$('#lbthumbs img').forEach(function(x,k){x.classList.toggle('on',k===lbI);if(k===lbI)x.scrollIntoView({block:'nearest',inline:'center'})});
  [lbI+1,lbI-1].forEach(function(k){var p=lbList[(k+n)%n];if(p){var pi=new Image();pi.src=p.src}})}
function lbStart(img){
  var g=img.closest('.gal');var imgs=$$('figure:not(.off) img',g);
  lbList=imgs.map(function(x){return {src:x.src,cap:x.alt}});
  $('#lbthumbs').innerHTML=lbList.map(function(x,k){return '<img src="'+esc(x.src)+'" data-k="'+k+'" alt="">'}).join('');
  lb.classList.toggle('single',lbList.length<2);lb.style.display='flex';lbShow(imgs.indexOf(img))}
function lbClose(){lb.style.display='none';$('#lbimg').src=''}
$('#lbprev').onclick=function(e){e.stopPropagation();lbShow(lbI-1)};
$('#lbnext').onclick=function(e){e.stopPropagation();lbShow(lbI+1)};
$('#lbx').onclick=lbClose;
$('#lbthumbs').addEventListener('click',function(e){e.stopPropagation();if(e.target.dataset.k)lbShow(+e.target.dataset.k)});
$('#lbimg').addEventListener('click',function(e){e.stopPropagation();if(lbList.length>1)lbShow(lbI+1)});
lb.addEventListener('click',function(e){if(e.target===lb||e.target.id==='lbstage'||e.target.id==='lbcap')lbClose()});
(function(){var x0=null;lb.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
  lb.addEventListener('touchend',function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>40&&lbList.length>1)lbShow(lbI+(dx<0?1:-1))},{passive:true})})();
document.addEventListener('click',function(e){var t=e.target;if(t.matches('.gal img'))lbStart(t)});
document.addEventListener('keydown',function(e){
  if(e.target.tagName==='INPUT')return;
  if(lbOpen()){if(e.key==='Escape')lbClose();else if(e.key==='ArrowRight'){lbShow(lbI+1)}else if(e.key==='ArrowLeft'){lbShow(lbI-1)}else if(e.key==='Home'){lbShow(0)}else if(e.key==='End'){lbShow(lbList.length-1)}e.preventDefault();return}
  if(e.key==='Escape'){if(false);else if($('#intro').style.display!=='none')hideIntro();else closePanel();return}
  if(panel.classList.contains('open')&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){step(e.key==='ArrowRight'?1:-1);e.preventDefault();return}
  if(state.view==='tl'){
    if(e.key==='ArrowRight'){state.t0+=80/state.ppy;renderTL()}else if(e.key==='ArrowLeft'){state.t0-=80/state.ppy;renderTL()}
    else if(e.key==='+'||e.key==='='){zoomAt(1.4)}else if(e.key==='-'){zoomAt(1/1.4)}}
  else if(state.view==='3d'){
    if(e.shiftKey&&/^Arrow/.test(e.key)){var dp=e.key==='ArrowUp'?3:e.key==='ArrowDown'?-3:0,dy2=e.key==='ArrowRight'?3:e.key==='ArrowLeft'?-3:0;setView3(VW.p+dp,VW.y+dy2);e.preventDefault()}
    else if(e.key==='0'){animView(DEF3.p,DEF3.y)}
    else if(e.key==='-'||e.key==='='||e.key==='+'){setDen3(Math.round((DEN3+(e.key==='-'?-.1:.1))*10)/10)}
    else if(e.key==='ArrowUp'||e.key==='ArrowRight'){step3D(1);e.preventDefault()}else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){step3D(-1);e.preventDefault()}
    else if(e.key===' '){toggle3D();e.preventDefault()}
    else if(e.key==='['||e.key===']'){setK3(Math.max(.6,Math.min(1.8,Math.round((K3+(e.key===']'?.1:-.1))*20)/20)))}}
});

/* ---------- list view ---------- */
function renderList(){
  var h='',ly=null;vis.forEach(function(x){var y=Math.floor(x.t);if(y!==ly){h+='<div class="ly">'+y+'</div>';ly=y}
    h+='<div class="li" data-i="'+x.i+'" style="--c:'+x.c.col+'"><div class="d">'+esc(dateStr(x.s))+' · '+esc(x.c.name)+'</div><h3>'+esc(x.s.title)+'</h3>'+(x.txt?'<p>'+esc(x.txt)+'</p>':'')+'</div>'});
  $('#lwrap').innerHTML=h||'<p style="color:#8b7f6d">没有符合条件的条目</p>'}
$('#lwrap').addEventListener('click',function(e){var li=e.target.closest('.li');if(li)openStory(S[li.dataset.i],true)});

/* ---------- 3D view (filled in step 2) ---------- */
var cam={u:0,target:0,play:false},go3DTime=function(){};
function build3D(){}
function render3D(){}
function mark3D(){}
function fly3D(){}
function step3D(){}
function toggle3D(){}
function stop3D(){}
/* ---------- 3D view ---------- */
var GY_ON=true,yRaf=0;try{GY_ON=localStorage.getItem('tl3dStand')!=='0'}catch(_){}
function sstep(a,b,x){var k=Math.max(0,Math.min(1,(x-a)/(b-a)));return k*k*(3-2*k)}
var Y3L=(function(){var N=4,h='';for(var i=N-1;i>=0;i--){var f=1-i/(N-1),c=[Math.round(110+(214-110)*f),Math.round(74+(160-74)*f),Math.round(18+(60-18)*f)];
  h+='<span class="'+(i===0?'f':'')+'" style="'+(i===0?'':'color:rgb('+c.join(',')+');')+'transform:translateZ('+(-i*1.6)+'px)">@</span>'}return h})();
var world=$('#world'),v3d=$('#v3d'),Z=460,OFF=260,raf3=0,FAR3=460*32,FARY3=460*16,DEF3={p:18,y:-30,k:2.1,d:1.6},K3=DEF3.k,DEN3=DEF3.d;
try{var sk=parseFloat(localStorage.getItem('tl3dCardSize'));if(sk>=0.6&&sk<=1.8)K3=sk}catch(_){}
function setK3(v){K3=v;$('#k3').value=v;$('#k3v').textContent=Math.round(v*100)+'%';try{localStorage.setItem('tl3dCardSize',v)}catch(_){}render3D()}
var VW={p:DEF3.p,y:DEF3.y};try{var vv=JSON.parse(localStorage.getItem('tl3dView')||'{}');if(typeof vv.p==='number')VW.p=vv.p;if(typeof vv.y==='number')VW.y=vv.y}catch(_){}
function setView3(p,y,save){VW.p=Math.max(-20,Math.min(50,p));VW.y=Math.max(-50,Math.min(50,y));
  $('#pitch3').value=VW.p;$('#yaw3').value=VW.y;$('#pitch3v').textContent=Math.round(VW.p)+'°';$('#yaw3v').textContent=Math.round(VW.y)+'°';
  world.style.transform='translateZ(-900px) rotateX('+(-VW.p)+'deg) rotateY('+VW.y+'deg) translateZ(900px)';
  if(save!==false){try{localStorage.setItem('tl3dView',JSON.stringify(VW))}catch(_){}}}
setView3(VW.p,VW.y,false);
$('#pitch3').addEventListener('input',function(){setView3(+this.value,VW.y)});
$('#yaw3').addEventListener('input',function(){setView3(VW.p,+this.value)});
$('#vreset').onclick=function(){animView(DEF3.p,DEF3.y);setK3(DEF3.k);setDen3(DEF3.d)};
$('#vmin').onclick=function(){var m=$('#size3').classList.toggle('min');this.textContent=m?'视图 ＋':'－';try{localStorage.setItem('tl3dPanelMin',m?'1':'')}catch(_){}};
try{if(localStorage.getItem('tl3dPanelMin')){$('#size3').classList.add('min');$('#vmin').textContent='视图 ＋'}}catch(_){}
function animView(p1,y1){var p0=VW.p,y0=VW.y,s=performance.now();(function f(n){var k=Math.min(1,(n-s)/500);k=1-Math.pow(1-k,3);setView3(p0+(p1-p0)*k,y0+(y1-y0)*k,k>=1);if(k<1)requestAnimationFrame(f)})(s)}
$('#gold3').checked=GY_ON;$('#gold3').addEventListener('change',function(){GY_ON=this.checked;try{localStorage.setItem('tl3dStand',GY_ON?'1':'0')}catch(_){}render3D()});
try{var sd=parseFloat(localStorage.getItem('tl3dDensity'));if(sd>=0.5&&sd<=2.5)DEN3=sd}catch(_){}
function setDen3(v){DEN3=Math.max(.5,Math.min(2.5,v));Z=Math.round(460/DEN3);$('#den3').value=DEN3;denLabel();try{localStorage.setItem('tl3dDensity',DEN3)}catch(_){}render3D()}
$('#den3').addEventListener('input',function(){setDen3(parseFloat(this.value))});
Z=Math.round(460/DEN3);$('#den3').value=DEN3;denLabel();
function denLabel(){$('#den3v').textContent='约'+Math.round(FAR3/Z)+'张';$('#den3').title='卡片密度 '+Math.round(DEN3*100)+'%'}
$('#k3').value=K3;$('#k3v').textContent=Math.round(K3*100)+'%';
$('#k3').addEventListener('input',function(){setK3(parseFloat(this.value))});
var items3=[],years3=[];
cam={u:0,target:0,play:false};
function tOfU(u){if(!vis.length)return T0;var i=Math.floor(u),f=u-i;if(i<0)return vis[0].t-(-u)*1;if(i>=vis.length-1)return vis[vis.length-1].t+(u-vis.length+1);return vis[i].t+(vis[i+1].t-vis[i].t)*f}
function uOfT(t){if(!vis.length)return 0;for(var i=0;i<vis.length-1;i++){if(t<vis[i+1].t){var a=vis[i].t,b=vis[i+1].t;return i+(b>a?Math.max(0,(t-a)/(b-a)):0)}}return vis.length-1}
build3D=function(){
  world.innerHTML='';items3=[];years3=[];var ly=null;

  vis.forEach(function(x,i){
    var y=Math.floor(x.t);
    if(y!==ly){var yr=document.createElement('div');yr.className='y3';yr.innerHTML=Y3L.replace(/@/g,y);yr.dataset.y=y;world.appendChild(yr);
      var fl=document.createElement('div');fl.className='fl';world.appendChild(fl);years3.push({u:i-0.45,y:y,el:yr,fl:fl,sp:[].slice.call(yr.children)});ly=y}
    var e=document.createElement('div');e.className='c3';e.style.setProperty('--c',x.c.col);
    e.innerHTML=(x.thumb?'<img src="'+esc(x.thumb)+'" alt="" onerror="this.remove()">':'')+'<span class="k">'+esc(x.c.name)+'</span><div class="d">'+esc(dateStr(x.s))+'</div><div class="t">'+esc(x.s.title)+'</div>';
    e.onclick=function(){if(!moved3)openStory(x)};
    world.appendChild(e);items3.push({x:x,u:i,el:e,side:i%2?1:-1,jy:((i*37)%5-2)*14});
  });
  cam.u=Math.max(0,Math.min(vis.length-1,cam.u));cam.target=cam.u;
  render3D();mark3D();
};
render3D=function(){
  if(state.view!=='3d')return;
  var w=v3d.clientWidth,sx=Math.min(1,w/980),spread=Math.max(290*sx+30,150*K3*sx+60);
  items3.forEach(function(o){
    var dz=(o.u-cam.u)*Z+OFF,el=o.el;
    if(dz<-560||dz>FAR3){el.style.display='none';return}
    el.style.display='';
    var op=dz<OFF?Math.max(0,1-(OFF-dz)/700):Math.max(0,1-(dz-OFF)/(FAR3));
    el.style.opacity=op.toFixed(3);
    el.style.transform='translate3d('+(o.side*spread)+'px,'+(o.jy-20)+'px,'+(-dz+OFF*0)+'px) rotateY('+(-o.side*14)+'deg) scale('+K3+')';
    el.style.zIndex=Math.round(10000-dz);
    el.style.pointerEvents=op>.25?'':'none';
  });
  var k=Math.max(0,Math.min(vis.length-1,Math.round(cam.u)));
  var cy=vis.length?Math.floor(vis[k].t):'';
  years3.forEach(function(o){
    var dz=(o.u-cam.u)*Z+OFF;
    if(dz<-400||dz>FARY3){o.el.style.display=o.fl.style.display='none';return}
    o.el.style.display=o.fl.style.display='';
    var op=dz<OFF?Math.max(0,1-(OFF-dz)/600):Math.max(0,1-(dz-OFF)/(FARY3));
    if(o.op!==op){o.op=op;var so=(op*.9).toFixed(3);for(var i=0;i<o.sp.length;i++)o.sp[i].style.opacity=so}
    var s=GY_ON?sstep(OFF+80,OFF-170,dz):0; // rise in place just before it slides off the bottom
    o.el.style.transform='translate3d(0,'+(300-160)+'px,'+(-dz)+'px) rotateX('+(90*(1-s)).toFixed(2)+'deg)';
    o.fl.style.opacity=op.toFixed(3);
    o.fl.style.transform='translate3d(0,300px,'+(-dz-110)+'px) rotateX(90deg)';
  });
  $('#yr3').textContent=vis.length?cy+'年':'';

  renderMini();
};
mark3D=function(){items3.forEach(function(o){o.el.classList.toggle('sel',state.cur===o.x)})};
/* autoplay: fly to each card, dwell, show content */
var AP={spd:1,mode:'auto',fixed:8,show:'cap',tts:false,voice:'',rate:1,loopGap:3,photos:true,photoSec:4};
try{var sv=JSON.parse(localStorage.getItem('tl3dPlay')||'{}');for(var k in sv)if(k in AP)AP[k]=sv[k]}catch(_){}
try{if(!localStorage.getItem('tlVoiceV2')){AP.voice='';localStorage.setItem('tlVoiceV2','1');localStorage.setItem('tl3dPlay',JSON.stringify(AP))}}catch(_){}
function saveAP(){try{localStorage.setItem('tl3dPlay',JSON.stringify(AP))}catch(_){}}
function syncSet(){$$('#psm button').forEach(function(b){b.classList.toggle('on',(b.dataset.m==='1')===!!AP.photos)});$('#psx').style.display=AP.photos?'':'none';$('#pss').value=AP.photoSec;$('#psv').textContent='每张 '+AP.photoSec+' 秒';
  $$('#ttm button').forEach(function(b){b.classList.toggle('on',(b.dataset.m==='1')===!!AP.tts)});$('#ttsx').style.display=AP.tts&&HAS_TTS?'':'none';$('#ttr').value=AP.rate;$('#ttrv').textContent=AP.rate.toFixed(1)+'×';
  $('#spd').value=AP.spd;$('#spdv').textContent=AP.spd+'×';$('#dws').value=AP.fixed;$('#dwv').textContent=AP.fixed+' 秒';
  $$('#dwm button').forEach(function(b){b.classList.toggle('on',b.dataset.m===AP.mode)});$('#dwfx').style.display=AP.mode==='fixed'?'':'none';
  $$('#shm button').forEach(function(b){b.classList.toggle('on',b.dataset.m===AP.show)})}
syncSet();

/* ---------- text-to-speech (Web Speech API, uses voices installed on this computer) ---------- */
var HAS_TTS=('speechSynthesis' in window)&&('SpeechSynthesisUtterance' in window);
var TTS={active:false,done:true,prog:0,gen:0,manual:false},VOICES=[];
function loadVoices(){if(!HAS_TTS)return;var all=speechSynthesis.getVoices();
  VOICES=all.filter(function(v){return /^zh|cmn/i.test(v.lang)});if(!VOICES.length)VOICES=all;
  var sel=$('#ttv');sel.innerHTML=VOICES.length?VOICES.map(function(v){return '<option value="'+esc(v.name)+'">'+esc(v.name.replace(/^Microsoft /,''))+' ('+esc(v.lang)+')</option>'}).join(''):'<option>（未找到中文语音）</option>';
  var v=pickVoice();if(v)sel.value=v.name}
function pickVoice(){if(!VOICES.length)return null;var v=VOICES.filter(function(v){return v.name===AP.voice})[0];if(v)return v;
  var vpref=[/Yunyang|云扬/i,/Yunjian|云健/i,/Yunxi\b|云希/i,/Xiaoxiao|晓晓/i,/Natural/i];
  for(var pi=0;pi<vpref.length;pi++){var hit=VOICES.filter(function(v){return /zh-CN/i.test(v.lang)&&vpref[pi].test(v.name)})[0];if(hit)return hit}
  return VOICES.filter(function(v){return /zh-CN/i.test(v.lang)})[0]||VOICES[0]}
if(HAS_TTS){loadVoices();try{speechSynthesis.addEventListener('voiceschanged',loadVoices)}catch(_){speechSynthesis.onvoiceschanged=loadVoices}}
function ttsText(x){var d=document.createElement('div');d.innerHTML=rich(x.full);var full=(d.innerText||d.textContent||'').trim();
  return [x.s.title,dateStr(x.s).replace(/\s*—\s*/g,'至'),x.txt,full].filter(Boolean).join('。\n').replace(/\[\d+\]/g,'').replace(/https?:\/\/\S+/g,'')}
function ttsChunks(s){var parts=s.replace(/\s+/g,' ').split(/(?<=[。！？；!?;\n])/),out=[],cur='';
  parts.forEach(function(p){p=p.trim();if(!p)return;
    while(p.length>110){var cut=p.lastIndexOf('，',110);if(cut<30)cut=110;out.push((cur+p.slice(0,cut+1)).trim());cur='';p=p.slice(cut+1)}
    if((cur+p).length>110){if(cur)out.push(cur);cur=p}else cur+=p});
  if(cur.trim())out.push(cur.trim());return out}
function speak(x,onEnd,manual){return speakText(ttsText(x),onEnd,manual)}
function speakText(text,onEnd,manual){
  if(!HAS_TTS)return false;stopSpeak();var my=++TTS.gen,list=ttsChunks(text),total=list.join('').length||1,before=0,i=0,wd=0;
  TTS.active=true;TTS.done=false;TTS.prog=0;TTS.manual=!!manual;syncRead();
  function next(){clearTimeout(wd);if(my!==TTS.gen)return;
    if(i>=list.length){TTS.active=false;TTS.done=true;TTS.prog=1;TTS.manual=false;syncRead();if(onEnd)onEnd();return}
    var txt=list[i],u=new SpeechSynthesisUtterance(txt),v=pickVoice();u.lang=v?v.lang:'zh-CN';if(v)u.voice=v;u.rate=AP.rate;
    var fin=false;function done(){if(fin)return;fin=true;before+=txt.length;i++;next()}
    u.onstart=function(){if(my===TTS.gen)TTS.prog=before/total};u.onend=done;u.onerror=done;
    TTS.prog=before/total;speechSynthesis.speak(u);
    wd=setTimeout(done,(txt.length*420/AP.rate)+6000)} // watchdog in case a browser never fires onend
  next();return true}
function stopSpeak(){TTS.gen++;var was=TTS.active;TTS.active=false;TTS.done=true;TTS.manual=false;if(HAS_TTS&&(was||speechSynthesis.speaking))speechSynthesis.cancel();syncRead()}
function syncRead(){var b=$('#pread');if(b)b.textContent=(TTS.active&&TTS.manual)||(typeof LOOP!=='undefined'&&LOOP.on)?'■ 停止':'🔊 朗读'}
$('#pread').onclick=function(){if(LOOP.on){stopLoop();return}if(TTS.active&&TTS.manual){stopSpeak();return}if(cam.play)toggle3D(false);if(state.cur)speak(state.cur,null,true)};
if(!HAS_TTS){$('#pread').style.display='none';$('#ttm').style.display=$('#ttsx').style.display='none';$('#ttsna').style.display=''}
$('#ttm').addEventListener('click',function(e){var m=e.target.dataset.m;if(m==null)return;AP.tts=m==='1';saveAP();syncSet();
  if(LOOP.on){}else if(!AP.tts&&!TTS.manual)stopSpeak();else if(AP.tts&&cam.play&&play.ph==='dwell'){var x=vis[play.i];speak(x,function(){play.end=performance.now()+1200})}});

/* loop-read the preface */
var LOOP={on:false,n:0,timer:0};
function prefaceText(){if(!pref)return '';var d=document.createElement('div');d.innerHTML=rich(pref.full);var s=(d.innerText||d.textContent||'');
  var i=s.indexOf('【前言');if(i>=0)s=s.slice(i);return s.replace(/【([^】]*)】/g,function(m,a){return a.replace(/[·•]/g,'，')+'。\n'}).replace(/•/g,'').trim()}
function startLoop(){if(!HAS_TTS||!pref)return;stopSpeak();LOOP.on=true;LOOP.n=0;
  if(!cam.play)openStory(pref,true);$('#loopbar').style.display='flex';$('#loopbtn').classList.add('on');loopOnce()}
function loopOnce(){if(!LOOP.on)return;LOOP.n++;$('#loopn').textContent='第 '+LOOP.n+' 遍';
  speakText(prefaceText(),function(){if(!LOOP.on)return;clearTimeout(LOOP.timer);LOOP.timer=setTimeout(loopOnce,AP.loopGap*1000)})}
function stopLoop(){if(!LOOP.on)return;LOOP.on=false;clearTimeout(LOOP.timer);stopSpeak();if(cam.play&&play.ph==='dwell'){play.end=Math.min(play.end,performance.now()+play.dur)}$('#loopbar').style.display='none';$('#loopbtn').classList.remove('on')}
$('#loopbtn').onclick=function(){LOOP.on?stopLoop():startLoop()};
$('#loopstop').onclick=stopLoop;
$('#iloop').onclick=function(){hideIntro();startLoop()};
if(!HAS_TTS||!pref){$('#loopbtn').style.display='none';$('#iloop').style.display='none'}
$('#ttv').addEventListener('change',function(){AP.voice=this.value;saveAP()});
$('#ttr').addEventListener('input',function(){AP.rate=parseFloat(this.value);saveAP();syncSet()});
syncSet();
$('#spd').addEventListener('input',function(){AP.spd=parseFloat(this.value);saveAP();syncSet()});
$('#dws').addEventListener('input',function(){AP.fixed=parseInt(this.value,10);saveAP();syncSet()});
$('#dwm').addEventListener('click',function(e){var m=e.target.dataset.m;if(m){AP.mode=m;saveAP();syncSet()}});
$('#shm').addEventListener('click',function(e){var m=e.target.dataset.m;if(m){AP.show=m;saveAP();syncSet();if(cam.play){hideCap();if(play.ph==='dwell')showContent(vis[play.i])}}});
$('#b3set').onclick=function(e){e.stopPropagation();$('#set3').classList.toggle('open')};
document.addEventListener('click',function(e){if(!e.target.closest('#set3b'))$('#set3').classList.remove('open')});
var play={i:0,ph:'fly',end:0,dur:0,last:0},capHover=false;
var cap=$('#cap3');cap.addEventListener('mouseenter',function(){capHover=true});cap.addEventListener('mouseleave',function(){capHover=false});
function dwellFor(x){if(AP.mode==='fixed')return AP.fixed*1000;
  var n=(x.s.title+x.txt+(AP.show==='none'?'':x.full.replace(/<[^>]+>/g,''))).length;
  return Math.max(3500,Math.min(120000,(2.5+n/7)*1000/AP.spd))}
function showContent(x){
  if(AP.show==='panel'){openStory(x,true);return}
  if(AP.show!=='cap')return;
  var ims=x.media.filter(function(m){return m.type==='Image'}).slice(0,8);
  cap.style.setProperty('--c',x.c.col);
  $('#cap3b').innerHTML='<div class="hd"><span class="k">'+esc(x.c.name)+'</span><span class="d">'+esc(dateStr(x.s))+'</span></div><h3>'+esc(x.s.title)+'</h3>'
    +(x.txt?'<div class="s">'+rich(x.txt)+'</div>':'')+(x.full?'<div class="f">'+rich(x.full)+'</div>':'')
    +(ims.length?'<div class="ims gal">'+ims.map(function(m){return '<figure style="margin:0"><img src="'+esc(m.src)+'" alt="'+esc(m.caption)+'" onerror="this.parentNode.classList.add(\'off\');this.parentNode.style.display=\'none\'"></figure>'}).join('')+'</div>':'');
  $('#cap3b').scrollTop=0;cap.classList.add('on')}
function hideCap(){cap.classList.remove('on');PS.list=[];psHide()}
$('#cap3more').onclick=function(){var x=vis[play.i];if(x){toggle3D(false);openStory(x,true)}};
/* photo slideshow: one round through the card's photos while it is shown */
var PS={list:[],i:-1,start:0,slot:4000,el:$('#ps3'),buf:0};
function psBegin(x,now){PS.list=AP.photos?x.media.filter(function(m){return m.type==='Image'}):[];PS.i=-1;PS.start=now;PS.slot=AP.photoSec*1000;
  PS.list.forEach(function(m){var im=new Image();im.src=m.src});
  return PS.list.length?now+PS.list.length*PS.slot:now}
function psShow(k){var m=PS.list[k];if(!m)return;var ims=$$('img',PS.el),b=ims[PS.buf];PS.buf=(PS.buf+1)%ims.length;var a=ims[PS.buf];
  a.onerror=function(){if(PS.i===k){PS.start-=PS.slot-(performance.now()-PS.start)%PS.slot}};
  a.style.transition='none';a.classList.remove('out','on');void a.offsetWidth;a.style.transition='';
  var go=function(){a.classList.add('on');if(b.classList.contains('on')){b.classList.remove('on');b.classList.add('out')}};
  a.onload=go;var abs=new URL(m.src,location.href).href;if(a.src===abs&&a.complete&&a.naturalWidth){a.onload=null;requestAnimationFrame(go)}else a.src=m.src;a.alt=m.caption||'';
  $('.pc',PS.el).innerHTML=esc(m.caption||'')+(PS.list.length>1?'<b>'+(k+1)+' / '+PS.list.length+'</b>':'');PS.el.classList.add('on');v3d.classList.add('pson')}
function psTick(now){if(!PS.list.length)return;var k=Math.floor((now-PS.start)/PS.slot)%PS.list.length;
  if(k>=PS.list.length){if(PS.el.classList.contains('on'))psHide();return}
  if(k!==PS.i){PS.i=k;psShow(k)}}
function psHide(){PS.el.classList.remove('on');v3d.classList.remove('pson');$$('img',PS.el).forEach(function(i){i.classList.remove('on','out')})}
PS.el.addEventListener('click',function(e){if(e.target.tagName!=='IMG')return;lbList=PS.list.map(function(m){return {src:m.src,cap:m.caption||''}});
  $('#lbthumbs').innerHTML=lbList.map(function(x,k){return '<img src="'+esc(x.src)+'" data-k="'+k+'" alt="">'}).join('');lb.classList.toggle('single',lbList.length<2);lb.style.display='flex';lbShow(Math.max(0,PS.i))});
$('#psm').addEventListener('click',function(e){var m=e.target.dataset.m;if(m==null)return;AP.photos=m==='1';saveAP();syncSet();if(!AP.photos){PS.list=[];psHide()}});
$('#pss').addEventListener('input',function(){AP.photoSec=parseInt(this.value,10);saveAP();syncSet()});
function loop3(now){
  raf3=0;if(state.view!=='3d')return;now=now||performance.now();var dt=play.last?Math.min(100,now-play.last):16;play.last=now;
  if(cam.play){
    if(play.ph==='fly'){cam.target=play.i;
      if(Math.abs(cam.u-play.i)<0.01){cam.u=play.i;play.ph='dwell';play.dur=dwellFor(vis[play.i]);play.end=now+play.dur;showContent(vis[play.i]);play.pend=psBegin(vis[play.i],now);
        if(AP.tts&&!LOOP.on&&speak(vis[play.i],function(){play.end=performance.now()+1200;play.dur=Math.max(1,play.dur)})){play.end=now+1e9}}}
    else{
      if(capHover||lbOpen()){play.end+=dt;PS.start+=dt;play.pend+=dt}
      psTick(now);
      var left=play.end-now,f=TTS.active&&!TTS.manual&&!LOOP.on?TTS.prog:(play.end-now>1e8?1:1-left/play.dur);$('#cap3pg').style.width=Math.min(100,f*100)+'%';
      var cb=$('#cap3b');if(cap.classList.contains('on')&&!capHover&&cb.scrollHeight>cb.clientHeight){var sf=Math.max(0,Math.min(1,(f-0.15)/0.75));cb.scrollTop=sf*(cb.scrollHeight-cb.clientHeight)}
      if(left<=0&&now>=play.pend){if(play.i>=vis.length-1){toggle3D(false)}else{hideCap();if(!LOOP.on)stopSpeak();play.i++;play.ph='fly'}}}
  }
  cam.target=Math.max(-0.3,Math.min(vis.length-1+0.3,cam.target));
  var d=cam.target-cam.u,k=cam.play?Math.min(0.5,0.045*AP.spd):0.11;
  if(Math.abs(d)>0.0005){cam.u+=Math.sign(d)*Math.min(Math.abs(d),Math.max(Math.abs(d)*k,0.004*AP.spd))}
  render3D();
  if(Math.abs(cam.target-cam.u)>0.0005||cam.play)raf3=requestAnimationFrame(loop3);else{cam.u=cam.target;render3D();play.last=0}
}
function kick3(){if(!raf3)raf3=requestAnimationFrame(loop3)}
fly3D=function(x){var i=vis.indexOf(x);if(i>=0){cam.target=i;kick3()}};
step3D=function(d){
  if(cam.play){hideCap();if(!LOOP.on)stopSpeak();play.i=Math.max(0,Math.min(vis.length-1,play.i+d));play.ph='fly';kick3();return}
  cam.target=Math.round(cam.target)+d;cam.target=Math.max(0,Math.min(vis.length-1,cam.target));kick3()};
toggle3D=function(on){cam.play=on==null?!cam.play:on;$('#b3play').textContent=cam.play?'❚❚ 暂停':'▶ 自动漫游';
  if(cam.play){var i=Math.round(cam.u);if(i>=vis.length-1)i=0;i=Math.max(0,i);play.i=i;play.ph='fly';play.last=0}
  else{hideCap();$('#cap3pg').style.width='0';if(!TTS.manual&&!LOOP.on)stopSpeak()}
  kick3()};
stop3D=function(){if(cam.play)toggle3D(false);cancelAnimationFrame(raf3);raf3=0};
go3DTime=function(t){cam.target=uOfT(t);kick3()};
$('#b3prev').onclick=function(){step3D(-1)};$('#b3next').onclick=function(){step3D(1)};$('#b3play').onclick=function(){toggle3D()};
var moved3=false,orb=null;
(function(){var down=false,sx,sy,t0;
  v3d.addEventListener('contextmenu',function(e){if(!e.target.closest('#cap3'))e.preventDefault()});
  v3d.addEventListener('pointerdown',function(e){if(e.target.closest('#hud,#size3,#cap3'))return;down=true;moved3=false;sx=e.clientX;sy=e.clientY;t0=cam.target;orb=(e.button===2||e.shiftKey)?{p:VW.p,y:VW.y}:null;if(orb)v3d.classList.add('orbit')});
  window.addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-sx,dy=e.clientY-sy;
    if(!moved3&&Math.abs(dx)+Math.abs(dy)>6){moved3=true;if(!orb){v3d.classList.add('drag');if(cam.play)toggle3D(false)}}
    if(moved3){if(orb){setView3(orb.p+dy*0.15,orb.y+dx*0.12)}else{cam.target=t0+(dy*-1+dx*-0.6)/-140;kick3()}}});
  window.addEventListener('pointerup',function(){down=false;orb=null;v3d.classList.remove('drag','orbit');setTimeout(function(){moved3=false},0)});
  v3d.addEventListener('wheel',function(e){if(e.target.closest('#size3,#cap3,#set3'))return;e.preventDefault();if(cam.play)toggle3D(false);
    var d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(e.deltaMode===1)d*=33;cam.target+=d*0.0028;kick3()},{passive:false});
})();


/* ---------- intro ---------- */
var intro=$('#intro');
function hideIntro(){intro.style.display='none';var h=$('#hint');h.style.opacity=1;setTimeout(function(){h.style.opacity=0},4500)}
if(D.introImage){$('#icover').src=D.introImage;$('#icover').onerror=function(){this.style.display='none'}}else $('#icover').style.display='none';
$('#ititle').textContent=D.title;
$('#imeta').textContent='编者 '+(D.authorName==='huming'?'胡明':D.authorName)+'　·　'+Math.floor(S[0].t)+'—'+Math.floor(S[S.length-1].t)+'　·　共 '+S.length+' 条';
$('#istart').onclick=hideIntro;

if(pref)$('#ipref').onclick=function(){hideIntro();openStory(pref)};else $('#ipref').style.display='none';
$('#i3d').onclick=function(){hideIntro();setView('3d')};
$('#ttl').onclick=function(){intro.style.display='flex'};
intro.addEventListener('click',function(e){if(e.target===intro)hideIntro()});

/* ---------- init ---------- */
buildTL();buildMini();
state.ppy=Math.max(24,W()/28);state.t0=1889;
applyFilter();
window.addEventListener('resize',function(){lay=null;renderTL();render3D();renderMini()});
var m=/#s(\d+)/.exec(location.hash);if(m){var x=S.filter(function(x){return String(x.id)===m[1]})[0];if(x){intro.style.display='none';setTimeout(function(){openStory(x)},50)}}
})();

(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  mctx.imageSmoothingEnabled = false;

  const boot = document.getElementById('boot');
  const bootBar = document.getElementById('bootBar');
  const bootText = document.getElementById('bootText');
  const startBtn = document.getElementById('startBtn');
  const interaction = document.getElementById('interaction');
  const interactionText = document.getElementById('interactionText');
  const toast = document.getElementById('toast');
  const questText = document.getElementById('questText');
  const questMeta = document.getElementById('questMeta');
  const modal = document.getElementById('modal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalClose = document.getElementById('modalClose');
  const modalTitle = document.getElementById('modalTitle');
  const modalEyebrow = document.getElementById('modalEyebrow');
  const modalBody = document.getElementById('modalBody');
  const mobileInteract = document.getElementById('mobileInteract');

  const WORLD = { w: 2400, h: 1760, tile: 32 };
  let running = false;
  let pausedForModal = false;
  let last = performance.now();
  let camera = { x: 0, y: 0 };
  let DPR = 1;

  const palette = {
    grass: '#6fa35f', grass2: '#659655', grass3: '#7dad68',
    road: '#424957', roadEdge: '#d0c9b8', roadDash: '#e6d68c',
    path: '#c8bda4', water: '#4b94a5', water2: '#68b0bd',
    tree: '#29583e', tree2: '#397451', bark: '#744b34',
    wall: '#d6c7ae', roof: '#9f4a3e', roof2: '#6e3541',
    ink: '#151920', accent: '#f0b33b', glass: '#78a7b0'
  };

  const player = {
    x: 1160, y: 900, w: 24, h: 30, speed: 230,
    facing: 'down', step: 0, moveT: 0
  };

  const keys = new Set();
  const solids = [];
  const landmarks = [];
  const decorations = [];
  const npcs = [];
  const cars = [];
  const visited = new Set(JSON.parse(localStorage.getItem('tjworld-visited') || '[]'));
  let nearInteractable = null;
  let secretCount = Number(localStorage.getItem('tjworld-secrets') || 0);

  const portfolio = {
    about: {
      eyebrow: 'ABOUT HOUSE',
      title: 'Hi, I’m TJ.',
      html: `
        <div class="modal-copy">
          <p>I’m a computer engineering student who likes building things that feel useful, tactile, and a little unreasonable in scope. This portfolio is one of them.</p>
          <p>I gravitate toward software that turns messy real-world workflows into something simple: tournament systems, public-resource tools, data-driven PWAs, and interactive experiments.</p>
        </div>
        <div class="stat-grid">
          <div class="stat"><strong>CE</strong><span>Computer Engineering</span></div>
          <div class="stat"><strong>Web + Systems</strong><span>Favorite build zone</span></div>
          <div class="stat"><strong>∞</strong><span>Ideas in progress</span></div>
        </div>
        <div class="note">This first build is deliberately a playable vertical slice. The city can grow into a much larger portfolio world without changing the core structure.</div>`
    },
    projects: {
      eyebrow: 'PROJECTS ARCADE',
      title: 'Things I’ve built.',
      html: `
        <div class="project-list">
          ${projectCard('Billiards Tournament Manager', 'A live tournament system with elimination brackets, match progression, queueing, and public-facing bracket views.', ['React', 'TypeScript', 'Supabase'])}
          ${projectCard('Common Ground', 'A resource platform designed to make legal, healthcare, food, housing, and community information easier to navigate.', ['JavaScript', 'Web UI', 'Public Resources'])}
          ${projectCard('Data-driven PWAs', 'A growing set of mobile-first experiments around astronomy, cities, planning, games, and personal tools.', ['PWA', 'APIs', 'UX'])}
        </div>`
    },
    skills: {
      eyebrow: 'BUILD LAB',
      title: 'The toolbox.',
      html: `<div class="modal-copy"><p>I care less about collecting logos and more about picking the right pieces for the thing I’m trying to make. These are the tools I keep coming back to.</p></div>
      <div class="skill-cloud">
        <span>JavaScript</span><span>TypeScript</span><span>React</span><span>HTML / CSS</span><span>Supabase</span><span>Git / GitHub</span><span>PWAs</span><span>UI / UX</span><span>Embedded Systems</span><span>MATLAB</span>
      </div>`
    },
    contact: {
      eyebrow: 'CONTACT STATION',
      title: 'Say hi.',
      html: `<div class="modal-copy"><p>The easiest public place to find my work is GitHub. This section is intentionally simple so it can later be wired to whatever contact channels you actually want public.</p></div>
      <div class="link-row"><a href="https://github.com/tjblech" target="_blank" rel="noreferrer">GITHUB ↗</a></div>`
    },
    billiards: {
      eyebrow: 'BILLIARDS HALL',
      title: 'Pool is part of the map.',
      html: `<div class="modal-copy"><p>This building is here because a personal portfolio should actually feel personal. A future version can turn this room into a tiny playable pool challenge, tournament-history display, or cue collection.</p></div>`
    },
    observatory: {
      eyebrow: 'OBSERVATORY',
      title: 'Build for curiosity.',
      html: `<div class="modal-copy"><p>I like projects that make data feel tangible. This observatory is a placeholder for astronomy, sensors, maps, live feeds, and the “what can I learn from this?” side of the portfolio.</p></div>`
    }
  };

  function projectCard(title, desc, tags) {
    return `<article class="project-card"><div class="project-icon"></div><div><h3>${title}</h3><p>${desc}</p><div class="project-tags">${tags.map(t=>`<span>${t}</span>`).join('')}</div></div></article>`;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * DPR));
    canvas.height = Math.max(1, Math.floor(rect.height * DPR));
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);
  resize();

  function rect(x,y,w,h,color, stroke=null, line=0) {
    ctx.fillStyle = color; ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    if (stroke && line) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.strokeRect(Math.floor(x)+.5,Math.floor(y)+.5,Math.floor(w)-1,Math.floor(h)-1); }
  }

  function addSolid(x,y,w,h) { solids.push({x,y,w,h}); }
  function addLandmark(id, x,y,w,h,label, color, contentKey=id) {
    landmarks.push({id,x,y,w,h,label,color,contentKey, visited: visited.has(id)});
    addSolid(x,y,w,h);
  }

  function buildWorld() {
    // Main roads
    decorations.push({kind:'road', x:0,y:720,w:WORLD.w,h:220});
    decorations.push({kind:'road', x:1000,y:0,w:250,h:WORLD.h});
    decorations.push({kind:'water', x:0,y:1290,w:WORLD.w,h:470});

    // Landmarks / original city blocks
    addLandmark('about', 255, 230, 310, 250, 'ABOUT HOUSE', '#b85d4b');
    addLandmark('projects', 710, 180, 370, 300, 'PROJECTS ARCADE', '#4f6f91');
    addLandmark('skills', 1380, 180, 380, 310, 'BUILD LAB', '#627d59');
    addLandmark('observatory', 1885, 185, 270, 280, 'OBSERVATORY', '#675f88');
    addLandmark('billiards', 250, 1020, 390, 235, 'BILLIARDS HALL', '#435f4c');
    addLandmark('contact', 1690, 1020, 410, 230, 'CONTACT STATION', '#9a6b3d');

    // Park / plaza solids and decorative objects
    addSolid(760, 1030, 250, 110); // fountain
    addSolid(1310, 1055, 220, 90); // planter

    // NPCs
    npcs.push(
      {x:650,y:625,name:'Mira', text:'The arcade has the project stuff. The lab is where the nerdier details live.', c:'#d78484', dir:1},
      {x:1470,y:650,name:'Rowan', text:'If you find all three gold chips, there’s a tiny secret.', c:'#83a6db', dir:-1},
      {x:875,y:1190,name:'Kai', text:'The city is intentionally overbuilt for a portfolio. That is, in fact, the point.', c:'#d7b66f', dir:1}
    );

    cars.push(
      {x:80,y:770,dir:1,speed:95,c:'#d9b537',lane:770},
      {x:2200,y:855,dir:-1,speed:120,c:'#6d8fb2',lane:855}
    );

    // Secret chips
    decorations.push({kind:'chip', x:612,y:565, id:'chip1'});
    decorations.push({kind:'chip', x:1620,y:570, id:'chip2'});
    decorations.push({kind:'chip', x:1510,y:1210, id:'chip3'});
  }
  buildWorld();

  function intersects(a,b) {
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }
  function playerBox(x=player.x,y=player.y) { return {x:x-player.w/2, y:y-player.h/2, w:player.w, h:player.h}; }
  function canMove(nx,ny) {
    const b = playerBox(nx,ny);
    if (b.x < 0 || b.y < 0 || b.x+b.w > WORLD.w || b.y+b.h > WORLD.h) return false;
    for (const s of solids) if (intersects(b,s)) return false;
    return true;
  }

  function update(dt) {
    if (!running || pausedForModal) return;
    let dx=0,dy=0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx--;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx++;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy--;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy++;
    dx += touchVector.x; dy += touchVector.y;
    if (dx || dy) {
      const len = Math.hypot(dx,dy) || 1; dx/=len; dy/=len;
      const nx = player.x + dx*player.speed*dt;
      const ny = player.y + dy*player.speed*dt;
      if (canMove(nx,player.y)) player.x = nx;
      if (canMove(player.x,ny)) player.y = ny;
      if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? 'right' : 'left';
      else player.facing = dy > 0 ? 'down' : 'up';
      player.moveT += dt*10; player.step = Math.floor(player.moveT)%2;
    }

    for (const c of cars) {
      c.x += c.dir*c.speed*dt;
      if (c.dir>0 && c.x>WORLD.w+120) c.x=-120;
      if (c.dir<0 && c.x<-120) c.x=WORLD.w+120;
    }

    // chip pickup
    for (const d of decorations) if (d.kind==='chip' && !localStorage.getItem('tjworld-'+d.id)) {
      if (Math.hypot(player.x-d.x, player.y-d.y) < 32) {
        localStorage.setItem('tjworld-'+d.id,'1');
        secretCount = ['chip1','chip2','chip3'].filter(id=>localStorage.getItem('tjworld-'+id)).length;
        localStorage.setItem('tjworld-secrets', String(secretCount));
        showToast(`GOLD CHIP FOUND · ${secretCount}/3`);
        if (secretCount===3) setTimeout(()=>showToast('SECRET COMPLETE: THE CITY IS YOURS TO EXPAND'), 1200);
      }
    }

    updateInteraction();
    const viewW = canvas.clientWidth, viewH = canvas.clientHeight;
    camera.x += ((player.x - viewW/2) - camera.x) * Math.min(1, dt*7);
    camera.y += ((player.y - viewH/2) - camera.y) * Math.min(1, dt*7);
    camera.x = Math.max(0, Math.min(WORLD.w-viewW, camera.x));
    camera.y = Math.max(0, Math.min(WORLD.h-viewH, camera.y));
  }

  function worldToScreen(x,y) { return {x:x-camera.x, y:y-camera.y}; }

  function drawGround() {
    rect(0,0,WORLD.w,WORLD.h,palette.grass);
    // checker grass noise
    for (let y=0;y<WORLD.h;y+=64) for (let x=0;x<WORLD.w;x+=64) {
      if (((x/64+y/64)|0)%3===0) rect(x+8,y+10,4,4,palette.grass3);
      if (((x/64)*7+(y/64)*3)%5===0) rect(x+42,y+38,3,3,palette.grass2);
    }
  }

  function drawRoad(d) {
    rect(d.x,d.y,d.w,d.h,palette.road);
    if (d.w>d.h) {
      rect(d.x,d.y+8,d.w,7,palette.roadEdge); rect(d.x,d.y+d.h-15,d.w,7,palette.roadEdge);
      for(let x=30;x<d.w;x+=84) rect(d.x+x,d.y+d.h/2-3,42,6,palette.roadDash);
    } else {
      rect(d.x+8,d.y,7,d.h,palette.roadEdge); rect(d.x+d.w-15,d.y,7,d.h,palette.roadEdge);
      for(let y=30;y<d.h;y+=84) rect(d.x+d.w/2-3,d.y+y,6,42,palette.roadDash);
    }
  }

  function drawWater(d, t) {
    rect(d.x,d.y,d.w,d.h,palette.water);
    for(let y=d.y+18;y<d.y+d.h;y+=36) {
      const off=(Math.floor(t*20)+y)%44;
      for(let x=d.x-20+off;x<d.x+d.w;x+=84) rect(x,y,38,4,palette.water2);
    }
    rect(d.x,d.y,d.w,12,'#ded3bb');
  }

  function drawBuilding(l) {
    // shadow
    rect(l.x+12,l.y+16,l.w,l.h,'rgba(18,24,25,.25)');
    rect(l.x,l.y,l.w,l.h,'#d9cdb8',palette.ink,5);
    rect(l.x-10,l.y-16,l.w+20,48,l.color,palette.ink,5);
    // roof stripes
    for(let x=l.x;x<l.x+l.w;x+=32) rect(x,l.y-14,16,43,'rgba(255,255,255,.07)');
    // windows
    const winY=l.y+78;
    for(let x=l.x+30;x<l.x+l.w-28;x+=72) {
      rect(x,winY,40,38,'#78a2a8',palette.ink,4);
      rect(x+5,winY+5,12,28,'#a7d0d4');
    }
    // door
    rect(l.x+l.w/2-30,l.y+l.h-68,60,68,'#59483e',palette.ink,5);
    rect(l.x+l.w/2+15,l.y+l.h-37,6,6,palette.accent);
    // sign
    rect(l.x+24,l.y+37,l.w-48,30,'#171b22');
    drawPixelText(l.label,l.x+l.w/2,l.y+58,10,'#f8f0dc','center');
    if (l.visited) {
      rect(l.x+l.w-28,l.y+8,18,18,'#f0b33b',palette.ink,3);
      drawPixelText('✓',l.x+l.w-19,l.y+22,12,'#111','center');
    }
  }

  function drawTree(x,y,s=1) {
    rect(x-5*s,y+8*s,10*s,22*s,palette.bark);
    ctx.fillStyle=palette.tree;
    ctx.beginPath();ctx.arc(x,y,20*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=palette.tree2;
    ctx.beginPath();ctx.arc(x-7*s,y-6*s,12*s,0,Math.PI*2);ctx.fill();
  }

  function drawFountain(t) {
    rect(760,1030,250,110,'#d4cab6',palette.ink,4);
    rect(790,1052,190,65,'#5a93a1',palette.ink,4);
    rect(875,1070,20,32,'#d9d0c0',palette.ink,3);
    const h=12+Math.sin(t*5)*7;
    rect(883,1054-h,4,h+14,'#8ed1da');
  }

  function drawPark() {
    // plaza walkways
    rect(650,960,950,24,palette.path);
    rect(1110,940,24,330,palette.path);
    drawFountain(performance.now()/1000);
    rect(1310,1055,220,90,'#bfae91',palette.ink,4);
    for(let x=1332;x<1510;x+=40) drawTree(x,1088,.7);
  }

  function drawPlayer() {
    ctx.save();ctx.translate(Math.round(player.x),Math.round(player.y));
    // shadow
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(-12,12,24,7);
    const bob = (keys.size || Math.abs(touchVector.x)+Math.abs(touchVector.y)>.1) ? (player.step?1:-1) : 0;
    ctx.translate(0,bob);
    // legs
    rectLocal(-8,7,6,12,'#243555'); rectLocal(2,7,6,12,'#243555');
    // torso / hoodie
    rectLocal(-10,-8,20,20,'#5d486f');
    rectLocal(-8,-6,16,6,'#76608a');
    // head
    rectLocal(-8,-20,16,14,'#e8ba91');
    rectLocal(-9,-23,18,6,'#45352e');
    // glasses
    rectLocal(-7,-15,5,3,'#161a20'); rectLocal(2,-15,5,3,'#161a20'); rectLocal(-2,-14,4,1,'#161a20');
    ctx.restore();
  }
  function rectLocal(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),Math.floor(w),Math.floor(h));}

  function drawNPC(n, t) {
    if(n.x<camera.x-50||n.y<camera.y-50||n.x>camera.x+canvas.clientWidth+50||n.y>camera.y+canvas.clientHeight+50)return;
    ctx.save();ctx.translate(Math.round(n.x),Math.round(n.y));
    const bob=Math.sin(t*2+n.x)*1.2;
    ctx.translate(0,bob);
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(-10,12,20,6);
    rectLocal(-7,7,5,11,'#30384b');rectLocal(2,7,5,11,'#30384b');
    rectLocal(-9,-8,18,17,n.c);rectLocal(-7,-19,14,13,'#d5a47f');rectLocal(-8,-22,16,5,'#3e3029');
    ctx.restore();
  }

  function drawCar(c) {
    if(c.x<camera.x-100||c.x>camera.x+canvas.clientWidth+100)return;
    ctx.save();ctx.translate(Math.round(c.x),Math.round(c.y));
    const flip=c.dir<0?-1:1;ctx.scale(flip,1);
    rectLocal(-34,-13,68,26,c.c); rectLocal(-20,-19,34,9,'#a5c9d1');
    rectLocal(-25,11,14,7,'#181c23'); rectLocal(14,11,14,7,'#181c23');
    rectLocal(25,-8,8,5,'#f5d786');
    ctx.restore();
  }

  function drawChip(d,t) {
    if (localStorage.getItem('tjworld-'+d.id)) return;
    if(d.x<camera.x-30||d.y<camera.y-30||d.x>camera.x+canvas.clientWidth+30||d.y>camera.y+canvas.clientHeight+30)return;
    const s=10+Math.sin(t*4+d.x)*2;
    ctx.save();ctx.translate(d.x,d.y);ctx.rotate(t*.7);rectLocal(-s/2,-s/2,s,s,'#f5be3f');rectLocal(-s/4,-s/4,s/2,s/2,'#fff0a9');ctx.restore();
  }

  function drawPixelText(text,x,y,size,color,align='left') {
    ctx.save();ctx.font=`900 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillText(text,x+1,y+2);ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore();
  }

  function drawWorld(time) {
    ctx.save();
    ctx.translate(-camera.x,-camera.y);
    drawGround();
    for(const d of decorations) if(d.kind==='road') drawRoad(d);
    for(const d of decorations) if(d.kind==='water') drawWater(d,time);

    // sidewalks / crosswalks
    rect(0,690,WORLD.w,22,palette.path);rect(0,948,WORLD.w,22,palette.path);
    rect(968,0,22,WORLD.h,palette.path);rect(1262,0,22,WORLD.h,palette.path);
    for(let x=1018;x<1230;x+=34) {rect(x,690,20,54,'#ece7da');rect(x,918,20,30,'#ece7da');}

    // trees around edges and blocks
    const trees=[[90,160],[150,210],[600,120],[1280,120],[1810,100],[2230,180],[120,520],[520,560],[1800,560],[2180,560],[100,1110],[690,1135],[1580,1140],[2190,1120]];
    for(const [x,y] of trees) drawTree(x,y,1.1);
    drawPark();
    for(const l of landmarks) drawBuilding(l);

    // Labels on open areas
    drawPixelText('PORTFOLIO PLAZA',1125,1012,13,'#243044','center');
    drawPixelText('RIVER BYTE',1320,1342,12,'#e7efe9','center');

    for(const n of npcs) drawNPC(n,time);
    for(const c of cars) drawCar(c);
    for(const d of decorations) if(d.kind==='chip') drawChip(d,time);
    drawPlayer();
    ctx.restore();

    // vignette
    const g=ctx.createRadialGradient(canvas.clientWidth/2,canvas.clientHeight/2,canvas.clientHeight*.15,canvas.clientWidth/2,canvas.clientHeight/2,canvas.clientWidth*.72);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.24)');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
  }

  function updateInteraction() {
    nearInteractable=null;
    let best=92;
    for(const l of landmarks) {
      const px=Math.max(l.x,Math.min(player.x,l.x+l.w));
      const py=Math.max(l.y,Math.min(player.y,l.y+l.h));
      const d=Math.hypot(player.x-px,player.y-py);
      if(d<best){best=d;nearInteractable={type:'landmark',data:l};}
    }
    for(const n of npcs) {
      const d=Math.hypot(player.x-n.x,player.y-n.y);
      if(d<70 && d<best){best=d;nearInteractable={type:'npc',data:n};}
    }
    if(nearInteractable){interaction.classList.remove('hidden');interactionText.textContent=nearInteractable.type==='npc'?`TALK TO ${nearInteractable.data.name.toUpperCase()}`:`ENTER ${nearInteractable.data.label}`;}
    else interaction.classList.add('hidden');
  }

  function interact() {
    if(pausedForModal){closeModal();return;}
    if(!nearInteractable)return;
    if(nearInteractable.type==='npc') { showToast(`${nearInteractable.data.name}: ${nearInteractable.data.text}`, 4200); return; }
    const l=nearInteractable.data;
    l.visited=true;visited.add(l.id);localStorage.setItem('tjworld-visited',JSON.stringify([...visited]));
    openModal(l.contentKey);
    updateQuest();
  }

  function openModal(key) {
    const data=portfolio[key]; if(!data)return;
    pausedForModal=true;
    modalEyebrow.textContent=data.eyebrow;modalTitle.textContent=data.title;modalBody.innerHTML=data.html;
    modal.classList.remove('hidden');modalBackdrop.classList.remove('hidden');
  }
  function closeModal(){pausedForModal=false;modal.classList.add('hidden');modalBackdrop.classList.add('hidden');}
  modalClose.addEventListener('click',closeModal);modalBackdrop.addEventListener('click',closeModal);

  function showToast(msg,duration=2200){toast.textContent=msg;toast.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),duration);}
  function updateQuest(){
    const count=visited.size;questMeta.textContent=`${count} / 6 landmarks visited · ${secretCount}/3 chips`;
    if(count>=6)questText.textContent='Neighborhood explored';
    else questText.textContent='Explore the neighborhood';
  }
  updateQuest();

  function drawMinimap(){
    if(!mini.offsetParent)return;
    mctx.clearRect(0,0,mini.width,mini.height);mctx.fillStyle='#50764b';mctx.fillRect(0,0,mini.width,mini.height);
    const sx=mini.width/WORLD.w, sy=mini.height/WORLD.h;
    mctx.fillStyle='#3f4652';mctx.fillRect(0,720*sy,mini.width,220*sy);mctx.fillRect(1000*sx,0,250*sx,mini.height);
    mctx.fillStyle='#4f95a3';mctx.fillRect(0,1290*sy,mini.width,470*sy);
    for(const l of landmarks){mctx.fillStyle=l.visited?'#f3b73f':l.color;mctx.fillRect(l.x*sx,l.y*sy,Math.max(4,l.w*sx),Math.max(4,l.h*sy));}
    mctx.fillStyle='#fff';mctx.fillRect(player.x*sx-2,player.y*sy-2,5,5);mctx.strokeStyle='#14181e';mctx.strokeRect(player.x*sx-3,player.y*sy-3,7,7);
  }

  function frame(now){
    const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);
    ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
    drawWorld(now/1000);drawMinimap();requestAnimationFrame(frame);
  }

  window.addEventListener('keydown',e=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    keys.add(e.code);
    if((e.code==='KeyE'||e.code==='Space')&&!e.repeat)interact();
    if(e.code==='Escape'&&pausedForModal)closeModal();
  },{passive:false});
  window.addEventListener('keyup',e=>keys.delete(e.code));

  document.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.jump;const l=landmarks.find(x=>x.id===id);if(!l)return;
    player.x=l.x+l.w/2;player.y=l.y>900?l.y-65:l.y+l.h+65;openModal(id);l.visited=true;visited.add(id);localStorage.setItem('tjworld-visited',JSON.stringify([...visited]));updateQuest();
  }));

  // Touch joystick
  const stick=document.getElementById('stickBase'), knob=document.getElementById('stickKnob');
  const touchVector={x:0,y:0};let stickPointer=null;
  function setStick(clientX,clientY){
    const r=stick.getBoundingClientRect();let dx=clientX-(r.left+r.width/2),dy=clientY-(r.top+r.height/2);const max=34;const len=Math.hypot(dx,dy)||1;const mag=Math.min(max,len);dx=dx/len*mag;dy=dy/len*mag;knob.style.transform=`translate(${dx}px,${dy}px)`;touchVector.x=dx/max;touchVector.y=dy/max;
  }
  stick.addEventListener('pointerdown',e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);setStick(e.clientX,e.clientY);});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)setStick(e.clientX,e.clientY);});
  function clearStick(e){if(stickPointer===null||e.pointerId===stickPointer){stickPointer=null;touchVector.x=touchVector.y=0;knob.style.transform='translate(0,0)';}}
  stick.addEventListener('pointerup',clearStick);stick.addEventListener('pointercancel',clearStick);mobileInteract.addEventListener('click',interact);

  // Boot sequence
  const bootSteps=[
    ['Drawing the city...',18],['Planting suspiciously square trees...',38],['Teaching NPCs to walk...',57],['Hiding three gold chips...',76],['Polishing the portfolio...',92],['Ready.',100]
  ];
  let bi=0;
  function bootNext(){
    const [text,pct]=bootSteps[bi++];bootText.textContent=text;bootBar.style.width=pct+'%';
    if(bi<bootSteps.length)setTimeout(bootNext,300+Math.random()*220);else setTimeout(()=>startBtn.classList.remove('hidden'),250);
  }
  setTimeout(bootNext,260);
  startBtn.addEventListener('click',()=>{running=true;boot.style.transition='opacity .35s';boot.style.opacity='0';setTimeout(()=>boot.remove(),360);showToast('WASD / ARROWS TO MOVE · E TO INTERACT',3000);});

  requestAnimationFrame(frame);

  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();

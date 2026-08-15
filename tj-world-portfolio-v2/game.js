(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const mini = $('minimap');
  const mctx = mini.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  mctx.imageSmoothingEnabled = false;

  const boot = $('boot');
  const bootBar = $('bootBar');
  const bootText = $('bootText');
  const startBtn = $('startBtn');
  const interaction = $('interaction');
  const interactionText = $('interactionText');
  const toast = $('toast');
  const questText = $('questText');
  const questMeta = $('questMeta');
  const modal = $('modal');
  const modalBackdrop = $('modalBackdrop');
  const modalClose = $('modalClose');
  const modalTitle = $('modalTitle');
  const modalEyebrow = $('modalEyebrow');
  const modalBody = $('modalBody');
  const mobileInteract = $('mobileInteract');
  const locationChip = $('locationChip');

  const WORLD = { w: 2500, h: 1820, tile: 32 };
  const ROOM = { w: 960, h: 600 };
  const TOTAL_LANDMARKS = 6;
  let running = false;
  let pausedForModal = false;
  let mode = 'world'; // world | interior | pool
  let currentInterior = null;
  let last = performance.now();
  let camera = { x: 0, y: 0 };
  let DPR = 1;
  let nearInteractable = null;
  let fade = 0;
  let fadeDir = 0;
  let pendingTransition = null;
  let night = localStorage.getItem('tjworld-night') === '1';
  let lastMoveVector = { x: 0, y: 0 };

  const palette = {
    grass: '#6f9f5d', grass2: '#638f53', grass3: '#82ad6c', grassDark: '#557f49',
    road: '#414755', road2: '#343a47', roadEdge: '#d4cdb9', roadDash: '#e8d993',
    path: '#cbbfa5', path2: '#b9ad95', water: '#4d91a2', water2: '#70b6c0',
    tree: '#29563d', tree2: '#3b7551', bark: '#744a34',
    wall: '#d8ccb7', wall2: '#c8baa3', ink: '#141920', accent: '#f2b63c',
    glass: '#79a7b0', cream: '#f2ead9', white: '#fffaf1', red: '#b85e4d', blue: '#4d6d91'
  };

  const player = {
    x: 1160, y: 990, w: 26, h: 34, speed: 230,
    facing: 'down', step: 0, moveT: 0,
    worldReturn: { x: 1160, y: 990 }
  };

  const keys = new Set();
  const solids = [];
  const landmarks = [];
  const decorations = [];
  const npcs = [];
  const cars = [];
  const visited = new Set(JSON.parse(localStorage.getItem('tjworld-visited') || '[]'));
  let secretCount = ['chip1','chip2','chip3'].filter(id => localStorage.getItem('tjworld-'+id)).length;

  const portfolio = {
    about: {
      eyebrow: 'ABOUT HOUSE',
      title: 'Hi, I’m TJ.',
      html: `
        <div class="modal-copy">
          <p>I’m a computer engineering student who likes building software that feels tangible — tools, games, data-driven PWAs, and systems that turn messy workflows into something people can actually use.</p>
          <p>This portfolio is intentionally a little excessive. I wanted the site itself to be one of the projects.</p>
        </div>
        <div class="stat-grid">
          <div class="stat"><strong>CE</strong><span>Computer Engineering</span></div>
          <div class="stat"><strong>Build-first</strong><span>Prototype, test, iterate</span></div>
          <div class="stat"><strong>∞</strong><span>Ideas in progress</span></div>
        </div>
        <div class="note">V2 adds real interiors, wandering NPCs, a day/night toggle, and a playable billiards room. The city is becoming the navigation, not just a backdrop.</div>`
    },
    projects: {
      eyebrow: 'PROJECTS ARCADE',
      title: 'Things I’ve built.',
      html: `
        <div class="project-list">
          ${projectCard('Billiards Tournament Manager', 'A live tournament system with brackets, match progression, queueing, and public-facing views.', ['React', 'TypeScript', 'Supabase'])}
          ${projectCard('Common Ground', 'A resource platform designed to make legal, healthcare, food, housing, and community information easier to navigate.', ['JavaScript', 'Web UI', 'Public Resources'])}
          ${projectCard('SkyLab / CityLab experiments', 'Mobile-first PWAs that turn public and live data into useful, polished tools.', ['PWA', 'APIs', 'UX'])}
          ${projectCard('Game experiments', 'Roguelikes, factory systems, RPG prototypes, and small interactive tools built to explore mechanics quickly.', ['Canvas', 'Game Design', 'Systems'])}
        </div>`
    },
    skills: {
      eyebrow: 'BUILD LAB',
      title: 'The toolbox.',
      html: `<div class="modal-copy"><p>I care more about being able to ship the thing than collecting logos. These are the tools and areas I keep reaching for.</p></div>
      <div class="skill-cloud">
        <span>JavaScript</span><span>TypeScript</span><span>React</span><span>HTML / CSS</span><span>Supabase</span><span>Git / GitHub</span><span>PWAs</span><span>UI / UX</span><span>Embedded Systems</span><span>MATLAB</span><span>Canvas</span><span>APIs</span>
      </div>`
    },
    contact: {
      eyebrow: 'CONTACT STATION',
      title: 'Say hi.',
      html: `<div class="modal-copy"><p>The easiest public place to find my work is GitHub. This station can later grow into a real contact form, resume download, and social links without changing the game layer.</p></div>
      <div class="link-row"><a href="https://github.com/tjblech" target="_blank" rel="noreferrer">GITHUB ↗</a></div>`
    },
    billiards: {
      eyebrow: 'BILLIARDS HALL',
      title: 'Yes, the pool table works.',
      html: `<div class="modal-copy"><p>Pool is one of the things that actually belongs in a personal portfolio about me. In V2 the hall is a real room instead of just a modal — walk up to the table and press E to launch the mini-game.</p></div>
      <div class="note">Mini-game controls: move the mouse to aim and click to shoot, or use ←/→ to aim, ↑/↓ to change power, SPACE to shoot. ESC exits.</div>`
    },
    observatory: {
      eyebrow: 'OBSERVATORY',
      title: 'Build for curiosity.',
      html: `<div class="modal-copy"><p>I like projects that make data feel physical: astronomy, maps, sensors, live feeds, and interfaces where the data itself becomes something you can explore.</p></div>
      <div class="note">The observatory is a good future home for live astronomy data, sky conditions, satellite passes, or hardware projects.</div>`
    }
  };

  function projectCard(title, desc, tags) {
    return `<article class="project-card"><div class="project-icon"></div><div><h3>${title}</h3><p>${desc}</p><div class="project-tags">${tags.map(t=>`<span>${t}</span>`).join('')}</div></div></article>`;
  }

  const interiors = {
    about: {
      title: 'ABOUT HOUSE', floor: '#b8997f', wall: '#e5d7bf', accent: '#b85e4d',
      objects: [
        { id:'about-desk', x:350,y:86,w:260,h:80,label:'READ ABOUT TJ', action:'modal', key:'about' },
        { id:'about-shelf', x:88,y:106,w:92,h:180,label:'BOOKS + INTERESTS', action:'toast', text:'A shelf full of games, engineering books, comics, music, and half-finished ideas.' },
        { id:'about-sofa', x:690,y:138,w:160,h:70,label:'SIT FOR A SECOND', action:'toast', text:'The couch does nothing. Extremely realistic portfolio feature.' }
      ]
    },
    projects: {
      title: 'PROJECTS ARCADE', floor: '#3f4554', wall: '#c8d1db', accent: '#4d6d91',
      objects: [
        { id:'project-cabinet', x:325,y:84,w:310,h:86,label:'BROWSE PROJECTS', action:'modal', key:'projects' },
        { id:'cab1', x:95,y:120,w:90,h:150,label:'PLAY: MINESWEEPER', action:'toast', text:'Cabinet reserved for the Minesweeper Roguelike.' },
        { id:'cab2', x:735,y:120,w:90,h:150,label:'PLAY: COINWORKS', action:'toast', text:'Cabinet reserved for the factory / conveyor project.' }
      ]
    },
    skills: {
      title: 'BUILD LAB', floor: '#9ca495', wall: '#d8dfd2', accent: '#627d59',
      objects: [
        { id:'lab-terminal', x:344,y:78,w:272,h:82,label:'OPEN TOOLBOX', action:'modal', key:'skills' },
        { id:'bench', x:95,y:130,w:210,h:75,label:'WORKBENCH', action:'toast', text:'Oscilloscope, Arduino, jumper wires, and one component nobody remembers ordering.' },
        { id:'server', x:735,y:115,w:105,h:185,label:'SERVER RACK', action:'toast', text:'Blinking LEDs: the universal symbol for “probably working.”' }
      ]
    },
    observatory: {
      title: 'OBSERVATORY', floor: '#354052', wall: '#d1d6df', accent: '#675f88',
      objects: [
        { id:'scope', x:365,y:84,w:230,h:120,label:'USE TELESCOPE', action:'modal', key:'observatory' },
        { id:'screen', x:95,y:115,w:155,h:110,label:'SKY TERMINAL', action:'toast', text:'Future live data: cloud cover, seeing, moonlight, satellites, and “is it worth going outside?”' }
      ]
    },
    billiards: {
      title: 'BILLIARDS HALL', floor: '#7a4e36', wall: '#ddd0b5', accent: '#41624c',
      objects: [
        { id:'pool-table', x:250,y:112,w:460,h:235,label:'PLAY A RACK', action:'pool' },
        { id:'cue-rack', x:80,y:120,w:78,h:180,label:'CUE RACK', action:'toast', text:'Future home for cue specs, favorite setups, and maybe match history.' },
        { id:'hall-note', x:770,y:125,w:90,h:120,label:'ABOUT THE HALL', action:'modal', key:'billiards' }
      ]
    },
    contact: {
      title: 'CONTACT STATION', floor: '#a18a6b', wall: '#e1d6c2', accent: '#9a6b3d',
      objects: [
        { id:'ticket', x:330,y:88,w:300,h:85,label:'CONTACT / LINKS', action:'modal', key:'contact' },
        { id:'departures', x:95,y:105,w:160,h:105,label:'DEPARTURES', action:'toast', text:'Next stops: GitHub, whatever I build next, and probably another project at 2 AM.' }
      ]
    }
  };

  const pool = {
    balls: [], aim: 0, power: .62, score: 0, shots: 0, mouseAim: null,
    table: { x:100, y:85, w:760, h:420 },
    active: false
  };

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
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    if (stroke && line) {
      ctx.strokeStyle = stroke; ctx.lineWidth = line;
      ctx.strokeRect(Math.floor(x)+.5, Math.floor(y)+.5, Math.floor(w)-1, Math.floor(h)-1);
    }
  }
  function rectLocal(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),Math.floor(w),Math.floor(h));}
  function addSolid(x,y,w,h) { solids.push({x,y,w,h}); }
  function addLandmark(id, x,y,w,h,label, color, contentKey=id) {
    landmarks.push({id,x,y,w,h,label,color,contentKey, visited: visited.has(id)});
    addSolid(x,y,w,h);
  }

  function buildWorld() {
    decorations.push({kind:'road', x:0,y:720,w:WORLD.w,h:220});
    decorations.push({kind:'road', x:1000,y:0,w:250,h:WORLD.h});
    decorations.push({kind:'water', x:0,y:1340,w:WORLD.w,h:480});

    addLandmark('about', 235, 230, 330, 260, 'ABOUT HOUSE', '#b85d4b');
    addLandmark('projects', 675, 170, 390, 315, 'PROJECTS ARCADE', '#4f6f91');
    addLandmark('skills', 1380, 180, 390, 315, 'BUILD LAB', '#627d59');
    addLandmark('observatory', 1900, 185, 290, 285, 'OBSERVATORY', '#675f88');
    addLandmark('billiards', 235, 1050, 410, 245, 'BILLIARDS HALL', '#435f4c');
    addLandmark('contact', 1720, 1045, 430, 245, 'CONTACT STATION', '#9a6b3d');

    addSolid(755, 1045, 265, 115);
    addSolid(1315, 1070, 230, 90);

    // Background structures that make the city feel authored rather than six boxes on grass.
    decorations.push(
      {kind:'smallBuilding',x:60,y:160,w:125,h:230,c:'#8b7665',label:'CAFE'},
      {kind:'smallBuilding',x:2225,y:205,w:180,h:270,c:'#6d7d70',label:'APT 03'},
      {kind:'smallBuilding',x:70,y:1010,w:115,h:250,c:'#6d7181',label:'BIKE'},
      {kind:'smallBuilding',x:2210,y:1010,w:205,h:260,c:'#8b6a59',label:'GARAGE'},
      {kind:'billboard',x:1275,y:605,w:260,h:92},
      {kind:'dock',x:1040,y:1370,w:420,h:95},
      {kind:'flowers',x:615,y:520,w:320,h:80},
      {kind:'flowers',x:1460,y:520,w:285,h:80}
    );

    npcs.push(
      {x:650,y:620,baseX:650,baseY:620,range:130,name:'Mira', text:'The arcade has the project stuff. The lab is where the nerdier details live.', c:'#d78484', vx:22},
      {x:1470,y:650,baseX:1470,baseY:650,range:150,name:'Rowan', text:'Press N if you want to see the city after dark.', c:'#83a6db', vx:-18},
      {x:875,y:1210,baseX:875,baseY:1210,range:105,name:'Kai', text:'The billiards hall has an actual mini-game now. V2 got a little carried away.', c:'#d7b66f', vx:16},
      {x:1980,y:635,baseX:1980,baseY:635,range:95,name:'June', text:'Walk inside the buildings. They are rooms now, not just buttons.', c:'#b58bd0', vx:-15}
    );

    cars.push(
      {x:80,y:770,dir:1,speed:95,c:'#d9b537',lane:770},
      {x:2200,y:855,dir:-1,speed:120,c:'#6d8fb2',lane:855},
      {x:1650,y:805,dir:1,speed:72,c:'#b75f53',lane:805}
    );

    decorations.push({kind:'chip', x:610,y:585, id:'chip1'});
    decorations.push({kind:'chip', x:1625,y:590, id:'chip2'});
    decorations.push({kind:'chip', x:1545,y:1230, id:'chip3'});

    // Lamps become important at night.
    [[610,680],[900,680],[1320,680],[1660,680],[1900,680],[675,1000],[980,1000],[1305,1000],[1640,1000],[1980,1000]].forEach(([x,y])=>decorations.push({kind:'lamp',x,y}));
  }
  buildWorld();

  function intersects(a,b) {
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }
  function playerBox(x=player.x,y=player.y) { return {x:x-player.w/2, y:y-player.h/2, w:player.w, h:player.h}; }
  function canMoveWorld(nx,ny) {
    const b = playerBox(nx,ny);
    if (b.x < 0 || b.y < 0 || b.x+b.w > WORLD.w || b.y+b.h > WORLD.h) return false;
    for (const s of solids) if (intersects(b,s)) return false;
    return true;
  }

  function roomSolids() {
    const r = interiors[currentInterior];
    if (!r) return [];
    return [
      {x:0,y:0,w:ROOM.w,h:42},{x:0,y:0,w:42,h:ROOM.h},{x:ROOM.w-42,y:0,w:42,h:ROOM.h},
      ...r.objects.map(o=>({x:o.x,y:o.y,w:o.w,h:o.h}))
    ];
  }
  function canMoveRoom(nx,ny) {
    const b = playerBox(nx,ny);
    if (b.x < 46 || b.x+b.w > ROOM.w-46 || b.y < 48 || b.y+b.h > ROOM.h-34) return false;
    for (const s of roomSolids()) if (intersects(b,s)) return false;
    return true;
  }

  function getMoveVector() {
    let dx=0,dy=0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx--;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx++;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy--;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy++;
    dx += touchVector.x; dy += touchVector.y;
    if (dx || dy) { const len=Math.hypot(dx,dy)||1; dx/=len;dy/=len; }
    return {dx,dy};
  }

  function update(dt) {
    if (!running || pausedForModal) return;
    if (mode === 'pool') { updatePool(dt); return; }

    const {dx,dy} = getMoveVector();
    lastMoveVector = {x:dx,y:dy};
    if (dx || dy) {
      const speed = mode === 'interior' ? 200 : player.speed;
      const nx = player.x + dx*speed*dt;
      const ny = player.y + dy*speed*dt;
      const canMove = mode === 'world' ? canMoveWorld : canMoveRoom;
      if (canMove(nx,player.y)) player.x = nx;
      if (canMove(player.x,ny)) player.y = ny;
      if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? 'right' : 'left';
      else player.facing = dy > 0 ? 'down' : 'up';
      player.moveT += dt*10; player.step = Math.floor(player.moveT)%2;
    }

    if (mode === 'world') {
      for (const c of cars) {
        c.x += c.dir*c.speed*dt;
        if (c.dir>0 && c.x>WORLD.w+120) c.x=-120;
        if (c.dir<0 && c.x<-120) c.x=WORLD.w+120;
      }
      for (const n of npcs) {
        n.x += n.vx*dt;
        if (n.x > n.baseX+n.range) n.vx = -Math.abs(n.vx);
        if (n.x < n.baseX-n.range) n.vx = Math.abs(n.vx);
      }

      for (const d of decorations) if (d.kind==='chip' && !localStorage.getItem('tjworld-'+d.id)) {
        if (Math.hypot(player.x-d.x, player.y-d.y) < 34) {
          localStorage.setItem('tjworld-'+d.id,'1');
          secretCount = ['chip1','chip2','chip3'].filter(id=>localStorage.getItem('tjworld-'+id)).length;
          localStorage.setItem('tjworld-secrets', String(secretCount));
          showToast(`GOLD CHIP FOUND · ${secretCount}/3`);
          if (secretCount===3) setTimeout(()=>showToast('SECRET COMPLETE · NIGHT LIGHTS NOW GLOW GOLD'), 1000);
          updateQuest();
        }
      }

      const viewW = canvas.clientWidth, viewH = canvas.clientHeight;
      camera.x += ((player.x - viewW/2) - camera.x) * Math.min(1, dt*7);
      camera.y += ((player.y - viewH/2) - camera.y) * Math.min(1, dt*7);
      camera.x = Math.max(0, Math.min(WORLD.w-viewW, camera.x));
      camera.y = Math.max(0, Math.min(WORLD.h-viewH, camera.y));
    }

    updateInteraction();
    updateFade(dt);
  }

  function updateFade(dt) {
    if (!fadeDir) return;
    fade += fadeDir * dt * 3.8;
    if (fadeDir > 0 && fade >= 1) {
      fade = 1;
      fadeDir = -1;
      if (pendingTransition) { const fn=pendingTransition; pendingTransition=null; fn(); }
    } else if (fadeDir < 0 && fade <= 0) {
      fade=0; fadeDir=0;
    }
  }
  function transition(fn) { if (fadeDir) return; pendingTransition=fn; fadeDir=1; }

  function enterInterior(id) {
    const l = landmarks.find(x=>x.id===id);
    if (!l) return;
    l.visited=true; visited.add(l.id); localStorage.setItem('tjworld-visited',JSON.stringify([...visited])); updateQuest();
    player.worldReturn = { x: player.x, y: player.y };
    transition(()=>{
      mode='interior'; currentInterior=id; player.x=ROOM.w/2; player.y=520; player.facing='up';
      if (locationChip) locationChip.textContent = interiors[id].title;
    });
  }
  function exitInterior() {
    transition(()=>{
      mode='world'; currentInterior=null; player.x=player.worldReturn.x; player.y=player.worldReturn.y; player.facing='down';
      if (locationChip) locationChip.textContent='PORTFOLIO DISTRICT';
    });
  }

  function drawGround() {
    rect(0,0,WORLD.w,WORLD.h,palette.grass);
    for (let y=0;y<WORLD.h;y+=64) for (let x=0;x<WORLD.w;x+=64) {
      if (((x/64+y/64)|0)%3===0) rect(x+8,y+10,4,4,palette.grass3);
      if (((x/64)*7+(y/64)*3)%5===0) rect(x+42,y+38,3,3,palette.grass2);
    }
    // subtle mower stripes
    ctx.fillStyle='rgba(255,255,255,.025)';
    for(let x=0;x<WORLD.w;x+=96)ctx.fillRect(x,0,32,WORLD.h);
  }

  function drawRoad(d) {
    rect(d.x,d.y,d.w,d.h,palette.road);
    if (d.w>d.h) {
      rect(d.x,d.y+8,d.w,7,palette.roadEdge); rect(d.x,d.y+d.h-15,d.w,7,palette.roadEdge);
      rect(d.x,d.y+18,d.w,3,palette.road2); rect(d.x,d.y+d.h-22,d.w,3,palette.road2);
      for(let x=30;x<d.w;x+=84) rect(d.x+x,d.y+d.h/2-3,42,6,palette.roadDash);
    } else {
      rect(d.x+8,d.y,7,d.h,palette.roadEdge); rect(d.x+d.w-15,d.y,7,d.h,palette.roadEdge);
      rect(d.x+18,d.y,3,d.h,palette.road2); rect(d.x+d.w-22,d.y,3,d.h,palette.road2);
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

  function drawSmallBuilding(d) {
    rect(d.x+9,d.y+12,d.w,d.h,'rgba(10,14,18,.18)');
    rect(d.x,d.y,d.w,d.h,'#d1c7b5',palette.ink,4);
    rect(d.x-5,d.y-12,d.w+10,35,d.c,palette.ink,4);
    rect(d.x+14,d.y+40,d.w-28,28,'#171b22');
    drawPixelText(d.label,d.x+d.w/2,d.y+59,9,'#f7efdf','center');
    for(let yy=d.y+90;yy<d.y+d.h-55;yy+=58)for(let xx=d.x+18;xx<d.x+d.w-28;xx+=55)rect(xx,yy,32,26,palette.glass,palette.ink,3);
    rect(d.x+d.w/2-21,d.y+d.h-50,42,50,'#655344',palette.ink,4);
  }

  function drawBuilding(l) {
    rect(l.x+12,l.y+16,l.w,l.h,'rgba(18,24,25,.25)');
    if (l.id === 'observatory') return drawObservatory(l);
    rect(l.x,l.y,l.w,l.h,'#d9cdb8',palette.ink,5);
    rect(l.x-10,l.y-16,l.w+20,48,l.color,palette.ink,5);
    for(let x=l.x;x<l.x+l.w;x+=32) rect(x,l.y-14,16,43,'rgba(255,255,255,.07)');

    if (l.id==='projects') {
      // arcade neon windows
      for(let x=l.x+26;x<l.x+l.w-28;x+=70) {
        rect(x,l.y+82,43,51,'#263348',palette.ink,4);
        rect(x+6,l.y+88,31,8, x%140===0 ? '#f2b63c':'#d86aa6');
        rect(x+8,l.y+102,27,24,'#4c6585');
      }
      rect(l.x+56,l.y+l.h-88,l.w-112,25,'#273145',palette.ink,3);
      drawPixelText('INSERT CURIOSITY',l.x+l.w/2,l.y+l.h-70,9,'#f2b63c','center');
    } else if (l.id==='billiards') {
      rect(l.x+28,l.y+82,l.w-56,64,'#244b38',palette.ink,4);
      for(let x=l.x+48;x<l.x+l.w-60;x+=75){ctx.fillStyle='#f3df9d';ctx.beginPath();ctx.arc(x,l.y+113,13,0,Math.PI*2);ctx.fill();}
      drawPixelText('POOL • NINE BALL • OPEN LATE',l.x+l.w/2,l.y+122,9,'#f8ead0','center');
    } else if (l.id==='contact') {
      rect(l.x+24,l.y+84,l.w-48,46,'#4d392f',palette.ink,4);
      drawPixelText('ARRIVALS / DEPARTURES',l.x+l.w/2,l.y+113,10,'#f5d88b','center');
    } else {
      const winY=l.y+82;
      for(let x=l.x+30;x<l.x+l.w-28;x+=72) {
        rect(x,winY,40,38,'#78a2a8',palette.ink,4);
        rect(x+5,winY+5,12,28,'#a7d0d4');
      }
    }

    rect(l.x+l.w/2-30,l.y+l.h-68,60,68,'#59483e',palette.ink,5);
    rect(l.x+l.w/2+15,l.y+l.h-37,6,6,palette.accent);
    rect(l.x+24,l.y+37,l.w-48,30,'#171b22');
    drawPixelText(l.label,l.x+l.w/2,l.y+58,10,'#f8f0dc','center');
    if (l.visited) {
      rect(l.x+l.w-28,l.y+8,18,18,'#f0b33b',palette.ink,3);
      drawPixelText('✓',l.x+l.w-19,l.y+22,12,'#111','center');
    }
  }

  function drawObservatory(l) {
    rect(l.x,l.y+65,l.w,l.h-65,'#d6cdbd',palette.ink,5);
    ctx.fillStyle=l.color;ctx.strokeStyle=palette.ink;ctx.lineWidth=5;
    ctx.beginPath();ctx.arc(l.x+l.w/2,l.y+70,l.w*.34,Math.PI,0);ctx.fill();ctx.stroke();
    rect(l.x+l.w/2-4,l.y+8,8,70,'#202633');
    rect(l.x+18,l.y+37,l.w-36,29,'#171b22');
    drawPixelText(l.label,l.x+l.w/2,l.y+58,10,'#f8f0dc','center');
    for(let x=l.x+32;x<l.x+l.w-30;x+=78){rect(x,l.y+125,42,38,palette.glass,palette.ink,4);rect(x+6,l.y+131,12,26,'#b3d6d8');}
    rect(l.x+l.w/2-30,l.y+l.h-68,60,68,'#59483e',palette.ink,5);
    rect(l.x+l.w/2+15,l.y+l.h-37,6,6,palette.accent);
    if(l.visited){rect(l.x+l.w-28,l.y+78,18,18,palette.accent,palette.ink,3);drawPixelText('✓',l.x+l.w-19,l.y+92,12,'#111','center');}
  }

  function drawTree(x,y,s=1) {
    rect(x-5*s,y+8*s,10*s,22*s,palette.bark);
    ctx.fillStyle=palette.tree;ctx.beginPath();ctx.arc(x,y,20*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=palette.tree2;ctx.beginPath();ctx.arc(x-7*s,y-6*s,12*s,0,Math.PI*2);ctx.fill();
  }
  function drawBush(x,y,s=1) {
    ctx.fillStyle='#3e7449';ctx.beginPath();ctx.arc(x-8*s,y,11*s,0,Math.PI*2);ctx.arc(x+8*s,y,12*s,0,Math.PI*2);ctx.arc(x,y-7*s,12*s,0,Math.PI*2);ctx.fill();
  }

  function drawFountain(t) {
    rect(755,1045,265,115,'#d4cab6',palette.ink,4);
    rect(787,1068,201,67,'#5a93a1',palette.ink,4);
    rect(875,1085,20,32,'#d9d0c0',palette.ink,3);
    const h=12+Math.sin(t*5)*7;
    rect(883,1069-h,4,h+14,'#8ed1da');
    for(let i=0;i<4;i++){const a=t*1.5+i*1.57;ctx.fillStyle='rgba(177,231,235,.8)';ctx.fillRect(884+Math.cos(a)*32,1088+Math.sin(a)*10,3,3);}
  }

  function drawPark(t) {
    rect(650,968,980,24,palette.path);
    rect(1110,948,24,355,palette.path);
    drawFountain(t);
    rect(1315,1070,230,90,'#bfae91',palette.ink,4);
    for(let x=1338;x<1520;x+=42) drawTree(x,1102,.68);
    // benches
    [[675,1030],[1515,1015],[1040,1220]].forEach(([x,y])=>{rect(x,y,82,12,'#835b3e',palette.ink,3);rect(x+8,y+12,6,18,'#4a3a31');rect(x+68,y+12,6,18,'#4a3a31');});
  }

  function drawFlowers(d) {
    rect(d.x,d.y,d.w,d.h,'#4f804b',palette.ink,3);
    const colors=['#f1c34f','#e88aa5','#f0ece0','#8fc8de'];
    for(let y=d.y+12;y<d.y+d.h-8;y+=18)for(let x=d.x+14;x<d.x+d.w-8;x+=22){ctx.fillStyle=colors[((x+y)/2|0)%colors.length];ctx.fillRect(x,y,5,5);}
  }

  function drawBillboard(d) {
    rect(d.x+12,d.y+92,12,70,'#5e4937');rect(d.x+d.w-24,d.y+92,12,70,'#5e4937');
    rect(d.x,d.y,d.w,d.h,'#151a21','#0b0d10',5);
    rect(d.x+10,d.y+10,d.w-20,d.h-20,'#f1eadb');
    drawPixelText('BUILD SOMETHING WEIRD',d.x+d.w/2,d.y+43,11,'#151a21','center');
    drawPixelText('THEN MAKE IT USEFUL',d.x+d.w/2,d.y+67,9,'#8f5f39','center');
  }

  function drawDock(d) {
    rect(d.x,d.y,d.w,d.h,'#8b6b49',palette.ink,4);
    for(let x=d.x+20;x<d.x+d.w;x+=32)rect(x,d.y+5,5,d.h-10,'rgba(255,255,255,.09)');
    for(let x=d.x+22;x<d.x+d.w;x+=86){rect(x,d.y+d.h,10,48,'#66482f');}
  }

  function drawLamp(d,t) {
    rect(d.x-3,d.y,6,36,'#333a41');rect(d.x-9,d.y-10,18,14,'#20262d');
    rect(d.x-5,d.y-7,10,7,night ? (secretCount===3?'#ffd265':'#f3dd9a') : '#c7c2ad');
    if(night){const g=ctx.createRadialGradient(d.x,d.y,2,d.x,d.y,70);g.addColorStop(0,'rgba(255,218,135,.22)');g.addColorStop(1,'rgba(255,218,135,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(d.x,d.y,70,0,Math.PI*2);ctx.fill();}
  }

  function drawPlayerScreen(x=player.x,y=player.y,scale=1) {
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(-13,14,26,7);
    const moving=Math.abs(lastMoveVector.x)+Math.abs(lastMoveVector.y)>.08;
    const bob=moving?(player.step?1:-1):0;ctx.translate(0,bob);
    // shoes/legs
    rectLocal(-9,8,7,13,'#243555');rectLocal(2,8,7,13,'#243555');
    rectLocal(-10,18,8,4,'#171b21');rectLocal(3,18,8,4,'#171b21');
    // hoodie/body
    rectLocal(-11,-8,22,19,'#5c486f');rectLocal(-9,-7,18,6,'#79618d');
    rectLocal(-14,-6,4,14,'#4e3b60');rectLocal(10,-6,4,14,'#4e3b60');
    // head/hair
    rectLocal(-8,-21,16,14,'#e6b78e');rectLocal(-9,-24,18,7,'#42332d');rectLocal(-8,-18,2,5,'#e6b78e');rectLocal(6,-18,2,5,'#e6b78e');
    // glasses depending on direction
    if(player.facing!=='up') { rectLocal(-7,-15,5,3,'#161a20');rectLocal(2,-15,5,3,'#161a20');rectLocal(-2,-14,4,1,'#161a20'); }
    if(player.facing==='left')rectLocal(-9,-13,2,2,'#2a1f1c');
    if(player.facing==='right')rectLocal(7,-13,2,2,'#2a1f1c');
    ctx.restore();
  }

  function drawNPC(n,t) {
    if(n.x<camera.x-50||n.y<camera.y-50||n.x>camera.x+canvas.clientWidth+50||n.y>camera.y+canvas.clientHeight+50)return;
    ctx.save();ctx.translate(Math.round(n.x),Math.round(n.y));
    const bob=Math.sin(t*2+n.baseX)*1.2;ctx.translate(0,bob);
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(-10,12,20,6);
    rectLocal(-7,7,5,11,'#30384b');rectLocal(2,7,5,11,'#30384b');rectLocal(-9,-8,18,17,n.c);rectLocal(-7,-19,14,13,'#d5a47f');rectLocal(-8,-22,16,5,'#3e3029');
    ctx.restore();
    if(Math.hypot(player.x-n.x,player.y-n.y)<110)drawPixelText(n.name.toUpperCase(),n.x,n.y-33,9,'#fff7e8','center');
  }

  function drawCar(c) {
    if(c.x<camera.x-100||c.x>camera.x+canvas.clientWidth+100)return;
    ctx.save();ctx.translate(Math.round(c.x),Math.round(c.y));const flip=c.dir<0?-1:1;ctx.scale(flip,1);
    rectLocal(-34,-13,68,26,c.c);rectLocal(-21,-19,36,9,'#a5c9d1');rectLocal(-25,11,14,7,'#181c23');rectLocal(14,11,14,7,'#181c23');rectLocal(25,-8,8,5,'#f5d786');
    rectLocal(-31,-8,5,6,'#cf4d4d');ctx.restore();
  }

  function drawChip(d,t) {
    if(localStorage.getItem('tjworld-'+d.id))return;
    if(d.x<camera.x-30||d.y<camera.y-30||d.x>camera.x+canvas.clientWidth+30||d.y>camera.y+canvas.clientHeight+30)return;
    const s=10+Math.sin(t*4+d.x)*2;ctx.save();ctx.translate(d.x,d.y);ctx.rotate(t*.7);rectLocal(-s/2,-s/2,s,s,'#f5be3f');rectLocal(-s/4,-s/4,s/2,s/2,'#fff0a9');ctx.restore();
  }

  function drawPixelText(text,x,y,size,color,align='left') {
    ctx.save();ctx.font=`900 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillText(text,x+1,y+2);ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore();
  }

  function drawWorld(time) {
    ctx.save();ctx.translate(-camera.x,-camera.y);
    drawGround();
    for(const d of decorations)if(d.kind==='road')drawRoad(d);
    for(const d of decorations)if(d.kind==='water')drawWater(d,time);
    rect(0,690,WORLD.w,22,palette.path);rect(0,948,WORLD.w,22,palette.path);rect(968,0,22,WORLD.h,palette.path);rect(1262,0,22,WORLD.h,palette.path);
    for(let x=1018;x<1230;x+=34){rect(x,690,20,54,'#ece7da');rect(x,918,20,30,'#ece7da');}

    const trees=[[205,150],[610,120],[1280,120],[1810,110],[2220,160],[125,530],[535,570],[1800,570],[2180,560],[105,1315],[685,1170],[1585,1170],[2210,1320]];
    for(const [x,y] of trees)drawTree(x,y,1.08);
    for(let x=70;x<2400;x+=185)if(x<920||x>1320)drawBush(x,660,.75);

    for(const d of decorations){if(d.kind==='smallBuilding')drawSmallBuilding(d);if(d.kind==='flowers')drawFlowers(d);if(d.kind==='billboard')drawBillboard(d);if(d.kind==='dock')drawDock(d);}
    drawPark(time);
    for(const l of landmarks)drawBuilding(l);
    drawPixelText('PORTFOLIO PLAZA',1125,1022,13,'#243044','center');drawPixelText('RIVER BYTE',1320,1398,12,'#e7efe9','center');
    for(const n of npcs)drawNPC(n,time);for(const c of cars)drawCar(c);for(const d of decorations)if(d.kind==='chip')drawChip(d,time);for(const d of decorations)if(d.kind==='lamp')drawLamp(d,time);
    drawPlayerScreen();ctx.restore();

    if(night){ctx.fillStyle='rgba(13,20,42,.48)';ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);drawScreenStars(time);}
    const g=ctx.createRadialGradient(canvas.clientWidth/2,canvas.clientHeight/2,canvas.clientHeight*.15,canvas.clientWidth/2,canvas.clientHeight/2,canvas.clientWidth*.72);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.24)');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
  }

  function drawScreenStars(t){ctx.save();for(let i=0;i<22;i++){const x=(i*197+43)%Math.max(1,canvas.clientWidth),y=(i*83+19)%Math.max(120,canvas.clientHeight*.48);const a=.18+.2*Math.sin(t*1.5+i);ctx.fillStyle=`rgba(255,255,230,${a})`;ctx.fillRect(x,y,2,2);}ctx.restore();}

  function roomTransform() {
    const vw=canvas.clientWidth,vh=canvas.clientHeight;const s=Math.min(vw/ROOM.w,vh/ROOM.h);return {s,ox:(vw-ROOM.w*s)/2,oy:(vh-ROOM.h*s)/2};
  }
  function withRoomTransform(fn){const tr=roomTransform();ctx.save();ctx.translate(tr.ox,tr.oy);ctx.scale(tr.s,tr.s);fn(tr);ctx.restore();}

  function drawInterior(time) {
    const r=interiors[currentInterior];if(!r)return;
    ctx.fillStyle='#0c1016';ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
    withRoomTransform(()=>{
      rect(0,0,ROOM.w,ROOM.h,r.wall);
      rect(42,42,ROOM.w-84,ROOM.h-76,r.floor,'#15191f',4);
      // floor pattern
      ctx.fillStyle='rgba(255,255,255,.035)';for(let y=50;y<ROOM.h-40;y+=32)for(let x=50;x<ROOM.w-50;x+=64)ctx.fillRect(x,y,30,2);
      // back wall panel + room sign
      rect(290,50,380,43,'#151a21');drawPixelText(r.title,480,79,13,'#f7f0df','center');
      // windows
      rect(690,58,170,55,'#6f9fb2','#15191f',4);rect(705,68,65,35,night?'#243754':'#a8d0d8');rect(780,68,65,35,night?'#243754':'#a8d0d8');
      // door / exit
      rect(420,535,120,65,'#4f4037','#15191f',4);rect(431,546,98,54,'#685548');drawPixelText('EXIT',480,568,10,'#f6d986','center');
      // objects
      for(const o of r.objects)drawRoomObject(o,r,time);
      // rugs/details
      if(currentInterior==='about'){rect(330,330,300,115,'#765c55','#2b2220',3);for(let i=0;i<7;i++)rect(345+i*40,345,20,85,i%2?'#9b7a6c':'#c29a79');}
      if(currentInterior==='projects')drawArcadeFloorGlow(time);
      if(currentInterior==='skills')drawLabDetails();
      if(currentInterior==='observatory')drawObservatoryInterior(time);
      if(currentInterior==='contact')drawStationDetails(time);
      drawPlayerScreen(player.x,player.y,1.15);
    });
    drawRoomVignette();
  }

  function drawRoomObject(o,r,time){
    if(o.id==='pool-table'){drawPoolTableObject(o);return;}
    if(o.id==='scope'){drawTelescope(o,time);return;}
    if(o.id==='server'){rect(o.x,o.y,o.w,o.h,'#1b232c','#11151b',4);for(let y=o.y+15;y<o.y+o.h-12;y+=24){rect(o.x+12,y,o.w-24,14,'#303c48');rect(o.x+22,y+4,5,5,(y/24|0)%2?'#71cf89':'#e4b34e');}return;}
    if(o.id.startsWith('cab')){rect(o.x,o.y,o.w,o.h,'#252d3d','#12161e',4);rect(o.x+12,o.y+16,o.w-24,54,'#4f6d89','#11151b',3);rect(o.x+25,o.y+84,40,14,'#d2679f');rect(o.x+35,o.y+112,20,20,'#f0b43b','#11151b',3);return;}
    if(o.id==='cue-rack'){rect(o.x,o.y,o.w,o.h,'#5e402c','#15191f',4);for(let x=o.x+16;x<o.x+o.w-8;x+=15){ctx.strokeStyle=['#b58b5c','#cf9b57','#8f6545'][x%3];ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,o.y+15);ctx.lineTo(x-8,o.y+o.h-15);ctx.stroke();}return;}
    rect(o.x,o.y,o.w,o.h,r.accent,'#15191f',4);
    rect(o.x+9,o.y+9,o.w-18,Math.min(32,o.h-18),'rgba(255,255,255,.14)');
    drawPixelText(o.label,o.x+o.w/2,o.y+o.h/2+4,Math.min(10,Math.max(7,145/o.label.length)),'#fff5df','center');
  }

  function drawPoolTableObject(o){rect(o.x,o.y,o.w,o.h,'#543a29','#161a1e',6);rect(o.x+22,o.y+22,o.w-44,o.h-44,'#2d704e','#11151b',5);for(const [px,py] of [[o.x+28,o.y+28],[o.x+o.w/2,o.y+24],[o.x+o.w-28,o.y+28],[o.x+28,o.y+o.h-28],[o.x+o.w/2,o.y+o.h-24],[o.x+o.w-28,o.y+o.h-28]]){ctx.fillStyle='#101316';ctx.beginPath();ctx.arc(px,py,11,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#f5eee0';ctx.beginPath();ctx.arc(o.x+150,o.y+116,9,0,Math.PI*2);ctx.fill();for(let i=0;i<5;i++){ctx.fillStyle=['#e9b83e','#4d79b7','#b74944','#673f8d','#d06b35'][i];ctx.beginPath();ctx.arc(o.x+315+(i%3)*18,o.y+105+(i/3|0)*18,8,0,Math.PI*2);ctx.fill();}}
  function drawTelescope(o,t){rect(o.x+90,o.y+70,15,75,'#3c4654');ctx.save();ctx.translate(o.x+110,o.y+55);ctx.rotate(-.5+Math.sin(t*.4)*.04);rectLocal(-80,-18,150,36,'#d7d8dc');rectLocal(-92,-22,20,44,'#675f88');rectLocal(58,-12,30,24,'#28313e');ctx.restore();rect(o.x+75,o.y+135,80,10,'#2d3743');}
  function drawArcadeFloorGlow(t){for(let x=70;x<ROOM.w-70;x+=80){ctx.fillStyle=`rgba(233,89,170,${.035+.02*Math.sin(t*2+x)})`;ctx.fillRect(x,300,45,180);}rect(260,390,440,20,'#f2b63c');}
  function drawLabDetails(){rect(65,355,830,80,'#b7b8a9','#15191f',4);for(let x=92;x<865;x+=110){rect(x,370,80,35,'#6f7a6a','#15191f',3);rect(x+12,380,20,8,'#9bd1cf');rect(x+42,380,24,8,'#d8b84f');}}
  function drawObservatoryInterior(t){ctx.strokeStyle='rgba(130,176,209,.22)';ctx.lineWidth=2;for(let r=60;r<260;r+=40){ctx.beginPath();ctx.arc(480,360,r,0,Math.PI*2);ctx.stroke();}for(let i=0;i<30;i++){ctx.fillStyle=`rgba(255,255,230,${.3+.2*Math.sin(t+i)})`;ctx.fillRect(80+(i*137)%800,300+(i*73)%190,2,2);}}
  function drawStationDetails(t){rect(95,330,770,75,'#6c5745','#15191f',4);for(let x=120;x<840;x+=120){rect(x,348,90,40,'#d7c9ae','#15191f',3);drawPixelText(((x/120|0)%2?'GITHUB':'BUILD')+' →',x+45,374,8,'#3b332c','center');}const blink=Math.sin(t*4)>.2?'#f3b63b':'#765a34';rect(800,90,20,20,blink,'#15191f',3);}

  function drawRoomVignette(){const g=ctx.createRadialGradient(canvas.clientWidth/2,canvas.clientHeight/2,canvas.clientHeight*.12,canvas.clientWidth/2,canvas.clientHeight/2,canvas.clientWidth*.72);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.36)');ctx.fillStyle=g;ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);}

  function updateInteraction() {
    nearInteractable=null;
    let best=94;
    if(mode==='world'){
      for(const l of landmarks){const px=Math.max(l.x,Math.min(player.x,l.x+l.w));const py=Math.max(l.y,Math.min(player.y,l.y+l.h));const d=Math.hypot(player.x-px,player.y-py);if(d<best){best=d;nearInteractable={type:'landmark',data:l};}}
      for(const n of npcs){const d=Math.hypot(player.x-n.x,player.y-n.y);if(d<70&&d<best){best=d;nearInteractable={type:'npc',data:n};}}
    } else if(mode==='interior') {
      if(player.y>500 && Math.abs(player.x-480)<95){nearInteractable={type:'exit',data:null};best=45;}
      const r=interiors[currentInterior];
      for(const o of r.objects){const px=Math.max(o.x,Math.min(player.x,o.x+o.w));const py=Math.max(o.y,Math.min(player.y,o.y+o.h));const d=Math.hypot(player.x-px,player.y-py);if(d<82&&d<best){best=d;nearInteractable={type:'roomObject',data:o};}}
    }
    if(nearInteractable){interaction.classList.remove('hidden');
      if(nearInteractable.type==='npc')interactionText.textContent=`TALK TO ${nearInteractable.data.name.toUpperCase()}`;
      else if(nearInteractable.type==='landmark')interactionText.textContent=`ENTER ${nearInteractable.data.label}`;
      else if(nearInteractable.type==='exit')interactionText.textContent='EXIT TO CITY';
      else interactionText.textContent=nearInteractable.data.label;
    } else interaction.classList.add('hidden');
  }

  function interact() {
    if(pausedForModal){closeModal();return;}
    if(mode==='pool'){shootPool();return;}
    if(!nearInteractable)return;
    if(nearInteractable.type==='npc'){showToast(`${nearInteractable.data.name}: ${nearInteractable.data.text}`,4300);return;}
    if(nearInteractable.type==='landmark'){enterInterior(nearInteractable.data.id);return;}
    if(nearInteractable.type==='exit'){exitInterior();return;}
    if(nearInteractable.type==='roomObject'){
      const o=nearInteractable.data;
      if(o.action==='modal')openModal(o.key);
      if(o.action==='toast')showToast(o.text,3900);
      if(o.action==='pool')startPool();
    }
  }

  function openModal(key){const data=portfolio[key];if(!data)return;pausedForModal=true;modalEyebrow.textContent=data.eyebrow;modalTitle.textContent=data.title;modalBody.innerHTML=data.html;modal.classList.remove('hidden');modalBackdrop.classList.remove('hidden');}
  function closeModal(){pausedForModal=false;modal.classList.add('hidden');modalBackdrop.classList.add('hidden');}
  modalClose.addEventListener('click',closeModal);modalBackdrop.addEventListener('click',closeModal);

  function showToast(msg,duration=2200){toast.textContent=msg;toast.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),duration);}
  function updateQuest(){const count=[...visited].filter(id=>landmarks.some(l=>l.id===id)).length;questMeta.textContent=`${count} / ${TOTAL_LANDMARKS} landmarks · ${secretCount}/3 chips`;questText.textContent=count>=TOTAL_LANDMARKS?'District explored':'Explore the district';}
  updateQuest();

  function drawMinimap(){
    if(!mini.offsetParent||mode!=='world')return;
    mctx.clearRect(0,0,mini.width,mini.height);mctx.fillStyle='#50764b';mctx.fillRect(0,0,mini.width,mini.height);
    const sx=mini.width/WORLD.w,sy=mini.height/WORLD.h;
    mctx.fillStyle='#3f4652';mctx.fillRect(0,720*sy,mini.width,220*sy);mctx.fillRect(1000*sx,0,250*sx,mini.height);
    mctx.fillStyle='#4f95a3';mctx.fillRect(0,1340*sy,mini.width,480*sy);
    for(const l of landmarks){mctx.fillStyle=l.visited?'#f3b73f':l.color;mctx.fillRect(l.x*sx,l.y*sy,Math.max(4,l.w*sx),Math.max(4,l.h*sy));}
    mctx.fillStyle='#fff';mctx.fillRect(player.x*sx-2,player.y*sy-2,5,5);mctx.strokeStyle='#14181e';mctx.strokeRect(player.x*sx-3,player.y*sy-3,7,7);
  }

  // --- Pool mini-game -------------------------------------------------------
  function startPool(){
    transition(()=>{mode='pool';pool.active=true;resetPool();interaction.classList.add('hidden');if(locationChip)locationChip.textContent='BILLIARDS HALL · TABLE 1';showToast('MOUSE TO AIM · CLICK TO SHOOT · ESC TO LEAVE',3000);});
  }
  function exitPool(){mode='interior';pool.active=false;if(locationChip)locationChip.textContent='BILLIARDS HALL';}
  function resetPool(){
    pool.balls=[
      {cue:true,x:290,y:295,vx:0,vy:0,r:13,c:'#f4efe6',pocketed:false},
      {x:635,y:295,vx:0,vy:0,r:13,c:'#e5b93f',pocketed:false},
      {x:662,y:279,vx:0,vy:0,r:13,c:'#4c75b7',pocketed:false},
      {x:662,y:311,vx:0,vy:0,r:13,c:'#b94b43',pocketed:false},
      {x:689,y:263,vx:0,vy:0,r:13,c:'#653f91',pocketed:false},
      {x:689,y:295,vx:0,vy:0,r:13,c:'#d97535',pocketed:false},
      {x:689,y:327,vx:0,vy:0,r:13,c:'#36865d',pocketed:false}
    ];pool.score=0;pool.shots=0;pool.aim=0;pool.power=.62;
  }
  function poolMoving(){return pool.balls.some(b=>!b.pocketed&&Math.hypot(b.vx,b.vy)>3);}
  function shootPool(){
    if(mode!=='pool'||poolMoving())return;const cue=pool.balls.find(b=>b.cue&&!b.pocketed);if(!cue)return;
    const speed=720*pool.power;cue.vx=Math.cos(pool.aim)*speed;cue.vy=Math.sin(pool.aim)*speed;pool.shots++;
  }
  function updatePool(dt){
    const t=pool.table;const pockets=[[t.x,t.y],[t.x+t.w/2,t.y],[t.x+t.w,t.y],[t.x,t.y+t.h],[t.x+t.w/2,t.y+t.h],[t.x+t.w,t.y+t.h]];
    const balls=pool.balls;
    for(const b of balls){if(b.pocketed)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=Math.pow(.992,dt*60);b.vy*=Math.pow(.992,dt*60);if(Math.hypot(b.vx,b.vy)<3)b.vx=b.vy=0;
      if(b.x-b.r<t.x+22){b.x=t.x+22+b.r;b.vx=Math.abs(b.vx)*.9;}if(b.x+b.r>t.x+t.w-22){b.x=t.x+t.w-22-b.r;b.vx=-Math.abs(b.vx)*.9;}if(b.y-b.r<t.y+22){b.y=t.y+22+b.r;b.vy=Math.abs(b.vy)*.9;}if(b.y+b.r>t.y+t.h-22){b.y=t.y+t.h-22-b.r;b.vy=-Math.abs(b.vy)*.9;}
      for(const [px,py] of pockets)if(Math.hypot(b.x-px,b.y-py)<24){b.pocketed=true;b.vx=b.vy=0;if(b.cue)setTimeout(()=>{b.pocketed=false;b.x=290;b.y=295;b.vx=b.vy=0;},500);else{pool.score++;showToast(`BALL DOWN · ${pool.score}/6`,1000);}break;}
    }
    for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){const a=balls[i],b=balls[j];if(a.pocketed||b.pocketed)continue;const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),min=a.r+b.r;if(dist>0&&dist<min){const nx=dx/dist,ny=dy/dist,overlap=min-dist;a.x-=nx*overlap/2;a.y-=ny*overlap/2;b.x+=nx*overlap/2;b.y+=ny*overlap/2;const rvx=b.vx-a.vx,rvy=b.vy-a.vy,vel=rvx*nx+rvy*ny;if(vel<0){const imp=-vel*.96;a.vx-=imp*nx;a.vy-=imp*ny;b.vx+=imp*nx;b.vy+=imp*ny;}}}
    if(!poolMoving()&&pool.score>=6){showToast(`TABLE CLEARED IN ${pool.shots} SHOTS · NICE`,3000);}
    updateFade(dt);
  }

  function poolTransform(){const vw=canvas.clientWidth,vh=canvas.clientHeight;const s=Math.min(vw/960,vh/600);return{s,ox:(vw-960*s)/2,oy:(vh-600*s)/2};}
  function drawPool(){
    ctx.fillStyle='#10151c';ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);const tr=poolTransform();ctx.save();ctx.translate(tr.ox,tr.oy);ctx.scale(tr.s,tr.s);
    rect(0,0,960,600,'#151b22');drawPixelText('BILLIARDS HALL · TABLE 1',480,48,14,'#f4ead4','center');
    const t=pool.table;rect(t.x-24,t.y-24,t.w+48,t.h+48,'#5d3b27','#090c10',6);rect(t.x,t.y,t.w,t.h,'#2c6d4c','#0b0e12',5);
    for(const [px,py] of [[t.x,t.y],[t.x+t.w/2,t.y],[t.x+t.w,t.y],[t.x,t.y+t.h],[t.x+t.w/2,t.y+t.h],[t.x+t.w,t.y+t.h]]){ctx.fillStyle='#090c10';ctx.beginPath();ctx.arc(px,py,21,0,Math.PI*2);ctx.fill();}
    for(const b of pool.balls){if(b.pocketed)continue;ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.arc(b.x+3,b.y+5,b.r,0,Math.PI*2);ctx.fill();ctx.fillStyle=b.c;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#101318';ctx.lineWidth=2;ctx.stroke();if(!b.cue){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.x-4,b.y-5,3,0,Math.PI*2);ctx.fill();}}
    if(!poolMoving()){const cue=pool.balls.find(b=>b.cue&&!b.pocketed);if(cue){ctx.setLineDash([8,8]);ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cue.x,cue.y);ctx.lineTo(cue.x+Math.cos(pool.aim)*190,cue.y+Math.sin(pool.aim)*190);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#b98a58';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(cue.x-Math.cos(pool.aim)*35,cue.y-Math.sin(pool.aim)*35);ctx.lineTo(cue.x-Math.cos(pool.aim)*(185+pool.power*80),cue.y-Math.sin(pool.aim)*(185+pool.power*80));ctx.stroke();}}
    rect(110,535,250,18,'#2b3139','#0a0d11',3);rect(113,538,244*pool.power,12,'#f0b63d');drawPixelText(`POWER ${Math.round(pool.power*100)}%`,235,530,10,'#f3ead6','center');drawPixelText(`POCKETED ${pool.score}/6 · SHOTS ${pool.shots}`,820,550,10,'#f3ead6','right');drawPixelText('ESC: EXIT',820,574,9,'#8893a2','right');ctx.restore();
  }

  function frame(now){
    const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
    if(mode==='world')drawWorld(now/1000);else if(mode==='interior')drawInterior(now/1000);else drawPool();
    drawMinimap();
    if(fade>0){ctx.fillStyle=`rgba(7,10,14,${Math.min(1,fade)})`;ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);}
    requestAnimationFrame(frame);
  }

  window.addEventListener('keydown',e=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    keys.add(e.code);
    if(mode==='pool'&&!pausedForModal){
      if(e.code==='ArrowLeft')pool.aim-=.08;if(e.code==='ArrowRight')pool.aim+=.08;if(e.code==='ArrowUp')pool.power=Math.min(1,pool.power+.05);if(e.code==='ArrowDown')pool.power=Math.max(.15,pool.power-.05);
      if(e.code==='Space'&&!e.repeat)shootPool();if(e.code==='Escape'){exitPool();return;}
    } else {
      if((e.code==='KeyE'||e.code==='Space')&&!e.repeat)interact();
      if(e.code==='Escape'&&pausedForModal)closeModal();
      else if(e.code==='Escape'&&mode==='interior')exitInterior();
      if(e.code==='KeyN'&&!e.repeat&&mode==='world'){night=!night;localStorage.setItem('tjworld-night',night?'1':'0');showToast(night?'NIGHT MODE · LIGHTS ON':'DAY MODE · LIGHTS OFF',1600);}
    }
  },{passive:false});
  window.addEventListener('keyup',e=>keys.delete(e.code));

  canvas.addEventListener('pointermove',e=>{if(mode!=='pool'||poolMoving())return;const tr=poolTransform();const x=(e.clientX-canvas.getBoundingClientRect().left-tr.ox)/tr.s,y=(e.clientY-canvas.getBoundingClientRect().top-tr.oy)/tr.s;const cue=pool.balls.find(b=>b.cue&&!b.pocketed);if(cue)pool.aim=Math.atan2(y-cue.y,x-cue.x);});
  canvas.addEventListener('pointerdown',e=>{if(mode==='pool'&&!poolMoving()){e.preventDefault();shootPool();}});

  document.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.jump;const l=landmarks.find(x=>x.id===id);if(!l)return;
    mode='world';currentInterior=null;player.x=l.x+l.w/2;player.y=l.y>900?l.y-70:l.y+l.h+70;openModal(id);l.visited=true;visited.add(id);localStorage.setItem('tjworld-visited',JSON.stringify([...visited]));updateQuest();if(locationChip)locationChip.textContent='PORTFOLIO DISTRICT';
  }));

  // Touch joystick
  const stick=$('stickBase'),knob=$('stickKnob');
  const touchVector={x:0,y:0};let stickPointer=null;
  function setStick(clientX,clientY){const r=stick.getBoundingClientRect();let dx=clientX-(r.left+r.width/2),dy=clientY-(r.top+r.height/2);const max=34,len=Math.hypot(dx,dy)||1,mag=Math.min(max,len);dx=dx/len*mag;dy=dy/len*mag;knob.style.transform=`translate(${dx}px,${dy}px)`;touchVector.x=dx/max;touchVector.y=dy/max;}
  stick.addEventListener('pointerdown',e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);setStick(e.clientX,e.clientY);});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)setStick(e.clientX,e.clientY);});
  function clearStick(e){if(stickPointer===null||e.pointerId===stickPointer){stickPointer=null;touchVector.x=touchVector.y=0;knob.style.transform='translate(0,0)';}}
  stick.addEventListener('pointerup',clearStick);stick.addEventListener('pointercancel',clearStick);mobileInteract.addEventListener('click',interact);

  const bootSteps=[
    ['Redrawing the district...',16],['Adding actual interiors...',34],['Letting NPCs wander...',51],['Chalking the pool table...',68],['Wiring the streetlights...',83],['Hiding three gold chips...',94],['V2 ready.',100]
  ];
  let bi=0;
  function bootNext(){const [text,pct]=bootSteps[bi++];bootText.textContent=text;bootBar.style.width=pct+'%';if(bi<bootSteps.length)setTimeout(bootNext,250+Math.random()*180);else setTimeout(()=>startBtn.classList.remove('hidden'),220);}
  setTimeout(bootNext,220);
  startBtn.addEventListener('click',()=>{running=true;boot.style.transition='opacity .35s';boot.style.opacity='0';setTimeout(()=>boot.remove(),360);showToast('WASD / ARROWS · E TO INTERACT · N FOR NIGHT',3400);if(locationChip)locationChip.textContent='PORTFOLIO DISTRICT';});

  requestAnimationFrame(frame);
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();

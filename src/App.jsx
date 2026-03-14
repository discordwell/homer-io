import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
//  DESIGN TOKENS
// ─────────────────────────────────────────────
const C = {
  bg:       "#03080F",
  surface:  "#070F1C",
  card:     "#0B1525",
  cardHi:   "#0F1C30",
  border:   "#132035",
  borderHi: "#1E3355",
  accent:   "#5BA4F5",
  accentDim:"#3A7FD4",
  accentGlow:"rgba(91,164,245,0.18)",
  silver:   "#C8D8F0",
  white:    "#EEF3FC",
  dimText:  "#6888AA",
  mutedText:"#2A3F5C",
  green:    "#34D399",
  yellow:   "#FBBF24",
  red:      "#F87171",
  orange:   "#FB923C",
  purple:   "#A78BFA",
};

const F = {
  display: "'Syne', sans-serif",
  body:    "'Inter', sans-serif",
  mono:    "'JetBrains Mono', monospace",
};

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${C.surface}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ─────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────
const ROUTES = [
  {
    id:"RT-001", area:"Redwood City", driver:"Marcus T.", stops:84, packages:127,
    eta:"2:45 PM", efficiency:91, status:"active", color:C.accent,
    driverPos:[37.4852,-122.2364],
    waypoints:[[37.4852,-122.2364],[37.4901,-122.2289],[37.4955,-122.2198],[37.5012,-122.2101]],
    stopsList:[
      {num:34,address:"815 Marshall St, Redwood City",lat:37.4852,lng:-122.2364,packages:2,done:true},
      {num:35,address:"1290 Broadway, Redwood City",lat:37.4871,lng:-122.2301,packages:1,done:true},
      {num:36,address:"450 Arguello St, Redwood City",lat:37.4901,lng:-122.2289,packages:3,done:false,current:true},
      {num:37,address:"2020 Kentfield Ave, Redwood City",lat:37.4955,lng:-122.2198,packages:1,done:false},
      {num:38,address:"600 Allerton St, Redwood City",lat:37.5012,lng:-122.2101,packages:2,done:false},
    ]
  },
  {
    id:"RT-002", area:"San Mateo", driver:"Priya S.", stops:62, packages:98,
    eta:"1:30 PM", efficiency:88, status:"active", color:C.green,
    driverPos:[37.5630,-122.3255],
    waypoints:[[37.5630,-122.3255],[37.5589,-122.3198],[37.5548,-122.3141],[37.5507,-122.3084]],
    stopsList:[
      {num:15,address:"330 N Ellsworth Ave, San Mateo",lat:37.5630,lng:-122.3255,packages:4,done:false,current:true},
      {num:16,address:"1 Baldwin Ave, San Mateo",lat:37.5589,lng:-122.3198,packages:1,done:false},
      {num:17,address:"55 37th Ave, San Mateo",lat:37.5548,lng:-122.3141,packages:2,done:false},
    ]
  },
  {
    id:"RT-003", area:"Daly City / S. SF", driver:"James K.", stops:75, packages:110,
    eta:"3:10 PM", efficiency:76, status:"delayed", color:C.red,
    driverPos:[37.6879,-122.4702],
    waypoints:[[37.6879,-122.4702],[37.6798,-122.4614],[37.6720,-122.4528],[37.6641,-122.4441]],
    stopsList:[
      {num:42,address:"350 Gellert Blvd, Daly City",lat:37.6879,lng:-122.4702,packages:2,done:false,current:true},
      {num:43,address:"200 Oyster Point Blvd, S San Francisco",lat:37.6641,lng:-122.4441,packages:3,done:false},
    ]
  },
  {
    id:"RT-004", area:"Burlingame / Millbrae", driver:"Sofia R.", stops:55, packages:83,
    eta:"12:50 PM", efficiency:95, status:"completed", color:C.mutedText,
    driverPos:[37.5841,-122.3660],
    waypoints:[[37.5841,-122.3660],[37.5900,-122.3720],[37.5960,-122.3780],[37.6020,-122.3840]],
    stopsList:[]
  },
];

const ALT_ROUTE = [[37.6879,-122.4702],[37.6820,-122.4580],[37.6740,-122.4490],[37.6641,-122.4441]];

const ALERTS = [
  {id:1,type:"reroute",priority:"high",route:"RT-003",message:"Traffic on El Camino Real near Daly City. AI suggests Junipero Serra Blvd — saves ~19 min.",time:"2m ago",accepted:null},
  {id:2,type:"efficiency",priority:"medium",route:"RT-001",message:"Stop cluster near Arguello St, Redwood City. Reorder stops 34–38 to save 9 min.",time:"11m ago",accepted:null},
  {id:3,type:"forecast",priority:"low",route:"All Routes",message:"Tomorrow's volume forecast: +14% above avg. Consider pre-staging 3 additional drivers.",time:"1h ago",accepted:true},
];

const DRIVER_STATS = [
  {name:"Sofia R.",stops:55,packages:83,efficiency:95,avgStop:"3.1m",onTime:"99%",trend:"up"},
  {name:"Marcus T.",stops:84,packages:127,efficiency:91,avgStop:"3.8m",onTime:"96%",trend:"up"},
  {name:"Priya S.",stops:62,packages:98,efficiency:88,avgStop:"4.2m",onTime:"94%",trend:"stable"},
  {name:"James K.",stops:75,packages:110,efficiency:76,avgStop:"5.6m",onTime:"81%",trend:"down"},
];

const WEEKLY = [
  {day:"Mon",v:276},{day:"Tue",v:291},{day:"Wed",v:268},
  {day:"Thu",v:312},{day:"Fri",v:340},{day:"Sat",v:195},{day:"Sun",v:112},
];

const DRIVERS = ["Unassigned","Marcus T.","Priya S.","James K.","Sofia R."];

const INTEGRATIONS = [
  {name:"ORION (UPS)",status:"connected",icon:"📦"},
  {name:"Amazon Relay",status:"connected",icon:"🔶"},
  {name:"FedEx Ground",status:"available",icon:"🟣"},
  {name:"OnTrac",status:"available",icon:"🔵"},
  {name:"GSO",status:"available",icon:"🟢"},
];

// ─────────────────────────────────────────────
//  SMC ADDRESS DATABASE
// ─────────────────────────────────────────────
const ADDRESSES = [
  {s:"815 Marshall St, Redwood City",lat:37.4852,lng:-122.2364},
  {s:"1290 Broadway, Redwood City",lat:37.4871,lng:-122.2301},
  {s:"450 Arguello St, Redwood City",lat:37.4901,lng:-122.2289},
  {s:"2020 Kentfield Ave, Redwood City",lat:37.4955,lng:-122.2198},
  {s:"600 Allerton St, Redwood City",lat:37.5012,lng:-122.2101},
  {s:"1000 Main St, Redwood City",lat:37.4848,lng:-122.2360},
  {s:"303 Twin Dolphin Dr, Redwood City",lat:37.5305,lng:-122.2548},
  {s:"1700 El Camino Real, Redwood City",lat:37.4880,lng:-122.2270},
  {s:"330 N Ellsworth Ave, San Mateo",lat:37.5630,lng:-122.3255},
  {s:"1 Baldwin Ave, San Mateo",lat:37.5589,lng:-122.3198},
  {s:"55 37th Ave, San Mateo",lat:37.5548,lng:-122.3141},
  {s:"2000 S Delaware St, San Mateo",lat:37.5450,lng:-122.3000},
  {s:"100 E 3rd Ave, San Mateo",lat:37.5622,lng:-122.3268},
  {s:"777 Mariners Island Blvd, San Mateo",lat:37.5570,lng:-122.2780},
  {s:"400 S El Camino Real, San Mateo",lat:37.5609,lng:-122.3225},
  {s:"1600 Palm Ave, San Mateo",lat:37.5630,lng:-122.3150},
  {s:"1100 Park Place, Foster City",lat:37.5560,lng:-122.2680},
  {s:"3 Marine Pkwy, Foster City",lat:37.5588,lng:-122.2716},
  {s:"1 Anza Blvd, Burlingame",lat:37.5800,lng:-122.3470},
  {s:"260 El Camino Real, Burlingame",lat:37.5760,lng:-122.3460},
  {s:"800 Airport Blvd, Burlingame",lat:37.5970,lng:-122.3560},
  {s:"555 Airport Blvd, Burlingame",lat:37.5969,lng:-122.3548},
  {s:"100 El Camino Real, Millbrae",lat:37.5999,lng:-122.3869},
  {s:"400 Broadway, Millbrae",lat:37.6001,lng:-122.3874},
  {s:"200 Oyster Point Blvd, S San Francisco",lat:37.6641,lng:-122.4441},
  {s:"1000 Dubuque Ave, S San Francisco",lat:37.6592,lng:-122.4044},
  {s:"460 N Canal St, S San Francisco",lat:37.6611,lng:-122.4059},
  {s:"750 Gateway Blvd, S San Francisco",lat:37.6620,lng:-122.3929},
  {s:"350 Gellert Blvd, Daly City",lat:37.6879,lng:-122.4702},
  {s:"6600 Mission St, Daly City",lat:37.6878,lng:-122.4695},
  {s:"2600 Junipero Serra Blvd, Daly City",lat:37.6940,lng:-122.4740},
  {s:"100 S Cabrillo Hwy, Half Moon Bay",lat:37.4636,lng:-122.4286},
  {s:"1601 El Camino Real, Menlo Park",lat:37.4530,lng:-122.1817},
  {s:"1 Facebook Way, Menlo Park",lat:37.4848,lng:-122.1488},
  {s:"900 Old County Rd, Belmont",lat:37.5196,lng:-122.2743},
  {s:"666 Elm St, San Carlos",lat:37.5076,lng:-122.2612},
  {s:"540 Crespi Dr, Pacifica",lat:37.6141,lng:-122.4869},
  {s:"50 Park Pl, Brisbane",lat:37.6810,lng:-122.4010},
  {s:"San Francisco International Airport (SFO)",lat:37.6213,lng:-122.3790},
  {s:"Caltrain Station, San Mateo",lat:37.5672,lng:-122.3234},
  {s:"Caltrain Station, Redwood City",lat:37.4854,lng:-122.2318},
  {s:"Caltrain Station, Millbrae",lat:37.5994,lng:-122.3868},
  {s:"Hillsdale Mall, San Mateo",lat:37.5298,lng:-122.2990},
  {s:"Serramonte Center, Daly City",lat:37.6743,lng:-122.4703},
  {s:"Stanford Shopping Center, Palo Alto",lat:37.4436,lng:-122.1698},
  {s:"3000 Sand Hill Rd, Menlo Park",lat:37.4190,lng:-122.2010},
];

function searchAddresses(q) {
  if (!q || q.length < 2) return [];
  const l = q.toLowerCase();
  return ADDRESSES.filter(a => a.s.toLowerCase().includes(l)).slice(0, 7);
}

function nearestAddress(lat, lng) {
  let best = null, d = Infinity;
  ADDRESSES.forEach(a => {
    const dist = Math.hypot(a.lat - lat, a.lng - lng);
    if (dist < d) { d = dist; best = a; }
  });
  return best && d < 0.06 ? best.s : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// ─────────────────────────────────────────────
//  LEAFLET LOADER
// ─────────────────────────────────────────────
let leafletReady = false;
let leafletQueue = [];
function loadLeaflet(cb) {
  if (window.L) return cb();
  leafletQueue.push(cb);
  if (leafletReady) return;
  leafletReady = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
  document.head.appendChild(link);
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
  script.onload = () => { leafletQueue.forEach(f => f()); leafletQueue = []; };
  document.head.appendChild(script);
}

function divIcon(html, size = [32, 32]) {
  return window.L.divIcon({ className: "", html, iconSize: size, iconAnchor: [size[0]/2, size[1]/2] });
}

// ─────────────────────────────────────────────
//  CANVAS MAP (Route Builder — works in sandbox)
// ─────────────────────────────────────────────
const BOUNDS = { minLat:37.38, maxLat:37.75, minLng:-122.55, maxLng:-122.10 };
const ROADS = [
  {pts:[[37.42,-122.20],[37.48,-122.23],[37.54,-122.27],[37.58,-122.31],[37.62,-122.36],[37.67,-122.47]],w:3,c:"#102040"},
  {pts:[[37.42,-122.15],[37.48,-122.18],[37.54,-122.25],[37.60,-122.30],[37.65,-122.38],[37.69,-122.43]],w:3,c:"#0E1E3A"},
  {pts:[[37.42,-122.22],[37.48,-122.28],[37.54,-122.34],[37.60,-122.42],[37.67,-122.49]],w:2,c:"#0B1830"},
  {pts:[[37.56,-122.18],[37.56,-122.32],[37.55,-122.46]],w:2,c:"#0B1830"},
  {pts:[[37.42,-122.32],[37.50,-122.39],[37.58,-122.44],[37.66,-122.50]],w:1.5,c:"#091525"},
];
const CITIES = [
  {n:"Redwood City",lat:37.4852,lng:-122.2364},{n:"San Mateo",lat:37.5630,lng:-122.3255},
  {n:"Burlingame",lat:37.5841,lng:-122.3660},{n:"S. San Francisco",lat:37.6547,lng:-122.4077},
  {n:"Daly City",lat:37.6879,lng:-122.4702},{n:"Half Moon Bay",lat:37.4636,lng:-122.4286},
  {n:"Foster City",lat:37.5585,lng:-122.2711},{n:"Menlo Park",lat:37.4530,lng:-122.1817},
];

function toXY(lat, lng, w, h) {
  return [
    ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * w,
    h - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * h,
  ];
}
function toLatLng(x, y, w, h) {
  return [
    ((h - y) / h) * (BOUNDS.maxLat - BOUNDS.minLat) + BOUNDS.minLat,
    (x / w) * (BOUNDS.maxLng - BOUNDS.minLng) + BOUNDS.minLng,
  ];
}

function CanvasMap({ stops, onAdd, onMove, onRemove }) {
  const cvs = useRef(null);
  const box = useRef(null);
  const [sz, setSz] = useState({ w: 600, h: 480 });
  const dragIdx = useRef(null);
  const [tip, setTip] = useState(null);
  const R = 14;

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setSz({ w: width, h: height });
    });
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const { w, h } = sz;
    ctx.clearRect(0, 0, w, h);

    // bg
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#040C1A"); bg.addColorStop(1, "#070F1C");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // subtle grid
    ctx.strokeStyle = "#0A1628"; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for (let y = 0; y < h; y += 50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

    // roads
    ROADS.forEach(r => {
      ctx.beginPath(); ctx.strokeStyle = r.c; ctx.lineWidth = r.w;
      r.pts.forEach(([lat,lng],i) => { const [x,y]=toXY(lat,lng,w,h); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
      ctx.stroke();
    });

    // bay
    ctx.beginPath(); ctx.fillStyle = "#050E1C";
    [[37.70,-122.18],[37.68,-122.14],[37.60,-122.15],[37.52,-122.20],[37.48,-122.20],[37.70,-122.18]]
      .forEach(([la,ln],i) => { const [x,y]=toXY(la,ln,w,h); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
    ctx.closePath(); ctx.fill();

    // city dots + labels
    CITIES.forEach(city => {
      const [x,y] = toXY(city.lat, city.lng, w, h);
      ctx.fillStyle = "#1A3060"; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = "#1E3A6A"; ctx.font = "500 10px Inter, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(city.n, x, y - 8);
    });

    // route line
    if (stops.length >= 2) {
      ctx.beginPath(); ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      stops.forEach((s,i) => { const [x,y]=toXY(s.lat,s.lng,w,h); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
      ctx.stroke();
      // arrowheads
      stops.forEach((s,i) => {
        if (i >= stops.length-1) return;
        const n = stops[i+1];
        const [x1,y1]=toXY(s.lat,s.lng,w,h), [x2,y2]=toXY(n.lat,n.lng,w,h);
        const mx=(x1+x2)/2, my=(y1+y2)/2;
        const ang = Math.atan2(y2-y1,x2-x1);
        ctx.save(); ctx.translate(mx,my); ctx.rotate(ang);
        ctx.fillStyle = C.accent; ctx.beginPath();
        ctx.moveTo(7,0); ctx.lineTo(-4,-4); ctx.lineTo(-4,4);
        ctx.closePath(); ctx.fill(); ctx.restore();
      });
    }

    // stop markers
    stops.forEach((s, idx) => {
      const [x,y] = toXY(s.lat, s.lng, w, h);
      const glow = ctx.createRadialGradient(x,y,0,x,y,R+10);
      glow.addColorStop(0, C.accentGlow); glow.addColorStop(1,"transparent");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x,y,R+10,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x,y,R,0,Math.PI*2);
      ctx.fillStyle = C.accent; ctx.fill();
      ctx.strokeStyle = C.bg; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = C.bg; ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(idx+1, x, y); ctx.textBaseline = "alphabetic";
    });

    // water labels
    ctx.font = "600 11px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#0D2040";
    const [bx,by]=toXY(37.57,-122.16,w,h); ctx.fillText("SAN FRANCISCO BAY", bx, by);
    const [px,py]=toXY(37.54,-122.51,w,h); ctx.fillStyle="#081525"; ctx.fillText("PACIFIC OCEAN", px, py);
  }, [stops, sz]);

  const hitStop = (mx, my) => stops.findIndex(s => {
    const [x,y] = toXY(s.lat, s.lng, sz.w, sz.h);
    return Math.hypot(mx-x, my-y) <= R+4;
  });

  const onMouseDown = e => {
    const r = cvs.current.getBoundingClientRect();
    const hit = hitStop(e.clientX-r.left, e.clientY-r.top);
    if (hit >= 0) dragIdx.current = hit;
  };
  const onMouseMove = e => {
    const r = cvs.current.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    if (dragIdx.current !== null) {
      const [lat,lng] = toLatLng(mx, my, sz.w, sz.h);
      onMove(dragIdx.current, lat, lng);
    } else {
      const hit = hitStop(mx, my);
      setTip(hit >= 0 ? { x:mx, y:my, stop:stops[hit], idx:hit } : null);
      cvs.current.style.cursor = hit >= 0 ? "grab" : "crosshair";
    }
  };
  const onMouseUp = () => { dragIdx.current = null; };
  const onClick = e => {
    if (dragIdx.current !== null) return;
    const r = cvs.current.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    if (hitStop(mx,my) >= 0) return;
    const [lat,lng] = toLatLng(mx, my, sz.w, sz.h);
    onAdd(lat, lng);
  };
  const onContextMenu = e => {
    e.preventDefault();
    const r = cvs.current.getBoundingClientRect();
    const hit = hitStop(e.clientX-r.left, e.clientY-r.top);
    if (hit >= 0) onRemove(hit);
  };

  return (
    <div ref={box} style={{ position:"relative", width:"100%", height:480, borderRadius:14, overflow:"hidden", background:C.bg }}>
      <canvas ref={cvs} width={sz.w} height={sz.h}
        style={{ display:"block", width:"100%", height:"100%", cursor:"crosshair" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onClick={onClick} onContextMenu={onContextMenu}
      />
      {tip && (
        <div style={{ position:"absolute", left:tip.x+16, top:tip.y-8, background:`${C.card}EE`,
          border:`1px solid ${C.borderHi}`, borderRadius:10, padding:"8px 12px",
          fontSize:12, color:C.white, pointerEvents:"none", zIndex:10, backdropFilter:"blur(8px)" }}>
          <div style={{ fontWeight:600, color:C.accent, marginBottom:2 }}>Stop {tip.idx+1}</div>
          <div style={{ color:C.dimText, fontSize:11 }}>{tip.stop.address}</div>
          <div style={{ color:C.mutedText, fontSize:10, marginTop:3 }}>{tip.stop.packages} pkg · drag to move · right-click to remove</div>
        </div>
      )}
      <div style={{ position:"absolute", top:12, left:12, background:`${C.bg}CC`, border:`1px solid ${C.accent}33`,
        borderRadius:8, padding:"6px 12px", fontSize:11, color:C.accent, fontFamily:F.mono, pointerEvents:"none" }}>
        Click to add · Drag to move · Right-click to remove
      </div>
      <div style={{ position:"absolute", bottom:12, right:12, background:`${C.bg}CC`, border:`1px solid ${C.border}`,
        borderRadius:8, padding:"5px 10px", fontSize:10, color:C.mutedText, fontFamily:F.mono, pointerEvents:"none" }}>
        N↑ San Mateo County
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  LEAFLET FLEET MAP
// ─────────────────────────────────────────────
function FleetMap({ selectedRoute, onSelect, showAlt }) {
  const ref = useRef(null);
  const map = useRef(null);
  const layers = useRef([]);

  const draw = useCallback((L, m) => {
    layers.current.forEach(l => l.remove());
    layers.current = [];
    ROUTES.forEach((route, ri) => {
      if (route.status === "completed") return;
      const sel = ri === selectedRoute;
      const poly = L.polyline(route.waypoints, {
        color:route.color, weight: sel ? 5 : 2, opacity: sel ? 1 : 0.35
      }).addTo(m);
      poly.on("click", () => onSelect(ri));
      layers.current.push(poly);

      route.stopsList.forEach(s => {
        const mk = L.marker([s.lat,s.lng], { icon: divIcon(
          `<div style="width:${s.current?26:18}px;height:${s.current?26:18}px;border-radius:50%;
            background:${s.done?C.mutedText:s.current?route.color:C.card};
            border:2px solid ${route.color};display:flex;align-items:center;justify-content:center;
            font-family:Inter,sans-serif;font-size:10px;font-weight:700;
            color:${s.current?C.bg:route.color};">${s.num}</div>`,
          [s.current?26:18, s.current?26:18]
        )}).addTo(m);
        mk.bindPopup(`<div style="font-family:Inter,sans-serif;min-width:180px;background:${C.card};color:${C.white};
          border-radius:8px;padding:10px;font-size:13px;">
          <b style="color:${route.color}">Stop #${s.num}</b><br/>${s.address}<br/>
          <span style="color:${C.dimText};font-size:11px;">${s.packages} pkg · ${s.done?"✅":s.current?"⚡ Current":"⏳"}</span></div>`);
        layers.current.push(mk);
      });

      const dm = L.marker(route.driverPos, { icon: divIcon(
        `<svg width="26" height="26" viewBox="0 0 26 26">
          <polygon points="13,2 24,13 13,24 2,13" fill="${route.color}" stroke="${C.bg}" stroke-width="2"/>
        </svg>`, [26,26]
      ), zIndexOffset: 1000 }).addTo(m);
      dm.on("click", () => onSelect(ri));
      dm.bindPopup(`<div style="font-family:Inter,sans-serif;min-width:190px;background:${C.card};color:${C.white};
        border-radius:8px;padding:10px;font-size:13px;">
        <b style="color:${route.color}">${route.id} — ${route.driver}</b><br/>
        ${route.area} · ${route.stops} stops · ETA ${route.eta}<br/>
        <span style="color:${C.dimText};font-size:11px;">Efficiency: <b style="color:${route.efficiency>90?C.green:route.efficiency>80?C.yellow:C.red}">${route.efficiency}%</b></span></div>`);
      layers.current.push(dm);
    });
    if (showAlt) {
      const alt = L.polyline(ALT_ROUTE, { color:C.yellow, weight:4, dashArray:"10 6" }).addTo(m);
      layers.current.push(alt);
    }
  }, [selectedRoute, showAlt, onSelect]);

  useEffect(() => {
    loadLeaflet(() => {
      if (!ref.current) return;
      if (!map.current) {
        const m = window.L.map(ref.current, { zoomControl:true })
          .setView([37.5630,-122.3255], 11);
        window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          { maxZoom:19 }).addTo(m);
        map.current = m;
        setTimeout(() => m.invalidateSize(), 100);
      }
      draw(window.L, map.current);
    });
  }, [draw]);

  return (
    <div style={{ position:"relative", height:"100%", borderRadius:14, overflow:"hidden" }}>
      <div ref={ref} style={{ width:"100%", height:"100%" }} />
      <div style={{ position:"absolute", bottom:14, left:14, background:`${C.bg}EE`,
        border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", zIndex:999 }}>
        {ROUTES.filter(r=>r.status!=="completed").map(r => (
          <div key={r.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <div style={{ width:16, height:3, background:r.color, borderRadius:2 }} />
            <span style={{ fontSize:11, color:C.dimText, fontFamily:F.mono }}>{r.id} {r.driver}</span>
            {r.status==="delayed" && <span style={{ fontSize:9, color:C.red, fontWeight:700 }}>DELAYED</span>}
          </div>
        ))}
        {showAlt && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, paddingTop:6, borderTop:`1px solid ${C.border}` }}>
            <div style={{ width:16, height:3, background:C.yellow, borderRadius:2 }} />
            <span style={{ fontSize:11, color:C.yellow, fontFamily:F.mono }}>AI Reroute</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  SHARED UI COMPONENTS
// ─────────────────────────────────────────────
function Badge({ children, color = C.accent, size = "sm" }) {
  return (
    <span style={{ background:`${color}18`, color, border:`1px solid ${color}30`,
      borderRadius:6, padding: size==="lg" ? "3px 12px" : "2px 8px",
      fontSize: size==="lg" ? 12 : 10, fontWeight:600,
      fontFamily:F.mono, letterSpacing:"0.06em", textTransform:"uppercase" }}>
      {children}
    </span>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding:"7px 18px", background: active ? C.accent : "transparent",
      color: active ? C.bg : C.dimText, border:"none", borderRadius:8,
      fontFamily:F.body, fontSize:13, fontWeight:500, cursor:"pointer",
      transition:"all 0.15s", letterSpacing:"0.01em" }}>
      {children}
    </button>
  );
}

function Bar({ val, color = C.accent, height = 5 }) {
  return (
    <div style={{ background:C.border, borderRadius:99, height, overflow:"hidden" }}>
      <div style={{ width:`${val}%`, height:"100%", background:color, borderRadius:99,
        transition:"width 0.3s ease" }} />
    </div>
  );
}

function KPI({ icon, label, value, sub, color = C.accent }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
      padding:"18px 20px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:
        `radial-gradient(circle at 100% 0%, ${color}14 0%, transparent 60%)`, pointerEvents:"none" }} />
      <div style={{ fontSize:20, marginBottom:8 }}>{icon}</div>
      <div style={{ fontFamily:F.display, fontSize:28, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:13, color:C.dimText, marginTop:4, fontWeight:500 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:C.mutedText, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:10,
      padding:"10px 20px", background: active ? `${C.accent}14` : "transparent",
      border:"none", borderLeft: active ? `2px solid ${C.accent}` : `2px solid transparent`,
      color: active ? C.accent : C.dimText, fontFamily:F.body, fontSize:13,
      fontWeight: active ? 600 : 400, cursor:"pointer", width:"100%",
      textAlign:"left", transition:"all 0.15s" }}>
      <span style={{ fontSize:15, opacity: active ? 1 : 0.7 }}>{icon}</span>
      <span style={{ flex:1 }}>{label}</span>
      {badge && <Badge>{badge}</Badge>}
    </button>
  );
}

// ─────────────────────────────────────────────
//  ADDRESS AUTOCOMPLETE INPUT
// ─────────────────────────────────────────────
function AddressInput({ onSelect }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef(null);

  const onChange = e => {
    const v = e.target.value;
    setQ(v);
    const r = searchAddresses(v);
    setResults(r);
    setOpen(r.length > 0);
    setCursor(-1);
  };

  const pick = item => {
    onSelect(item);
    setQ(""); setResults([]); setOpen(false); setCursor(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = e => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c+1, results.length-1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor(c => Math.max(c-1, -1)); }
    else if (e.key === "Enter" && cursor >= 0) { e.preventDefault(); pick(results[cursor]); }
    else if (e.key === "Escape") { setOpen(false); setCursor(-1); }
  };

  return (
    <div style={{ position:"relative" }}>
      <div style={{ position:"relative" }}>
        <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
          fontSize:14, pointerEvents:"none", opacity:0.5 }}>🔍</span>
        <input
          ref={inputRef}
          value={q}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder="Search address in San Mateo County..."
          autoComplete="off"
          style={{ width:"100%", background:C.surface, border:`1px solid ${open?C.accent+"66":C.border}`,
            borderRadius: open ? "10px 10px 0 0" : 10, padding:"10px 12px 10px 36px",
            color:C.white, fontFamily:F.body, fontSize:13, outline:"none",
            transition:"border-color 0.15s", boxSizing:"border-box" }}
        />
      </div>
      {open && results.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:9999,
          background:C.cardHi, border:`1px solid ${C.accent}55`, borderTop:"none",
          borderRadius:"0 0 10px 10px", overflow:"hidden",
          boxShadow:"0 16px 40px rgba(0,0,0,0.6)" }}>
          {results.map((r, i) => (
            <div key={i}
              onMouseDown={e => { e.preventDefault(); pick(r); }}
              onMouseEnter={() => setCursor(i)}
              style={{ padding:"10px 14px", cursor:"pointer",
                background: cursor===i ? `${C.accent}18` : "transparent",
                borderBottom: i < results.length-1 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ fontSize:12, color: cursor===i ? C.accent : C.white, fontWeight:500 }}>
                📍 {r.s}
              </span>
            </div>
          ))}
          <div style={{ padding:"5px 14px", fontSize:10, color:C.mutedText,
            background:C.bg, borderTop:`1px solid ${C.border}` }}>
            ↑↓ navigate · Enter to select · Esc to close
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  ROUTE BUILDER
// ─────────────────────────────────────────────
function RouteBuilder() {
  const [stops, setStops] = useState([]);
  const [name, setName] = useState("New Route");
  const [driver, setDriver] = useState("Unassigned");
  const [aiNote, setAiNote] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const totalPkgs = stops.reduce((a, s) => a + (s.packages || 1), 0);

  const addStop = useCallback((lat, lng) => {
    setStops(p => [...p, { id: Date.now(), lat, lng, address: nearestAddress(lat, lng), packages: 1 }]);
    setSaved(false);
  }, []);

  const moveStopPos = useCallback((idx, lat, lng) => {
    setStops(p => p.map((s, i) => i === idx ? { ...s, lat, lng, address: nearestAddress(lat, lng) } : s));
    setSaved(false);
  }, []);

  const removeStop = useCallback(idx => {
    setStops(p => p.filter((_, i) => i !== idx));
    setSaved(false);
  }, []);

  const addByAddress = item => {
    setStops(p => [...p, { id: Date.now(), lat: item.lat, lng: item.lng, address: item.s, packages: 1 }]);
    setSaved(false);
  };

  const reorder = (from, to) => {
    if (to < 0 || to >= stops.length) return;
    const arr = [...stops];
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    setStops(arr); setSaved(false);
  };

  const aiOptimize = async () => {
    if (stops.length < 2) return;
    setAiLoading(true); setAiNote(null);
    try {
      const list = stops.map((s, i) => `${i+1}. ${s.address} (${s.packages} pkg)`).join("\n");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:600,
          system:`You are HOMER AI, a route optimization engine for San Mateo County deliveries. Given a stop list, return ONLY: 1) "Order: N,N,N..." (comma-separated original numbers in optimal sequence), 2) time saved estimate, 3) one sentence reason. Under 60 words total.`,
          messages:[{role:"user", content:`Optimize:\n${list}`}]
        })
      });
      const d = await res.json();
      const text = d.content?.map(c => c.text||"").join("") || "";
      setAiNote(text);
      const m = text.match(/Order:\s*([\d,\s]+)/i);
      if (m) {
        const order = m[1].split(",").map(n => parseInt(n.trim())-1).filter(n => !isNaN(n) && n>=0 && n<stops.length);
        if (order.length === stops.length) setStops(order.map(i => stops[i]));
      }
    } catch { setAiNote("Could not reach HOMER AI. Check connection."); }
    setAiLoading(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Controls row */}
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
        <input value={name} onChange={e=>setName(e.target.value)}
          style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
            padding:"9px 14px", color:C.white, fontFamily:F.display, fontSize:15,
            fontWeight:700, outline:"none", width:200 }} />
        <select value={driver} onChange={e=>setDriver(e.target.value)}
          style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
            padding:"9px 14px", color:C.dimText, fontFamily:F.body, fontSize:13, outline:"none", cursor:"pointer" }}>
          {DRIVERS.map(d=><option key={d} style={{background:C.surface}}>{d}</option>)}
        </select>
        <div style={{ flex:1 }} />
        <button onClick={aiOptimize} disabled={stops.length<2||aiLoading}
          style={{ background: stops.length<2 ? C.border : `${C.purple}22`,
            color: stops.length<2 ? C.mutedText : C.purple,
            border:`1px solid ${stops.length<2 ? C.border : C.purple+"44"}`,
            borderRadius:10, padding:"9px 16px", fontSize:13, fontWeight:600,
            cursor: stops.length<2 ? "not-allowed" : "pointer", fontFamily:F.body,
            display:"flex", alignItems:"center", gap:6 }}>
          {aiLoading ? <span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span> : "✦"} AI Optimize
        </button>
        <button onClick={()=>{setStops([]);setAiNote(null);setSaved(false);}}
          style={{ background:`${C.red}14`, color:C.red, border:`1px solid ${C.red}30`,
            borderRadius:10, padding:"9px 14px", fontSize:13, fontWeight:600,
            cursor:"pointer", fontFamily:F.body }}>Clear</button>
        <button onClick={()=>setSaved(true)} disabled={stops.length===0}
          style={{ background: saved ? `${C.green}22` : `${C.accent}22`,
            color: saved ? C.green : C.accent,
            border:`1px solid ${saved ? C.green+"44" : C.accent+"44"}`,
            borderRadius:10, padding:"9px 16px", fontSize:13, fontWeight:600,
            cursor: stops.length===0 ? "not-allowed" : "pointer", fontFamily:F.body }}>
          {saved ? "✓ Saved" : "Save Route"}
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        {[
          {label:"Stops",v:stops.length||"—",c:C.accent},
          {label:"Packages",v:totalPkgs||"—",c:C.yellow},
          {label:"Est. Distance",v:stops.length>1?`~${(stops.length*0.8).toFixed(1)} mi`:"—",c:C.green},
          {label:"Est. Time",v:stops.length>0?`~${stops.length*5} min`:"—",c:C.orange},
        ].map(({label,v,c})=>(
          <div key={label} style={{ background:C.card, border:`1px solid ${C.border}`,
            borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontFamily:F.display, fontSize:22, fontWeight:700, color:c }}>{v}</div>
            <div style={{ fontSize:11, color:C.mutedText, marginTop:3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Map + Panel */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:14 }}>
        <CanvasMap stops={stops} onAdd={addStop} onMove={moveStopPos} onRemove={removeStop} />

        <div style={{ display:"flex", flexDirection:"column", gap:10, maxHeight:480, overflowY:"auto" }}>
          {/* Address search */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:16, overflow:"visible", position:"relative", zIndex:100 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.dimText, marginBottom:10,
              textTransform:"uppercase", letterSpacing:"0.08em" }}>Add Stop</div>
            <AddressInput onSelect={addByAddress} />
            <div style={{ fontSize:11, color:C.mutedText, marginTop:8 }}>
              Or click anywhere on the map
            </div>
          </div>

          {/* AI note */}
          {aiNote && (
            <div style={{ background:`${C.purple}0A`, border:`1px solid ${C.purple}33`,
              borderRadius:12, padding:14, animation:"fadeIn 0.2s ease" }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.purple, marginBottom:6,
                textTransform:"uppercase", letterSpacing:"0.08em" }}>✦ HOMER AI</div>
              <p style={{ margin:0, fontSize:12, color:C.dimText, lineHeight:1.6 }}>{aiNote}</p>
            </div>
          )}

          {/* Stop list */}
          {stops.length === 0 ? (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
              padding:"40px 20px", textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🗺</div>
              <div style={{ fontFamily:F.display, fontSize:17, fontWeight:700,
                color:C.dimText, marginBottom:6 }}>No stops yet</div>
              <div style={{ fontSize:12, color:C.mutedText, lineHeight:1.7 }}>
                Click the map to drop stops or search an address above.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", padding:"0 2px" }}>
                <span style={{ fontSize:11, fontWeight:600, color:C.dimText,
                  textTransform:"uppercase", letterSpacing:"0.08em" }}>Stop Order</span>
                <span style={{ fontSize:11, color:C.mutedText }}>Drag to reorder</span>
              </div>
              {stops.map((stop, idx) => (
                <div key={stop.id||idx} draggable
                  onDragStart={()=>setDragFrom(idx)}
                  onDragEnter={()=>setDragOver(idx)}
                  onDragEnd={()=>{ if(dragFrom!==null&&dragOver!==null&&dragFrom!==dragOver) reorder(dragFrom,dragOver); setDragFrom(null);setDragOver(null); }}
                  onDragOver={e=>e.preventDefault()}
                  style={{ background: dragOver===idx ? `${C.accent}14` : C.card,
                    border:`1px solid ${dragOver===idx ? C.accent+"55" : C.border}`,
                    borderRadius:12, padding:"10px 12px", cursor:"grab",
                    display:"flex", alignItems:"center", gap:8, transition:"all 0.1s" }}>
                  <span style={{ color:C.mutedText, fontSize:12 }}>⠿</span>
                  <div style={{ width:22, height:22, borderRadius:"50%", background:C.accent,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:800, color:C.bg, flexShrink:0 }}>{idx+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:C.white,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {stop.address}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                      <span style={{ fontSize:10, color:C.mutedText }}>📦</span>
                      <input type="number" min="1" max="99" value={stop.packages||1}
                        onChange={e=>{ const v=parseInt(e.target.value)||1; setStops(p=>p.map((s,i)=>i===idx?{...s,packages:v}:s)); }}
                        onClick={e=>e.stopPropagation()}
                        style={{ width:32, background:C.surface, border:`1px solid ${C.border}`,
                          borderRadius:4, padding:"1px 4px", color:C.dimText,
                          fontSize:10, fontFamily:F.mono, outline:"none" }} />
                      <span style={{ fontSize:10, color:C.mutedText }}>pkgs</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                    <button onClick={()=>reorder(idx,idx-1)} disabled={idx===0}
                      style={{ background:"none", border:"none", color: idx===0?C.mutedText:C.dimText,
                        cursor: idx===0?"default":"pointer", fontSize:9, padding:1, lineHeight:1 }}>▲</button>
                    <button onClick={()=>reorder(idx,idx+1)} disabled={idx===stops.length-1}
                      style={{ background:"none", border:"none", color: idx===stops.length-1?C.mutedText:C.dimText,
                        cursor: idx===stops.length-1?"default":"pointer", fontSize:9, padding:1, lineHeight:1 }}>▼</button>
                  </div>
                  <button onClick={()=>removeStop(idx)}
                    style={{ background:`${C.red}14`, border:`1px solid ${C.red}25`,
                      borderRadius:6, color:C.red, padding:"2px 7px",
                      cursor:"pointer", fontSize:11 }}>✕</button>
                </div>
              ))}
              {stops.length >= 2 && (
                <div style={{ background:C.surface, border:`1px solid ${C.border}`,
                  borderRadius:12, padding:14 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.dimText, marginBottom:10,
                    textTransform:"uppercase", letterSpacing:"0.08em" }}>Summary</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {[["Route",name],["Driver",driver],["Stops",stops.length],["Packages",totalPkgs]].map(([l,v])=>(
                      <div key={l}>
                        <div style={{ fontSize:10, color:C.mutedText, textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:C.white, marginTop:2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  DISPATCHER VIEW
// ─────────────────────────────────────────────
function Dispatcher({ onNav }) {
  const [tab, setTab] = useState("overview");
  const [alerts, setAlerts] = useState(ALERTS);
  const [selRoute, setSelRoute] = useState(0);
  const [showAlt, setShowAlt] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([{role:"ai",text:"I'm HOMER AI — your live fleet brain for San Mateo County. Ask me anything about your routes, delays, or tomorrow's forecast."}]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEnd = useRef(null);

  const actAlert = (id, accepted) => {
    const a = alerts.find(x=>x.id===id);
    if (accepted && a?.type==="reroute") setShowAlt(true);
    setAlerts(p=>p.map(x=>x.id===id?{...x,accepted}:x));
  };

  const sendChat = async () => {
    if (!chatInput.trim()||chatLoading) return;
    const msg = chatInput; setChatInput(""); setChatLoading(true);
    setMessages(p=>[...p,{role:"user",text:msg}]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:800,
          system:`You are HOMER AI for San Mateo County logistics. Fleet: Marcus T. (RT-001 Redwood City, 91% eff), Priya S. (RT-002 San Mateo, 88%), James K. (RT-003 Daly City, 76%, DELAYED — El Camino Real traffic), Sofia R. (RT-004 Burlingame, 95%, complete). Be concise, data-driven. Under 80 words.`,
          messages:[{role:"user",content:msg}]
        })
      });
      const d = await res.json();
      setMessages(p=>[...p,{role:"ai",text:d.content?.map(c=>c.text||"").join("")||"No response."}]);
    } catch { setMessages(p=>[...p,{role:"ai",text:"Connection error."}]); }
    setChatLoading(false);
    setTimeout(()=>chatEnd.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  const pendingAlerts = alerts.filter(a=>a.accepted===null);

  return (
    <div style={{ display:"flex", gap:18 }}>
      <div style={{ flex:1, minWidth:0 }}>
        {/* Tab bar */}
        <div style={{ display:"flex", gap:2, background:C.card, borderRadius:12, padding:4,
          border:`1px solid ${C.border}`, width:"fit-content", marginBottom:20 }}>
          {["overview","alerts","routes","drivers","forecast"].map(t=>(
            <Pill key={t} active={tab===t} onClick={()=>setTab(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </Pill>
          ))}
        </div>

        {tab==="overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              <KPI icon="🚐" label="Active Routes" value="3" sub="1 completed today" color={C.green}/>
              <KPI icon="📦" label="Packages Out" value="418" sub="83 delivered" color={C.accent}/>
              <KPI icon="⚡" label="Fleet Efficiency" value="88%" sub="↑3% from yesterday" color={C.yellow}/>
              <KPI icon="⏱" label="Avg Stop Time" value="4.1m" sub="Target: 3.5 min" color={C.orange}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:14 }}>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden", height:460 }}>
                <FleetMap selectedRoute={selRoute} onSelect={setSelRoute} showAlt={showAlt}/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10, maxHeight:460, overflowY:"auto" }}>
                {ROUTES.map((r,i)=>(
                  <div key={r.id} onClick={()=>setSelRoute(i)}
                    style={{ background: selRoute===i ? `${r.color}0C` : C.card,
                      border:`1px solid ${selRoute===i ? r.color+"55" : C.border}`,
                      borderRadius:12, padding:14, cursor:"pointer", transition:"all 0.2s" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontFamily:F.mono, fontSize:10, color:r.color }}>{r.id}</span>
                      <Badge color={r.status==="active"?C.green:r.status==="delayed"?C.red:C.mutedText}>
                        {r.status}
                      </Badge>
                    </div>
                    <div style={{ fontWeight:600, fontSize:14, color:C.white, marginBottom:2 }}>{r.driver}</div>
                    <div style={{ fontSize:12, color:C.dimText, marginBottom:8 }}>{r.area} · ETA {r.eta}</div>
                    <Bar val={r.efficiency} color={r.efficiency>90?C.green:r.efficiency>80?C.yellow:C.red}/>
                    <div style={{ fontSize:10, color:C.mutedText, marginTop:4 }}>{r.efficiency}% efficiency</div>
                  </div>
                ))}
                <button onClick={()=>onNav(1)}
                  style={{ background:`${C.purple}14`, color:C.purple,
                    border:`1px solid ${C.purple}33`, borderRadius:12,
                    padding:14, fontSize:13, fontWeight:600, cursor:"pointer",
                    fontFamily:F.body, textAlign:"center" }}>
                  + Build New Route
                </button>
              </div>
            </div>
            {pendingAlerts.length > 0 && (
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                  <span style={{ fontFamily:F.display, fontSize:18, fontWeight:700 }}>✦ AI Suggestions</span>
                  <Badge color={C.red} size="lg">{pendingAlerts.length} pending</Badge>
                </div>
                {pendingAlerts.map(a=>(
                  <div key={a.id} style={{ background:C.surface, border:`1px solid ${C.border}`,
                    borderRadius:12, padding:16, marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:8 }}>
                          <Badge color={a.priority==="high"?C.red:a.priority==="medium"?C.yellow:C.dimText}>{a.priority}</Badge>
                          <span style={{ fontFamily:F.mono, fontSize:10, color:C.dimText }}>{a.route}</span>
                          <span style={{ fontSize:10, color:C.mutedText }}>{a.time}</span>
                        </div>
                        <p style={{ margin:0, fontSize:13, color:C.white, lineHeight:1.6 }}>{a.message}</p>
                        {a.type==="reroute"&&<p style={{ margin:"6px 0 0", fontSize:11, color:C.yellow }}>⚡ Approving shows reroute on map</p>}
                      </div>
                      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                        <button onClick={()=>actAlert(a.id,true)}
                          style={{ background:`${C.green}18`, color:C.green, border:`1px solid ${C.green}33`,
                            borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600,
                            cursor:"pointer", fontFamily:F.body }}>Push ✓</button>
                        <button onClick={()=>actAlert(a.id,false)}
                          style={{ background:`${C.red}18`, color:C.red, border:`1px solid ${C.red}33`,
                            borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600,
                            cursor:"pointer", fontFamily:F.body }}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab==="alerts" && (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
            <div style={{ fontFamily:F.display, fontSize:18, fontWeight:700, marginBottom:16 }}>All AI Suggestions</div>
            {alerts.map(a=>(
              <div key={a.id} style={{ background:C.surface, border:`1px solid ${C.border}`,
                borderRadius:12, padding:16, marginBottom:10, opacity:a.accepted!==null?0.55:1,
                transition:"opacity 0.2s" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                      <Badge color={a.priority==="high"?C.red:a.priority==="medium"?C.yellow:C.dimText}>{a.priority}</Badge>
                      <span style={{ fontFamily:F.mono, fontSize:10, color:C.dimText }}>{a.route}</span>
                    </div>
                    <p style={{ margin:0, fontSize:13, color:C.white, lineHeight:1.6 }}>{a.message}</p>
                  </div>
                  {a.accepted===null
                    ? <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                        <button onClick={()=>actAlert(a.id,true)} style={{ background:`${C.green}18`,color:C.green,border:`1px solid ${C.green}33`,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F.body }}>Push ✓</button>
                        <button onClick={()=>actAlert(a.id,false)} style={{ background:`${C.red}18`,color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F.body }}>✕</button>
                      </div>
                    : <Badge color={a.accepted?C.green:C.mutedText}>{a.accepted?"Pushed":"Dismissed"}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="routes" && (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
            <div style={{ fontFamily:F.display, fontSize:18, fontWeight:700, marginBottom:16 }}>Active Routes</div>
            {ROUTES.map(r=>(
              <div key={r.id} style={{ background:C.surface, border:`1px solid ${C.border}`,
                borderRadius:12, padding:16, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                  <div>
                    <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontFamily:F.mono, fontSize:11, color:r.color }}>{r.id}</span>
                      <span style={{ fontWeight:600, fontSize:15, color:C.white }}>{r.area}</span>
                      <Badge color={r.status==="active"?C.green:r.status==="delayed"?C.red:C.mutedText}>{r.status}</Badge>
                    </div>
                    <div style={{ fontSize:13, color:C.dimText }}>
                      👤 {r.driver} · 🛑 {r.stops} stops · 📦 {r.packages} pkgs · ETA {r.eta}
                    </div>
                  </div>
                  <div style={{ minWidth:140 }}>
                    <div style={{ fontSize:12, color:C.dimText, marginBottom:6 }}>Efficiency {r.efficiency}%</div>
                    <Bar val={r.efficiency} color={r.efficiency>90?C.green:r.efficiency>80?C.yellow:C.red}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="drivers" && (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
            <div style={{ fontFamily:F.display, fontSize:18, fontWeight:700, marginBottom:16 }}>Driver Performance</div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                  {["Driver","Stops","Packages","Efficiency","Avg Stop","On-Time","Trend"].map(h=>(
                    <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10,
                      color:C.mutedText, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DRIVER_STATS.map((d,i)=>(
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}22` }}>
                    <td style={{ padding:"12px", fontWeight:600, color:C.white, fontSize:13 }}>{d.name}</td>
                    <td style={{ padding:"12px", fontFamily:F.mono, fontSize:12, color:C.dimText }}>{d.stops}</td>
                    <td style={{ padding:"12px", fontFamily:F.mono, fontSize:12, color:C.dimText }}>{d.packages}</td>
                    <td style={{ padding:"12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontFamily:F.mono, fontSize:12, color:C.white }}>{d.efficiency}%</span>
                        <div style={{ width:60 }}>
                          <Bar val={d.efficiency} color={d.efficiency>90?C.green:d.efficiency>80?C.yellow:C.red}/>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"12px", fontFamily:F.mono, fontSize:12, color:C.dimText }}>{d.avgStop}</td>
                    <td style={{ padding:"12px" }}><Badge color={d.onTime==="99%"?C.green:C.yellow}>{d.onTime}</Badge></td>
                    <td style={{ padding:"12px", fontSize:16 }}>{d.trend==="up"?"📈":d.trend==="down"?"📉":"➡️"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab==="forecast" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
              <div style={{ fontFamily:F.display, fontSize:18, fontWeight:700, marginBottom:20 }}>Weekly Volume</div>
              <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:140 }}>
                {WEEKLY.map((d,i)=>(
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:10, fontFamily:F.mono, color:C.dimText }}>{d.v}</span>
                    <div style={{ width:"100%", borderRadius:"4px 4px 0 0",
                      background: i>=5 ? `${C.accent}44` : C.accent,
                      border: i>=5 ? `1px dashed ${C.accent}66` : "none",
                      height:`${(d.v/340)*120}px`, transition:"height 0.3s" }} />
                    <span style={{ fontSize:10, color:C.dimText }}>{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <KPI icon="🔮" label="Tomorrow's Forecast" value="+14%" sub="Above 30-day avg" color={C.yellow}/>
              <KPI icon="🚐" label="Recommended Drivers" value="5" sub="Based on forecast" color={C.green}/>
            </div>
          </div>
        )}
      </div>

      {/* AI Chat */}
      <div style={{ flexShrink:0, width:chatOpen?300:44, transition:"width 0.25s ease", overflow:"hidden" }}>
        {chatOpen ? (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
            height:"calc(100vh - 120px)", display:"flex", flexDirection:"column",
            position:"sticky", top:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"16px 16px 12px", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontFamily:F.display, fontSize:15, fontWeight:700, color:C.accent }}>✦ HOMER AI</span>
              <button onClick={()=>setChatOpen(false)}
                style={{ background:"none", border:"none", color:C.dimText, cursor:"pointer", fontSize:18 }}>×</button>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:10 }}>
              {messages.map((m,i)=>(
                <div key={i} style={{ alignSelf:m.role==="user"?"flex-end":"flex-start",
                  background:m.role==="user"?`${C.accent}18`:C.surface,
                  border:`1px solid ${m.role==="user"?C.accent+"33":C.border}`,
                  borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",
                  padding:"9px 13px", maxWidth:"90%", fontSize:12,
                  color:C.white, lineHeight:1.6 }}>{m.text}</div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf:"flex-start", background:C.surface, border:`1px solid ${C.border}`,
                  borderRadius:"12px 12px 12px 2px", padding:"9px 13px",
                  fontSize:12, color:C.dimText }}>Thinking…</div>
              )}
              <div ref={chatEnd}/>
            </div>
            <div style={{ padding:12, borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&sendChat()}
                placeholder="Ask HOMER AI…"
                style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`,
                  borderRadius:8, padding:"8px 12px", color:C.white,
                  fontFamily:F.body, fontSize:12, outline:"none" }} />
              <button onClick={sendChat}
                style={{ background:C.accent, border:"none", borderRadius:8,
                  width:36, cursor:"pointer", color:C.bg, fontSize:16, fontWeight:700 }}>→</button>
            </div>
          </div>
        ) : (
          <button onClick={()=>setChatOpen(true)}
            style={{ background:C.accent, border:"none", borderRadius:12, width:44, height:44,
              cursor:"pointer", fontSize:18, display:"flex", alignItems:"center",
              justifyContent:"center", boxShadow:`0 0 24px ${C.accentGlow}`,
              position:"sticky", top:16 }}>✦</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  OWNER VIEW
// ─────────────────────────────────────────────
function Owner() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <KPI icon="💰" label="Revenue Today" value="$2,841" sub="↑7% vs last Thursday" color={C.green}/>
        <KPI icon="📦" label="Packages Delivered" value="418" sub="of 501 total" color={C.accent}/>
        <KPI icon="⚡" label="Profit / Package" value="$6.79" sub="↑$0.34 from avg" color={C.yellow}/>
        <KPI icon="🚐" label="Cost / Route" value="$184" sub="↓$12 from last week" color={C.orange}/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
          <div style={{ fontFamily:F.display, fontSize:18, fontWeight:700, marginBottom:16 }}>Optimization Insights</div>
          {[
            {label:"Daly City / SSF corridor underperforming",detail:"James K. avg stop 5.6m vs fleet avg 4.1m. El Camino Real congestion is a factor — consider adjusting departure timing.",impact:"Est. +$140/wk",urgency:"high"},
            {label:"Redwood City stop density suboptimal",detail:"Reducing Marcus T.'s route by 8 stops and redistributing could increase packages/hr by 11%.",impact:"Est. +$220/wk",urgency:"medium"},
            {label:"Saturday capacity underutilized",detail:"Historical data shows 38% available capacity Saturday afternoons. One additional route could net +$380.",impact:"Est. +$380/wk",urgency:"low"},
          ].map((ins,i)=>(
            <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`,
              borderRadius:12, padding:16, marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontWeight:600, fontSize:14, color:C.white }}>{ins.label}</span>
                <Badge color={ins.urgency==="high"?C.red:ins.urgency==="medium"?C.yellow:C.green} size="lg">{ins.impact}</Badge>
              </div>
              <p style={{ margin:0, fontSize:13, color:C.dimText, lineHeight:1.6 }}>{ins.detail}</p>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:18 }}>
            <div style={{ fontFamily:F.display, fontSize:15, fontWeight:700, marginBottom:14 }}>Integrations</div>
            {INTEGRATIONS.map((g,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"9px 0", borderBottom: i<INTEGRATIONS.length-1?`1px solid ${C.border}`:"none" }}>
                <span style={{ fontSize:13, color:C.dimText }}>{g.icon} {g.name}</span>
                <Badge color={g.status==="connected"?C.green:C.mutedText}>{g.status}</Badge>
              </div>
            ))}
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:18 }}>
            <div style={{ fontFamily:F.display, fontSize:15, fontWeight:700, marginBottom:14 }}>30-Day Trend</div>
            {[["Revenue","$51,420","+8.2%",true],["Packages","8,840","+5.1%",true],["Routes","124","-2",false]].map(([l,v,c,up])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:13, color:C.dimText }}>{l}</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontFamily:F.mono, fontSize:14, fontWeight:600, color:C.white }}>{v}</span>
                  <span style={{ fontSize:11, color:up?C.green:C.red }}>{c}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  COURIER VIEW
// ─────────────────────────────────────────────
function Courier() {
  const route = ROUTES[0];
  const curIdx = Math.max(0, route.stopsList.findIndex(s=>s.current));
  const upNext = route.stopsList.slice(curIdx);
  const mapRef = useRef(null);
  const mapInst = useRef(null);

  useEffect(()=>{
    loadLeaflet(()=>{
      if (!mapRef.current||mapInst.current) return;
      const L = window.L;
      const m = L.map(mapRef.current).setView(route.driverPos, 14);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19}).addTo(m);
      mapInst.current = m;
      L.marker(route.driverPos,{icon:divIcon(`<svg width="24" height="24" viewBox="0 0 24 24"><polygon points="12,2 22,12 12,22 2,12" fill="${C.accent}" stroke="${C.bg}" stroke-width="2"/></svg>`,[24,24])}).addTo(m);
      const upcoming = route.stopsList.filter(s=>!s.done);
      if (upcoming.length>0) L.polyline([route.driverPos,...upcoming.map(s=>[s.lat,s.lng])],{color:C.accent,weight:3,dashArray:"6 4"}).addTo(m);
      upcoming.forEach(s=>{
        L.marker([s.lat,s.lng],{icon:divIcon(`<div style="width:${s.current?24:18}px;height:${s.current?24:18}px;border-radius:50%;background:${s.current?C.accent:C.card};border:2px solid ${C.accent};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:${s.current?C.bg:C.accent};">${s.num}</div>`,[s.current?24:18,s.current?24:18])}).addTo(m);
      });
      setTimeout(()=>m.invalidateSize(),100);
    });
  },[]);

  return (
    <div style={{ maxWidth:500, margin:"0 auto", display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ background:`linear-gradient(135deg,${C.accent}18,${C.card})`,
        border:`1px solid ${C.accent}33`, borderRadius:16, padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontFamily:F.display, fontSize:22, fontWeight:700, color:C.white }}>Hey Marcus 👋</div>
            <div style={{ color:C.dimText, fontSize:13, marginTop:4 }}>{route.area} · {route.packages} packages</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:F.display, fontSize:26, fontWeight:700, color:C.accent }}>26%</div>
            <div style={{ fontSize:11, color:C.mutedText }}>Complete</div>
          </div>
        </div>
        <div style={{ marginTop:14 }}>
          <Bar val={26} color={C.accent} height={6}/>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
            color:C.mutedText, marginTop:4 }}>
            <span>Stop 22 of {route.stops}</span><span>ETA {route.eta}</span>
          </div>
        </div>
      </div>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden" }}>
        <div style={{ padding:"14px 16px 10px", fontFamily:F.display, fontSize:15, fontWeight:700 }}>Navigation</div>
        <div style={{ height:260, position:"relative" }}>
          <div ref={mapRef} style={{ width:"100%", height:"100%" }}/>
          <div style={{ position:"absolute",top:10,left:10,background:`${C.bg}DD`,borderRadius:7,padding:"4px 10px",fontSize:11,color:C.accent,fontFamily:F.mono,zIndex:999 }}>LIVE NAV</div>
        </div>
        <div style={{ padding:12 }}>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${route.stopsList[curIdx]?.lat},${route.stopsList[curIdx]?.lng}&travelmode=driving`}
            target="_blank" rel="noreferrer"
            style={{ display:"block", background:`${C.accent}18`, color:C.accent,
              border:`1px solid ${C.accent}33`, borderRadius:9, padding:"9px 0",
              textAlign:"center", textDecoration:"none", fontWeight:600, fontSize:13 }}>
            Open in Google Maps →
          </a>
        </div>
      </div>

      <div style={{ background:`${C.yellow}0A`, border:`1px solid ${C.yellow}33`, borderRadius:14, padding:16 }}>
        <div style={{ fontWeight:700, fontSize:13, color:C.yellow, marginBottom:6 }}>⚡ Route Update</div>
        <p style={{ margin:0, fontSize:13, color:C.dimText, lineHeight:1.6 }}>
          Take Junipero Serra Blvd instead of El Camino Real — saves ~19 minutes.
        </p>
        <button style={{ marginTop:10, background:`${C.yellow}22`, color:C.yellow,
          border:`1px solid ${C.yellow}33`, borderRadius:8, padding:"6px 16px",
          fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:F.body }}>Got it ✓</button>
      </div>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:16 }}>
        <div style={{ fontFamily:F.display, fontSize:15, fontWeight:700, marginBottom:12 }}>Next Stops</div>
        {upNext.map((s,i)=>(
          <div key={i} style={{ background: s.current?`${C.accent}12`:C.surface,
            border:`1px solid ${s.current?C.accent+"44":C.border}`,
            borderRadius:10, padding:"11px 14px", marginBottom:8,
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontFamily:F.mono, fontSize:10,
                color: s.current?C.accent:C.mutedText, fontWeight:700 }}>#{s.num}</span>
              <span style={{ fontSize:13, fontWeight: s.current?600:400, color:C.white }}>{s.address}</span>
            </div>
            <Badge color={s.current?C.accent:C.mutedText}>{s.packages}pkg</Badge>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        <KPI icon="⏱" label="Avg Stop" value="3.8m" color={C.yellow}/>
        <KPI icon="📦" label="Delivered" value="83" color={C.green}/>
        <KPI icon="🏃" label="On-Time" value="96%" color={C.accent}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  ROOT APP
// ─────────────────────────────────────────────
const DISPATCHER_NAV = [
  {icon:"◈",label:"Overview"},
  {icon:"⊕",label:"Route Builder",badge:"NEW"},
  {icon:"◎",label:"Routes"},
  {icon:"◷",label:"Drivers"},
  {icon:"◈",label:"Forecast"},
];
const OWNER_NAV = [
  {icon:"◈",label:"Dashboard"},
  {icon:"◎",label:"Analytics"},
  {icon:"⊕",label:"Integrations"},
];
const COURIER_NAV = [
  {icon:"◎",label:"My Route"},
  {icon:"◈",label:"Packages"},
  {icon:"◷",label:"My Stats"},
];

export default function App() {
  const [role, setRole] = useState(null);
  const [nav, setNav] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t=>t+1), 2500);
    return () => clearInterval(iv);
  }, []);

  const navItems = role==="Dispatcher" ? DISPATCHER_NAV : role==="Owner" ? OWNER_NAV : COURIER_NAV;

  if (!role) return (
    <>
      <style>{fonts}</style>
      <div style={{ fontFamily:F.body, background:C.bg, color:C.white, minHeight:"100vh",
        display:"flex", alignItems:"center", justifyContent:"center",
        background:"linear-gradient(140deg, #03080F 0%, #060F20 50%, #0A1830 100%)" }}>
        <div style={{ textAlign:"center", maxWidth:720 }}>
          <div style={{ marginBottom:8 }}>
            <span style={{ fontFamily:F.mono, fontSize:11, color:C.dimText,
              letterSpacing:"0.2em", textTransform:"uppercase" }}>San Mateo County</span>
          </div>
          <h1 style={{ fontFamily:F.display, fontSize:"clamp(72px,10vw,110px)", fontWeight:800,
            letterSpacing:"-0.02em", lineHeight:1, margin:"0 0 4px",
            color:C.white, textShadow:`0 0 60px ${C.accentGlow}` }}>
            HOMER<span style={{ fontSize:"0.6em", fontWeight:700, color:C.silver, opacity:0.8 }}>.io</span>
          </h1>
          <p style={{ fontSize:14, color:C.dimText, marginBottom:48, letterSpacing:"0.12em",
            textTransform:"uppercase", fontWeight:500 }}>AI-Powered Logistics Intelligence</p>
          <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
            {[
              {r:"Dispatcher",icon:"◈",desc:"Manage fleet, build routes, action AI suggestions"},
              {r:"Owner",icon:"◎",desc:"Revenue, profit analytics, and optimization insights"},
              {r:"Courier",icon:"◷",desc:"Your deliveries, live navigation, and updates"},
            ].map(({r,icon,desc})=>(
              <button key={r} onClick={()=>setRole(r)}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.background=`${C.accent}0C`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.card;}}
                style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16,
                  padding:"28px 24px", width:210, cursor:"pointer",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:12,
                  fontFamily:F.body, transition:"all 0.2s", outline:"none" }}>
                <span style={{ fontSize:32, color:C.accent }}>{icon}</span>
                <span style={{ fontFamily:F.display, fontSize:20, fontWeight:700, color:C.white }}>{r}</span>
                <span style={{ fontSize:12, color:C.dimText, lineHeight:1.6, textAlign:"center" }}>{desc}</span>
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:40 }}>
            {INTEGRATIONS.filter(i=>i.status==="connected").map(i=>(
              <Badge key={i.name} color={C.green}>{i.icon} {i.name}</Badge>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{fonts}</style>
      <div style={{ fontFamily:F.body, background:C.bg, color:C.white, minHeight:"100vh",
        display:"flex", flexDirection:"column" }}>
        {/* Top bar */}
        <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 24px", height:58, position:"sticky", top:0, zIndex:200 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontFamily:F.display, fontSize:24, fontWeight:800, color:C.white,
              letterSpacing:"-0.01em" }}>
              HOMER<span style={{ fontSize:"0.65em", fontWeight:700, color:C.silver, opacity:0.75 }}>.io</span>
            </span>
            <span style={{ fontFamily:F.mono, fontSize:10, color:C.mutedText,
              letterSpacing:"0.12em", textTransform:"uppercase" }}>{role}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:C.green,
                boxShadow:`0 0 ${tick%2===0?"8px":"3px"} ${C.green}`,
                transition:"box-shadow 0.6s ease" }} />
              <span style={{ fontSize:11, color:C.dimText }}>Live</span>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {["Dispatcher","Owner","Courier"].map(r=>(
                <button key={r} onClick={()=>{setRole(r);setNav(0);}}
                  style={{ background: role===r ? C.accent : "transparent",
                    color: role===r ? C.bg : C.dimText,
                    border:`1px solid ${role===r ? C.accent : C.border}`,
                    borderRadius:8, padding:"5px 14px", fontSize:12,
                    fontWeight:600, cursor:"pointer", fontFamily:F.body,
                    transition:"all 0.15s" }}>{r}</button>
              ))}
            </div>
          </div>
        </header>

        <div style={{ display:"flex", flex:1 }}>
          {/* Sidebar */}
          <nav style={{ width:210, background:C.surface, borderRight:`1px solid ${C.border}`,
            padding:"16px 0", display:"flex", flexDirection:"column", gap:2, flexShrink:0 }}>
            {navItems.map((item,i)=>(
              <NavItem key={i} icon={item.icon} label={item.label}
                active={nav===i} onClick={()=>setNav(i)} badge={item.badge}/>
            ))}
            <div style={{ flex:1 }}/>
            <div style={{ padding:"12px 20px", borderTop:`1px solid ${C.border}` }}>
              <div style={{ fontFamily:F.mono, fontSize:11, color:C.mutedText }}>v1.4.0</div>
            </div>
          </nav>

          {/* Main */}
          <main style={{ flex:1, padding:24, overflowY:"auto", maxHeight:"calc(100vh - 58px)" }}>
            <div style={{ marginBottom:20 }}>
              <h1 style={{ fontFamily:F.display, fontSize:26, fontWeight:700,
                margin:"0 0 4px", letterSpacing:"-0.01em" }}>
                {navItems[nav]?.label}
              </h1>
              <p style={{ fontSize:13, color:C.dimText, margin:0 }}>
                {role==="Dispatcher"&&nav===0 && "Real-time fleet intelligence for San Mateo County"}
                {role==="Dispatcher"&&nav===1 && "Click the map to place stops · Drag to move · AI optimizes the sequence"}
                {role==="Dispatcher"&&nav>=2 && "Real-time fleet intelligence for San Mateo County"}
                {role==="Owner" && "Business performance and fleet profitability"}
                {role==="Courier" && "Your active route and delivery dashboard"}
              </p>
            </div>

            {role==="Dispatcher" && nav===0 && <Dispatcher onNav={setNav}/>}
            {role==="Dispatcher" && nav===1 && <RouteBuilder/>}
            {role==="Dispatcher" && nav>=2 && <Dispatcher onNav={setNav}/>}
            {role==="Owner" && <Owner/>}
            {role==="Courier" && <Courier/>}
          </main>
        </div>
      </div>
    </>
  );
}

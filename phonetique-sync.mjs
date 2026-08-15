#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// phonetique-sync — petit serveur de synchro pour le réseau local.
//
//   node phonetique-sync.mjs
//
// Il fait deux choses :
//   • il sert index.html, pour que le téléphone puisse ouvrir l'appli
//     dans son navigateur (un téléphone ne peut pas lancer l'appli depuis
//     un partage Windows) ;
//   • il garde un seul phonetique-donnees.json que tous les appareils
//     fusionnent (Grenier, Répertoire, scores, réglages).
//
// Aucune dépendance : Node 18+ suffit. Rien ne sort de ton réseau local.
// ──────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import https from 'node:https';
import { deflateSync } from 'node:zlib';
import { createCA, createServerCert } from './phonetique-cert.mjs';
import { readFile, writeFile, rename, mkdir, readdir, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { networkInterfaces, hostname } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE       = dirname(fileURLToPath(import.meta.url));
const PORT       = Number(process.env.PORT || 8790);
const APP        = resolve(process.env.PHON_APP  || join(HERE, 'index.html'));
const DATA       = resolve(process.env.PHON_DATA || join(HERE, 'phonetique-donnees.json'));
const BACKUPS    = join(dirname(DATA), 'phonetique-copies');
// Les images vivent dans IndexedDB côté navigateur — une base interne, liée à
// l'adresse d'où l'appli est ouverte, et que rien ne sauvegarde. Ici, elles
// deviennent de vrais fichiers que tu peux voir, copier et archiver.
const IMGDIR     = resolve(process.env.PHON_IMAGES || join(dirname(DATA), 'phonetique-images'));
const MAX_BODY   = 64 * 1024 * 1024;
const KEEP       = 30;
const HTTPS_PORT = PORT + 1;
const CERTDIR    = join(dirname(DATA), 'phonetique-certs');
const APPNAME    = 'phonetique';
// Quand le PC porte plusieurs adresses, PHON_HOST dit laquelle mettre en avant.
// Utile pour donner à Phonétique une adresse bien à elle : sur Android, le
// raccourci créé à l'installation revendique l'hôte entier sans regarder le
// port, donc deux applis servies depuis la même adresse se marchent dessus.
const PREF       = (process.env.PHON_HOST || '').trim();
// standalone : plus de barre d'adresse, on garde l'heure et la batterie.
// fullscreen : l'écran entier, y compris la barre d'état d'Android.
const DISPLAY    = ['standalone','fullscreen','minimal-ui'].includes(process.env.PHON_DISPLAY)
                   ? process.env.PHON_DISPLAY : 'standalone';

// Écriture atomique : on écrit à côté puis on renomme, pour qu'une coupure
// de courant ne puisse jamais laisser un fichier de données à moitié écrit.
async function writeAtomic(file, text){
  const tmp = file + '.tmp-' + process.pid;
  await writeFile(tmp, text, 'utf8');
  await rename(tmp, file);
}

// Une copie horodatée avant chaque écrasement — la seule vraie protection
// contre un appareil qui enverrait un état appauvri.
async function keepBackup(){
  if(!existsSync(DATA)) return;
  try{
    await mkdir(BACKUPS, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    await writeFile(join(BACKUPS, `donnees-${stamp}.json`), await readFile(DATA, 'utf8'), 'utf8');
    const files = (await readdir(BACKUPS)).filter(f=>f.endsWith('.json')).sort();
    for(const old of files.slice(0, Math.max(0, files.length - KEEP))){
      await unlink(join(BACKUPS, old)).catch(()=>{});
    }
  }catch(err){ console.warn('  ! sauvegarde impossible :', err.message); }
}

// ── certificats ──────────────────────────────────────────────────────────
// L'autorité est créée une seule fois et gardée ; seul le certificat du
// serveur est refait quand les adresses du PC changent ou qu'il expire, pour
// que le certificat installé sur le téléphone reste valable.
async function ensureCerts(hosts){
  await mkdir(CERTDIR, { recursive: true });
  const f = n => join(CERTDIR, n);
  let ca = null;
  try{
    ca = { caCert: await readFile(f('phonetique-ca.crt'),'utf8'), caKey: await readFile(f('ca.key'),'utf8') };
  }catch{
    ca = createCA(APPNAME);
    await writeFile(f('phonetique-ca.crt'), ca.caCert, 'utf8');
    await writeFile(f('ca.key'), ca.caKey, 'utf8');
    console.log('  autorité locale créée (à installer une fois sur le téléphone)');
  }
  let meta = null;
  try{ meta = JSON.parse(await readFile(f('meta.json'),'utf8')); }catch{}
  const same  = meta && JSON.stringify(meta.hosts) === JSON.stringify(hosts);
  const fresh = meta && new Date(meta.expires).getTime() - Date.now() > 30 * 86400 * 1000;
  if(!same || !fresh){
    const srv = createServerCert({ ...ca, hosts, label: APPNAME });
    await writeFile(f('server.crt'), srv.cert, 'utf8');
    await writeFile(f('server.key'), srv.key, 'utf8');
    await writeFile(f('meta.json'), JSON.stringify({ hosts, expires: srv.expires }, null, 1), 'utf8');
    if(meta) console.log('  certificat serveur renouvelé (adresses changées ou expiration proche)');
  }
  return {
    ca:   ca.caCert,
    cert: await readFile(f('server.crt'),'utf8'),
    key:  await readFile(f('server.key'),'utf8'),
  };
}

// ── icône de l'application (PNG écrit à la main, zlib suffit) ─────────────
const CRC = (() => { const t = new Int32Array(256);
  for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xedb88320 ^ (c>>>1) : c>>>1; t[n]=c; }
  return b => { let c = -1; for(const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();
function pngChunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type,'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}
// Un spectre sonore stylisé, aux couleurs de l'appli (bleu/violet sur fond nuit).
function appIcon(size = 512){
  const px = Buffer.alloc(size * size * 4);
  const set = (x,y,r,g,b) => { const i = (y*size+x)*4; px[i]=r; px[i+1]=g; px[i+2]=b; px[i+3]=255; };
  const bars = [0.30, 0.55, 0.85, 0.62, 0.38];        // hauteurs relatives
  const barW = size * 0.09, gap = size * 0.055;
  const total = bars.length * barW + (bars.length - 1) * gap;
  const x0 = (size - total) / 2, mid = size / 2;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    let r=5,g=6,b=15;                                  // --bg #05060F
    for(let i=0;i<bars.length;i++){
      const bx = x0 + i * (barW + gap);
      const h  = size * bars[i] / 2;
      if(x >= bx && x < bx + barW && y >= mid - h && y < mid + h){
        // dégradé bleu → violet d'une barre à l'autre (--blue vers --purple)
        const t = i / (bars.length - 1);
        r = Math.round(79  + (139 - 79)  * t);
        g = Math.round(142 + (92  - 142) * t);
        b = Math.round(247 + (246 - 247) * t);
      }
    }
    set(x,y,r,g,b);
  }
  const raw = Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++){
    raw[y*(size*4+1)] = 0;
    px.copy(raw, y*(size*4+1)+1, y*size*4, (y+1)*size*4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, {level:9})), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
let ICON = null;

// ── ce qui rend l'appli installable et utilisable hors réseau ────────────
const MANIFEST = JSON.stringify({
  // « id » donne son identité à l'application installée. Sans lui, le
  // navigateur la déduit de start_url — « / » — c'est-à-dire la même valeur
  // que noter, qui tourne sur la même machine. D'où un navigateur qui propose
  // « ouvrir noter » au lieu d'installer Phonétique.
  id: 'phonetique-app',
  name: 'Phonétique', short_name: 'Phonétique',
  description: 'Entraînement à la prononciation française et coréenne',
  start_url: '/?app=phonetique', scope: '/',
  display: DISPLAY, background_color: '#05060F', theme_color: '#05060F',
  lang: 'fr',
  icons: [
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 1);

// Réseau d'abord pour l'appli (tu as toujours la dernière version quand le PC
// est là), cache en secours quand tu es dehors. Les données ne sont jamais
// mises en cache : elles doivent venir du serveur ou pas du tout.
const SERVICE_WORKER = `
const CACHE = 'phonetique-shell-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET') return;
  // Les polices et le SDK vocal vivent sur d'autres domaines : on les laisse
  // passer sans y toucher. Les mettre en cache n'apporterait rien et les
  // reponses opaques ne s'y stockent pas.
  if(url.origin !== location.origin) return;
  if(url.pathname === '/donnees' || url.pathname === '/health') return;   // jamais en cache
  const key = (e.request.mode === 'navigate' || url.pathname === '/index.html') ? '/' : e.request;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(key, copy)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(key).then(r => {
        if(r) return r;
        // Ne renvoyer la page d'accueil QUE pour une navigation. La renvoyer
        // a la place d'un script ferait executer du HTML comme du JavaScript
        // ("Unexpected token '<'") au lieu d'un simple echec reseau.
        if(e.request.mode === 'navigate') return caches.match('/');
        return Response.error();
      }))
  );
});
`;

function send(res, code, body, type='application/json; charset=utf-8', extra={}){
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    // le réseau local uniquement — permet aussi à un index.html ouvert
    // en fichier local (origine "null") de parler à ce serveur
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Access-Control-Allow-Headers': 'Content-Type',
    // Private Network Access : Chrome traite une page locale (file://) comme
    // « publique », et bloque ses requêtes vers une adresse privée 192.168.x.x
    // sauf si la réponse au préliminaire porte cet en-tête. Android l'applique
    // strictement, ChromeOS beaucoup moins — d'où un Chromebook qui marche et
    // un téléphone qui échoue avec la même configuration.
    'Access-Control-Allow-Private-Network': 'true',
    ...extra,
  });
  res.end(body);
}

// Le serveur ne fusionne rien : il garde le dernier état complet envoyé par un
// appareil, qui a déjà fusionné le distant avec son local. Il vérifie seulement
// que ce qu'il reçoit ressemble à des données de Phonétique — un JSON valide
// mais étranger écraserait tout.
function looksLikePhonetique(o){
  if(!o || typeof o !== 'object') return 'ce n\'est pas un objet';
  if(o._app && o._app !== 'phonetique') return `ces données viennent de « ${o._app} »`;
  const g = o.grenier, r = o.repertoire;
  if(!g || !Array.isArray(g.cards) || !Array.isArray(g.decks)) return 'il manque le Grenier';
  if(!r || !Array.isArray(r.words) || !Array.isArray(r.folders)) return 'il manque le Répertoire';
  return null;
}

// ── images ───────────────────────────────────────────────────────────────
const IMG_TYPES = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp',
                    'image/gif':'gif', 'image/avif':'avif' };
const EXT_TYPES = Object.fromEntries(Object.entries(IMG_TYPES).map(([t,e]) => [e,t]));
// Une clé vient du navigateur : elle ne doit jamais pouvoir désigner un chemin.
const safeKey = k => /^[A-Za-z0-9._-]{1,120}$/.test(k) && !k.includes('..') ? k : null;

let imgIndex = null;                       // clé → nom de fichier
async function imgList(){
  if(imgIndex) return imgIndex;
  imgIndex = new Map();
  try{
    for(const f of await readdir(IMGDIR)){
      const dot = f.lastIndexOf('.');
      if(dot > 0) imgIndex.set(f.slice(0, dot), f);
    }
  }catch{ /* dossier pas encore créé */ }
  return imgIndex;
}

async function readBody(req, max){
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if(size > max){ reject(new Error('trop volumineux')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if(req.method === 'OPTIONS'){
    const want = req.headers['access-control-request-headers'];
    return send(res, 204, '', 'text/plain', {
      ...(want ? { 'Access-Control-Allow-Headers': want } : {}),
      'Access-Control-Max-Age': '600',
    });
  }

  // ── les données ──
  if(path === '/donnees'){
    if(req.method === 'GET'){
      if(!existsSync(DATA)) return send(res, 404, '{"error":"aucune donnée encore"}');
      try{ return send(res, 200, await readFile(DATA, 'utf8')); }
      catch(err){ return send(res, 500, JSON.stringify({ error: err.message })); }
    }
    if(req.method === 'PUT'){
      let size = 0;
      const chunks = [];
      req.on('data', c => {
        size += c.length;
        if(size > MAX_BODY){ res.writeHead(413); res.end(); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', async () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed;
        try{ parsed = JSON.parse(text); }
        catch{ return send(res, 400, '{"error":"JSON invalide"}'); }
        const why = looksLikePhonetique(parsed);
        if(why) return send(res, 400, JSON.stringify({ error: why }));
        try{
          await keepBackup();
          await writeAtomic(DATA, JSON.stringify(parsed, null, 1));
          const c = parsed.grenier.cards.filter(x => !x.deleted).length;
          const m = parsed.repertoire.words.length;
          console.log(`  ← ${new Date().toLocaleTimeString('fr-FR')}  ${c} carte${c!==1?'s':''}, ${m} mot${m!==1?'s':''}`);
          send(res, 200, JSON.stringify({ ok:true, cartes:c, mots:m }));
        }catch(err){ send(res, 500, JSON.stringify({ error: err.message })); }
      });
      return;
    }
    return send(res, 405, '{"error":"méthode non permise"}');
  }

  // ── les images ──
  // La liste, pour que l'appli sache lesquelles restent à envoyer.
  if(path === '/images' && req.method === 'GET'){
    const idx = await imgList();
    return send(res, 200, JSON.stringify({ dossier: IMGDIR, cles: [...idx.keys()] }));
  }
  if(path.startsWith('/images/')){
    const key = safeKey(decodeURIComponent(path.slice('/images/'.length)));
    if(!key) return send(res, 400, '{"error":"clé invalide"}');

    if(req.method === 'PUT'){
      const type = (req.headers['content-type'] || '').split(';')[0].trim();
      const ext = IMG_TYPES[type];
      if(!ext) return send(res, 415, JSON.stringify({ error: `type non accepté : ${type || 'absent'}` }));
      try{
        const body = await readBody(req, MAX_BODY);
        await mkdir(IMGDIR, { recursive: true });
        const name = `${key}.${ext}`;
        // Même écriture atomique que pour les données : jamais de fichier
        // à moitié écrit si le réseau ou le courant lâche.
        const tmp = join(IMGDIR, name + '.tmp-' + process.pid);
        await writeFile(tmp, body);
        await rename(tmp, join(IMGDIR, name));
        (await imgList()).set(key, name);
        console.log(`  ← ${new Date().toLocaleTimeString('fr-FR')}  image ${name} (${Math.round(body.length/1024)} Ko)`);
        return send(res, 200, JSON.stringify({ ok:true, fichier:name }));
      }catch(err){ return send(res, 500, JSON.stringify({ error: err.message })); }
    }

    if(req.method === 'GET'){
      const name = (await imgList()).get(key);
      if(!name) return send(res, 404, '{"error":"image inconnue"}');
      try{
        const buf = await readFile(join(IMGDIR, name));
        const ext = name.slice(name.lastIndexOf('.') + 1);
        return send(res, 200, buf, EXT_TYPES[ext] || 'application/octet-stream');
      }catch{ return send(res, 404, '{"error":"fichier introuvable"}'); }
    }
    return send(res, 405, '{"error":"méthode non permise"}');
  }

  // ── l'application ──
  if(req.method === 'GET' && (path === '/' || path === '/index.html')){
    try{
      const html = await readFile(APP, 'utf8');
      // ?download=1 → garde une copie sur l'appareil. Indispensable pour le
      // téléphone : une adresse http://192.168… n'est pas un contexte
      // sécurisé, donc pas de service worker, donc rien ne s'ouvre hors du
      // réseau. La copie locale, elle, s'ouvre partout.
      const extra = url.searchParams.get('download')
        ? { 'Content-Disposition': 'attachment; filename="phonetique.html"' } : {};
      return send(res, 200, html, 'text/html; charset=utf-8', extra);
    }catch{
      return send(res, 404, 'index.html introuvable à côté de ce script', 'text/plain; charset=utf-8');
    }
  }

  // ── ce qu'il faut pour installer l'appli sur le téléphone ──
  if(req.method === 'GET' && path === '/manifest.webmanifest')
    return send(res, 200, MANIFEST, 'application/manifest+json; charset=utf-8');
  if(req.method === 'GET' && path === '/sw.js')
    return send(res, 200, SERVICE_WORKER, 'text/javascript; charset=utf-8');
  if(req.method === 'GET' && path === '/icon-512.png'){
    if(!ICON) ICON = appIcon(512);
    return send(res, 200, ICON, 'image/png');
  }
  // L'autorité à installer sur le téléphone. Servie en clair exprès : le
  // téléphone ne peut pas encore faire confiance au https tant qu'il ne l'a pas.
  if(req.method === 'GET' && path === '/ca.crt'){
    try{
      return send(res, 200, await readFile(join(CERTDIR,'phonetique-ca.crt'),'utf8'),
        'application/x-x509-ca-cert', { 'Content-Disposition': 'attachment; filename="phonetique-ca.crt"' });
    }catch{ return send(res, 404, '{"error":"pas encore de certificat"}'); }
  }

  // L'appli interroge /health pour apprendre toutes les adresses de ce PC.
  // Si l'IP change, elle bascule seule sur une autre au lieu de tomber en panne.
  if(path === '/health'){
    const secure = !!req.socket.encrypted;
    return send(res, 200, JSON.stringify({
      ok: true, name: hostname(), app: 'phonetique', secure,
      images: IMGDIR,
      addresses: candidateURLs(secure),      // même protocole : une page https
      https: candidateURLs(true),            // ne peut pas parler à du http
    }));
  }
  send(res, 404, '{"error":"introuvable"}');
});

function lanAddresses(){
  const out = [];
  for(const list of Object.values(networkInterfaces())){
    for(const ni of list || []){
      if(ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}
// Le nom .local (mDNS) survit à un changement d'IP, donc il vaut la peine
// d'être proposé même s'il ne marche pas sur tous les réseaux.
function mdnsName(){
  const h = (hostname() || '').split('.')[0].trim().toLowerCase();
  return h ? `${h}.local` : null;
}
function certHosts(){
  const h = lanAddresses();
  const m = mdnsName();
  if(PREF) h.unshift(PREF);
  if(m) h.push(m);
  h.push('localhost', '127.0.0.1');
  return [...new Set(h)];
}
function candidateURLs(secure){
  const m = mdnsName();
  // L'IP d'abord, toujours : Android ne sait généralement pas résoudre un nom
  // .local, alors que Windows résout le sien — d'où une adresse qui marche sur
  // le PC et reste introuvable depuis le téléphone.
  let ordered = [...lanAddresses(), ...(m ? [m] : [])];
  if(PREF) ordered = [PREF, ...ordered.filter(h => h !== PREF)];
  return ordered.map(h => secure ? `https://${h}:${HTTPS_PORT}` : `http://${h}:${PORT}`);
}

const handler = server.listeners('request')[0];

server.listen(PORT, '0.0.0.0', async () => {
  let cards = 0;
  if(existsSync(DATA)){
    try{ cards = JSON.parse(await readFile(DATA,'utf8')).grenier?.cards?.filter(c=>!c.deleted).length ?? 0; }catch{}
  }
  console.log('\n  phonetique-sync');
  console.log('  ' + '─'.repeat(52));
  console.log(`  données    ${DATA}${existsSync(DATA) ? `  (${cards} cartes)` : '  (nouveau)'}`);
  console.log(`  copies     ${BACKUPS}  (${KEEP} dernières)`);
  let nImg = 0;
  try{ nImg = (await readdir(IMGDIR)).filter(f => !f.includes('.tmp-')).length; }catch{}
  console.log(`  images     ${IMGDIR}${nImg ? `  (${nImg})` : '  (vide)'}`);

  let sec = null;
  try{
    sec = await ensureCerts(certHosts());
    const secure = https.createServer({ key: sec.key, cert: sec.cert }, handler);
    secure.on('error', e => console.warn('  ! https indisponible :', e.message));
    secure.listen(HTTPS_PORT, '0.0.0.0');
  }catch(err){
    console.warn('  ! certificat impossible à préparer :', err.message);
  }

  console.log('');
  console.log('  ORDINATEUR ET CHROMEBOOK  (adresse à coller dans la synchro)');
  candidateURLs(false).forEach(u => console.log(`      ${u}`));
  if(sec){
    console.log('');
    const ip = PREF || lanAddresses()[0] || 'localhost';
    console.log('  TÉLÉPHONE  (application installable, marche hors du réseau)');
    console.log(`   1. installe l'autorité :  http://${ip}:${PORT}/ca.crt`);
    console.log(`   2. puis ouvre :           https://${ip}:${HTTPS_PORT}`);
    console.log('   3. menu du navigateur › « Installer l\'application »');
    console.log('');
    console.log('   Prends bien l\'adresse en chiffres ci-dessus : Android ne sait');
    console.log('   généralement pas résoudre les noms .local, même si le certificat');
    console.log('   les couvre et qu\'ils marchent depuis le PC.');
    console.log('   Une application installée reste liée à cette adresse : pense à');
    console.log('   réserver l\'IP du PC dans ta box pour qu\'elle ne change pas.');
  }
  console.log('');
  console.log('  Laisse cette fenêtre ouverte. Ctrl+C pour arrêter.\n');
});

server.on('error', err => {
  if(err.code === 'EADDRINUSE') console.error(`\n  Le port ${PORT} est déjà pris. Essaie :  PORT=8792 node phonetique-sync.mjs\n`);
  else console.error('\n  ', err.message, '\n');
  process.exit(1);
});

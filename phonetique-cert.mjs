// ──────────────────────────────────────────────────────────────────────────
// phonetique-cert — fabrique un certificat pour le serveur local.
//
// Pourquoi : un navigateur n'installe une application hors-ligne que sur une
// adresse https://. Il faut donc un certificat, et sur un réseau local aucune
// autorité publique ne peut en délivrer un. On crée donc sa propre petite
// autorité (le fichier phonetique-ca.crt à installer une fois sur le téléphone),
// qui signe le certificat du serveur.
//
// Écrit à la main en DER/ASN.1 parce que Node ne sait pas générer de
// certificat et qu'on ne veut aucune dépendance à installer.
// ──────────────────────────────────────────────────────────────────────────

import { generateKeyPairSync, createSign, createHash, randomBytes, createPrivateKey, createPublicKey } from 'node:crypto';

// ── briques DER ──
function derLen(n){
  if(n < 0x80) return Buffer.from([n]);
  const b = [];
  for(let v = n; v > 0; v >>= 8) b.unshift(v & 0xff);
  return Buffer.from([0x80 | b.length, ...b]);
}
const tlv = (tag, payload) => {
  const p = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  return Buffer.concat([Buffer.from([tag]), derLen(p.length), p]);
};
const SEQ    = p => tlv(0x30, p);
const SET    = p => tlv(0x31, p);
const OCTSTR = p => tlv(0x04, p);
const BOOL   = v => tlv(0x01, Buffer.from([v ? 0xff : 0x00]));
const NULL   = () => tlv(0x05, Buffer.alloc(0));
const UTF8   = s => tlv(0x0c, Buffer.from(s, 'utf8'));
const ctxC   = (n, p) => tlv(0xa0 | n, p);            // constructed [n]
const ctxP   = (n, p) => tlv(0x80 | n, p);            // primitive   [n]
const BITSTR = p => tlv(0x03, Buffer.concat([Buffer.from([0]), p]));

function INT(input){
  let v = Buffer.isBuffer(input) ? Buffer.from(input) : Buffer.from([input]);
  let i = 0;
  while(i < v.length - 1 && v[i] === 0) i++;      // no redundant leading zeros
  v = v.subarray(i);
  if(v[0] & 0x80) v = Buffer.concat([Buffer.from([0]), v]);   // stay positive
  return tlv(0x02, v);
}
function OID(dotted){
  const p = dotted.split('.').map(Number);
  const out = [p[0] * 40 + p[1]];
  for(const n of p.slice(2)){
    const stack = [n & 0x7f];
    for(let v = n >> 7; v > 0; v >>= 7) stack.unshift((v & 0x7f) | 0x80);
    out.push(...stack);
  }
  return tlv(0x06, Buffer.from(out));
}
function utcTime(d){
  const z = n => String(n).padStart(2, '0');
  return tlv(0x17, Buffer.from(
    z(d.getUTCFullYear() % 100) + z(d.getUTCMonth()+1) + z(d.getUTCDate()) +
    z(d.getUTCHours()) + z(d.getUTCMinutes()) + z(d.getUTCSeconds()) + 'Z', 'ascii'));
}

const OID_CN   = '2.5.4.3';
const OID_O    = '2.5.4.10';
const ALG_SHA256RSA = SEQ(Buffer.concat([OID('1.2.840.113549.1.1.11'), NULL()]));

const rdn = (type, value) => SET(SEQ(Buffer.concat([OID(type), UTF8(value)])));
const dn  = (cn, org) => SEQ(Buffer.concat([rdn(OID_O, org), rdn(OID_CN, cn)]));

function extension(id, critical, valueDer){
  const parts = [OID(id)];
  if(critical) parts.push(BOOL(true));
  parts.push(OCTSTR(valueDer));
  return SEQ(Buffer.concat(parts));
}
// keyUsage is a bit string counted from the most significant bit
function keyUsage(bits){
  let byte = 0, highest = 0;
  for(const b of bits){ byte |= 0x80 >> b; highest = Math.max(highest, b); }
  return tlv(0x03, Buffer.from([7 - highest, byte]));
}
function subjectAltName(hosts){
  return SEQ(Buffer.concat(hosts.map(h =>
    /^\d{1,3}(\.\d{1,3}){3}$/.test(h)
      ? ctxP(7, Buffer.from(h.split('.').map(Number)))    // iPAddress
      : ctxP(2, Buffer.from(h, 'ascii')))));              // dNSName
}
// Android and Chrome both want a certificate that names itself and its issuer
const keyId = spkiDer => createHash('sha1').update(spkiDer).digest();

function makeCert({ subject, issuer, spki, issuerKey, days, ca, hosts, issuerSpki }){
  const now = new Date(Date.now() - 60 * 60 * 1000);          // a little slack for clock drift
  const end = new Date(now.getTime() + days * 86400 * 1000);
  const exts = [];
  exts.push(extension('2.5.29.19', true,
    ca ? SEQ(Buffer.concat([BOOL(true)])) : SEQ(Buffer.alloc(0))));            // basicConstraints
  exts.push(extension('2.5.29.15', true, keyUsage(ca ? [5,6] : [0,2])));       // keyUsage
  if(!ca){
    exts.push(extension('2.5.29.37', false, SEQ(OID('1.3.6.1.5.5.7.3.1'))));   // serverAuth
    exts.push(extension('2.5.29.17', false, subjectAltName(hosts)));           // subjectAltName
  }
  exts.push(extension('2.5.29.14', false, OCTSTR(keyId(spki))));               // subjectKeyIdentifier
  exts.push(extension('2.5.29.35', false,
    SEQ(ctxP(0, keyId(issuerSpki || spki)))));                                 // authorityKeyIdentifier

  const tbs = SEQ(Buffer.concat([
    ctxC(0, INT(2)),                       // v3
    INT(randomBytes(16)),                  // serial
    ALG_SHA256RSA,
    issuer,
    SEQ(Buffer.concat([utcTime(now), utcTime(end)])),
    subject,
    spki,
    ctxC(3, SEQ(Buffer.concat(exts))),
  ]));

  const sig = createSign('sha256').update(tbs).sign(issuerKey);
  return SEQ(Buffer.concat([tbs, ALG_SHA256RSA, BITSTR(sig)]));
}

const pem = (der, label) =>
  `-----BEGIN ${label}-----\n` +
  (der.toString('base64').match(/.{1,64}/g) || []).join('\n') +
  `\n-----END ${label}-----\n`;

// Chrome refuses a server certificate valid for more than 398 days, so the
// leaf is short-lived while the authority you install once on the phone lasts
// for years.
//
// The authority is created ONCE and reused: if it changed every time the PC
// got a new IP address, you would have to reinstall it on the phone each time.
export function createCA(label = 'phonetique'){
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const spki = keys.publicKey.export({ type: 'spki', format: 'der' });
  const name = dn(`${label} (autorité locale)`, label);
  const der  = makeCert({
    subject: name, issuer: name, spki,
    issuerKey: keys.privateKey, days: 3650, ca: true,
  });
  return {
    caCert: pem(der, 'CERTIFICATE'),
    caKey:  keys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

export function createServerCert({ caCert, caKey, hosts, label = 'phonetique' }){
  const caPriv = createPrivateKey(caKey);
  const caSpki = createPublicKey(caPriv).export({ type: 'spki', format: 'der' });
  const keys   = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const spki   = keys.publicKey.export({ type: 'spki', format: 'der' });
  const der    = makeCert({
    subject: dn(hosts[0] || label, label),
    issuer:  dn(`${label} (autorité locale)`, label),
    spki, issuerKey: caPriv, issuerSpki: caSpki,
    days: 397, ca: false, hosts,
  });
  return {
    cert: pem(der, 'CERTIFICATE') + caCert,          // full chain
    key:  keys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    hosts,
    expires: new Date(Date.now() + 397 * 86400 * 1000).toISOString(),
  };
}

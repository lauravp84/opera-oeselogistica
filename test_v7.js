// Validação v7 — roda a lógica do index.html num DOM falso + testa api/state.js com KV mock
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/vercel/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/init\(\);\s*$/, '')
  .replace('let S=', 'S=')
  .replace('let WHO=', 'WHO=')
  .replace('let remote=false,saveTimer=null;', 'remote=false;saveTimer=null;');

// ---- fake DOM ----
function el() {
  return { innerHTML: '', textContent: '', style: {}, className: '', value: '', disabled: false,
    classList: { add(){}, remove(){}, toggle(){} }, appendChild(){}, addEventListener(){},
    click(){ clicked.push(this.download); }, remove(){}, href: '', download: '' };
}
const els = {}; const clicked = [];
global.document = {
  getElementById: id => (els[id] = els[id] || el()),
  querySelectorAll: () => [], createElement: () => el(),
  body: { appendChild(){} }, addEventListener(){}, hidden: false
};
global.window = { scrollTo(){}, print(){} };
global.localStorage = { _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=v;}, removeItem(k){delete this._d[k];} };
global.alert = m => { throw new Error('alert: ' + m); };
global.confirm = () => true;
global.navigator = { clipboard: { writeText(){} } };
let blobText = null;
global.Blob = class { constructor(parts){ blobText = parts.join(''); } };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL(){} };
global.fetch = async () => { throw new Error('no net'); }; // modo local

eval(script); // define S, decide, computeDecisions, mergeRemote, buildAta, downloadAta, migrate...

const results = [];
function check(name, cond, extra) { results.push((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : '')); if(!cond) process.exitCode = 1; }

// ===== (a) quórum 3/3 =====
WHO = 'Laura'; decide('C3', 'manter', 'ACA330');
const after1 = !(S.conf['C3'] && S.conf['C3'].mode);
WHO = 'Carlos'; decide('C3', 'manter', 'ACA330');
const after2 = !(S.conf['C3'] && S.conf['C3'].mode);
const pm = partialMajority('C3');
WHO = 'Camila'; decide('C3', 'manter', 'ACA330');
const after3 = S.conf['C3'] && S.conf['C3'].mode === 'manter' && S.conf['C3'].by === 'consenso 3/3';
check('(a) não fecha com 1 voto', after1);
check('(a) não fecha com 2 votos iguais', after2, 'partialMajority=' + pm);
check('(a) fecha no 3º voto', !!after3, 'by=' + (S.conf['C3'] && S.conf['C3'].by));
// fechar com 2 votos (Laura)
WHO = 'Laura'; decide('C2', 'fundir', ''); WHO = 'Carlos'; decide('C2', 'fundir', '');
check('(a) C2 aberto com 2/3', !(S.conf['C2'] && S.conf['C2'].mode));
WHO = 'Camila';
let blocked = false; try { closeWith2('C2'); } catch(e) { blocked = true; }
check('(a) Camila não fecha com 2 votos', blocked && !(S.conf['C2'] && S.conf['C2'].mode));
WHO = 'Laura'; closeWith2('C2');
check('(a) Laura fecha com 2 votos', S.conf['C2'] && S.conf['C2'].mode === 'fundir' && S.conf['C2'].by === 'fechado pela coordenação com 2/3');

// ===== (b) cliente: merge no 409 =====
// estado remoto: Carlos votou diferente em C5 e tem voto em C6; local: Laura tem voto em C5
WHO = 'Laura'; decide('C5', 'manter', 'ACA425');
const remoteState = JSON.parse(JSON.stringify(S));
remoteState.version = 7;
remoteState.votes['C5'] = { Carlos: { mode: 'ambas', keep: ['ACA425','ACA455'], ts: '2026-06-12T10:00:00Z' } };
remoteState.votes['C6'] = { Camila: { mode: 'fundir', keep: [], ts: '2026-06-12T10:01:00Z' } };
mergeRemote(remoteState);
const m = S.votes;
check('(b) voto remoto de Carlos preservado', m['C5'] && m['C5'].Carlos && m['C5'].Carlos.mode === 'ambas');
check('(b) voto local de Laura preservado', m['C5'] && m['C5'].Laura && m['C5'].Laura.mode === 'manter');
check('(b) voto remoto de Camila (C6) preservado', m['C6'] && m['C6'].Camila && m['C6'].Camila.mode === 'fundir');
check('(b) version adotada do remoto', S.version === 7);

// ===== (b) servidor: 409 com version defasada =====
(async () => {
  const kvStore = {};
  const kvMock = { get: async k => kvStore[k] ?? null, set: async (k, v) => { kvStore[k] = v; } };
  const code = fs.readFileSync(__dirname + '/vercel/api/state.js', 'utf8')
    .replace("import { kv } from '@vercel/kv';", '')
    .replace('export default async function handler', 'async function handler');
  const handler = eval('(function(kv){' + code + '; return handler;})')(kvMock);
  const mkRes = () => { const r = { code: null, body: null, status(c){ this.code = c; return this; }, json(b){ this.body = b; return this; }, end(){} }; return r; };

  let r = mkRes(); await handler({ method: 'POST', body: { version: 0, conf: {}, votes: { C1: { Laura: { mode: 'fundir' } } } } }, r);
  check('(b) servidor: 1º POST ok, version=1', r.code === 200 && r.body.version === 1);
  r = mkRes(); await handler({ method: 'POST', body: { version: 0, conf: {}, votes: {} } }, r);
  check('(b) servidor: POST defasado → 409 com estado atual', r.code === 409 && r.body.version === 1 && r.body.votes.C1.Laura.mode === 'fundir');
  r = mkRes(); await handler({ method: 'POST', body: { version: 1, conf: {}, votes: { C1: { Laura: { mode: 'fundir' } }, C2: { Carlos: { mode: 'ambas' } } } } }, r);
  check('(b) servidor: POST com version correta → salva, version=2', r.code === 200 && r.body.version === 2);

  // ===== (c) export da ata =====
  buildAta();
  const tela = document.getElementById('ata').textContent;
  downloadAta();
  check('(c) conteúdo do .txt idêntico ao da tela', blobText === tela && tela.length > 100);
  check('(c) nome do arquivo Ata_Eixo_Operacoes_AAAA-MM-DD.txt', /^Ata_Eixo_Operacoes_\d{4}-\d{2}-\d{2}\.txt$/.test(clicked[0]));
  check('(c) ata contém timestamps de voto', /\(\d{2}\/\d{2}\/\d{4}/.test(tela));
  check('(c) ata contém histórico se houver', !Object.keys(S.votelog).length || tela.includes('HISTÓRICO DE ALTERAÇÕES'));

  // ===== (d) migração de estado v6 =====
  const v6 = { conf: { C1: { mode: 'fundir', keep: [], just: 'x', by: 'maioria 2/2' } }, rev: { ACA060: true }, grade: { ACA124: true }, votes: { C1: { Laura: { mode: 'fundir', keep: [] } } }, cOpt: 6, cLivre: 2, step: 3 };
  let err = null, mig;
  try { mig = migrate(JSON.parse(JSON.stringify(v6))); S = mig; computeDecisions(); buildAta(); } catch(e) { err = e.message; }
  check('(d) v6 migra sem erro', !err, err || ('version=' + mig.version + ', votelog=' + JSON.stringify(mig.votelog)));
  check('(d) version=0 e votelog={} assumidos', mig && mig.version === 0 && typeof mig.votelog === 'object');
  check('(d) dados v6 preservados (rev/grade)', mig && mig.rev.ACA060 && mig.grade.ACA124);

  console.log(results.join('\n'));
})();

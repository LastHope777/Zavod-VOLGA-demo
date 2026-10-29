/* Завод ВОЛГА, внутренние страницы: меню, переходы между страницами, анимации по прокрутке, 3D, формы.
   Один файл на все страницы: каждый блок включается, только если его разметка есть на странице. */
(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const store = {
  get(k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (_) { return null; } },
  set(k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (_) {} },
  del(k, s) { try { (s ? sessionStorage : localStorage).removeItem(k); } catch (_) {} }
};
const json = id => { const el = document.getElementById(id); try { return el ? JSON.parse(el.textContent) : null; } catch (_) { return null; } };

/* ---------- typography: short words stick to the next one, numbers to their units ---------- */
const NB_SHORT = /(^|[\s(«"„])(в|во|к|ко|с|со|у|о|об|от|до|из|за|на|над|по|под|при|про|для|без|через|и|а|но|да|или|что|как|не|ни|если|чтобы)[ \t\n\r]+(?=[^\s])/gi;
const NB_TAIL = /[ \t\n\r]+(же|ли|бы)(?=[\s.,:;!?)»]|$)/gi;
const NB_NUM = /(\d)[ \t\n\r]+(?=[А-Яа-яЁё%°№])/g;
const NB_ABBR = /(^|\s)(г\.|ул\.|д\.|к\.|т\.|№|ст\.|п\.)[ \t\n\r]+/g;
function nbText(t) { let p; do { p = t; t = t.replace(NB_SHORT, '$1$2 '); } while (t !== p); return t.replace(NB_TAIL, ' $1').replace(NB_NUM, '$1 ').replace(NB_ABBR, '$1$2 '); }
function typo(root) {
  if (root.nodeType === 3) { const p = root.parentNode; if (p && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) { const t = nbText(root.data); if (t !== root.data) root.data = t; } return; }
  if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|CANVAS)$/i.test(root.nodeName)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) || !/\s/.test(n.data) ? 2 : 1 });
  for (let n; (n = tw.nextNode());) { const t = nbText(n.data); if (t !== n.data) n.data = t; }
}
typo(document.body);
new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(typo))).observe(document.body, { childList: true, subtree: true });

/* headings rise word by word */
$$('[data-split]').forEach(el => {
  let k = 0; const walk = n => [...n.childNodes].forEach(c => {
    if (c.nodeType === 3) { const f = document.createDocumentFragment(); c.textContent.split(/([ \t\n\r]+)/).forEach(t => { if (!t) return; if (/^[ \t\n\r]+$/.test(t)) f.appendChild(document.createTextNode(t)); else { const w = document.createElement('span'); w.className = 'w'; w.innerHTML = `<span style="--d:${k++}"></span>`; w.firstChild.textContent = t; f.appendChild(w); } }); c.replaceWith(f); }
    else if (c.nodeType === 1 && !c.classList.contains('w')) walk(c); });
  walk(el); if (!reduced()) el.classList.add('split-wait');
});

/* ---------- toast ---------- */
const toastEl = $('#toast'); let toastT = 0;
function toast(t) { if (!toastEl) return; toastEl.textContent = t; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2800); }
// «Назад» goes back in history when the visitor came from this site, otherwise (an article opened in a new tab) it follows its link to the list
document.addEventListener('click', e => { const b = e.target.closest('[data-back]'); if (!b) return; let same = false; try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (_) {} if (same && history.length > 1) { e.preventDefault(); e.stopPropagation(); history.back(); } }, true);
document.addEventListener('click', e => { const s = e.target.closest('[data-soon]'); if (s) { e.preventDefault(); toast(s.dataset.soon || 'Раздел скоро появится'); } });

/* ---------- header and menu ---------- */
const top = $('#top'), menu = $('#menu'), menuBtn = $('#menuBtn');
let menuOpen = false;
function setMenu(open) {
  if (!menu) return; menuOpen = open; menu.hidden = !open; menu.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', open); $('#menuTxt').textContent = open ? 'Закрыть' : 'Меню';
  document.body.classList.toggle('lock', open); if (open) top.classList.remove('hide');
}
if (menu) {
  $$('li, .mcon .row', menu).forEach((el, i) => el.style.setProperty('--i', i));
  menuBtn.addEventListener('click', () => setMenu(!menuOpen));
  addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { setMenu(false); menuBtn.focus(); } });
  menu.addEventListener('click', e => { if (e.target.closest('a[href^="#"]')) setMenu(false); });
}
let lastY = scrollY;
addEventListener('scroll', () => { const y = scrollY, d = y - lastY; if (top && !menuOpen && Math.abs(d) > 6) { top.classList.toggle('hide', d > 0 && y > 240); lastY = y; } }, { passive: true });

/* ---------- the open page is remembered for this tab: a reload of the artifact comes back to it ---------- */
const pageFile = location.pathname.split('/').pop();
if (/^[a-z0-9-]+\.html$/.test(pageFile) && pageFile !== 'index.html') store.set('last', pageFile, true);

/* ---------- page change: a green curtain closes, the next page opens from under it ---------- */
const veil = $('#veil');
function go(href) {
  try { if (/index\.html$/.test(new URL(href, location.href).pathname)) store.set('home', '1', true); } catch (_) {}
  // a link that names a block on another page: the page still opens on its first screen, the block name travels in the tab's storage
  try { const u = new URL(href, location.href); if (u.hash.length > 1 && u.pathname !== location.pathname) { const j = decodeURIComponent(u.hash.slice(1)); store.set('jump', j, true); if (store.get('jump', true) === j) { u.hash = ''; href = u.href; } } } catch (_) {}
  store.set('nav', '1', true);
  if (!veil || reduced()) { location.href = href; return; }
  store.set('veil', '1', true); veil.className = 'veil cover'; setTimeout(() => { location.href = href; }, 520);
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute('download')) return;
  const raw = a.getAttribute('href'); if (/^(mailto:|tel:|sms:|javascript:)/.test(raw)) return;
  if (raw.startsWith('#')) { const t = raw.length > 1 && document.getElementById(raw.slice(1)); if (t) { e.preventDefault(); setMenu(false); t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }); history.replaceState(null, '', raw); } return; }
  let url; try { url = new URL(a.href, location.href); } catch (_) { return; }
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.hash) return;
  e.preventDefault(); setMenu(false); go(url.href);
});
// every page opened by a link or by its address starts on its first screen; only back, forward and reload keep the place
const navType = (() => { try { return performance.getEntriesByType('navigation')[0].type; } catch (_) { return ''; } })();
const jumpTo = (() => { const j = store.get('jump', true); store.del('jump', true); store.del('nav', true); return j || decodeURIComponent(location.hash.slice(1)); })();
if (navType !== 'back_forward' && navType !== 'reload') {
  // the viewer around the page may put the old scroll back after loading, so hold the first screen until the visitor scrolls
  try { history.scrollRestoration = 'manual'; } catch (_) {}
  let moved = false, scrolled = false; const hold = () => { if (!moved && (scrollY || document.documentElement.scrollTop)) { scrollTo(0, 0); document.documentElement.scrollTop = 0; } };
  ['wheel', 'touchmove', 'keydown'].forEach(t => addEventListener(t, () => { moved = scrolled = true; }, { once: true, passive: true }));
  addEventListener('click', () => { moved = true; }, { once: true, passive: true });
  hold(); try { document.documentElement.scrollIntoView({ block: 'start' }); } catch (_) {}
  [50, 150, 400, 800, 1400].forEach(ms => setTimeout(hold, ms));
  addEventListener('load', () => { hold(); setTimeout(hold, 100); setTimeout(hold, 400); });
  addEventListener('pageshow', hold);
  // a link that named a block: the first screen shows, then the page glides down to that block
  const tgt = jumpTo && pageFile !== 'tipovye-resheniya.html' && document.getElementById(jumpTo);
  if (tgt) setTimeout(() => { if (scrolled) return; moved = true; tgt.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); if (!location.hash) history.replaceState(null, '', '#' + jumpTo); }, 1500);
}
if (veil) {
  if (store.get('veil', true) && !reduced()) {
    store.del('veil', true); veil.className = 'veil held';
    requestAnimationFrame(() => requestAnimationFrame(() => { veil.className = 'veil away'; setTimeout(() => { veil.className = 'veil'; }, 800); }));
  }
  addEventListener('pageshow', e => { if (e.persisted) veil.className = 'veil'; });
}

/* ---------- reveal on scroll ---------- */
const rio = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); x.target.classList.remove('split-wait'); rio.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' });
$$('[data-rv], [data-split]').forEach(el => rio.observe(el));

/* counters */
const cio = new IntersectionObserver(en => en.forEach(x => {
  if (!x.isIntersecting) return; cio.unobserve(x.target); const el = x.target, to = +el.dataset.count; if (reduced()) { el.textContent = to; return; }
  const t0 = performance.now(), d = 1400; (function f(now) { const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(f); })(t0);
}), { threshold: .6 });
$$('[data-count]').forEach(el => { el.textContent = '0'; cio.observe(el); });

/* ---------- accordion, tabs, filters ---------- */
$$('.qa button[aria-controls]').forEach(b => b.addEventListener('click', () => {
  const open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', open); document.getElementById(b.getAttribute('aria-controls')).classList.toggle('open', open);
}));
$$('.tabs, [data-tabs]').forEach(tl => {
  const tabs = $$('[role="tab"]', tl);
  const pick = (t, focus) => { tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute('aria-controls')).hidden = !on; }); if (focus) t.focus(); };
  tabs.forEach((t, i) => { t.addEventListener('click', () => pick(t)); t.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (d) { e.preventDefault(); pick(tabs[(i + d + tabs.length) % tabs.length], true); } }); });
});
function filterBy(name, f) {
  $$(`[data-filter="${name}"] [data-f]`).forEach(c => c.setAttribute('aria-pressed', c.dataset.f === f));
  $$(`[data-fgroup="${name}"] [data-c]`).forEach(el => { el.hidden = !(f === 'all' || el.dataset.c.split(' ').includes(f)); });
  document.dispatchEvent(new CustomEvent('filter', { detail: { name, f } }));
}
$$('[data-filter]').forEach(box => box.addEventListener('click', e => { const c = e.target.closest('[data-f]'); if (c) filterBy(box.dataset.filter, c.dataset.f); }));

/* ---------- forms: check, then the thank-you page. Nothing is sent yet: the form is wired to mail or CRM at launch ---------- */
function telFmt(v) {
  let d = v.replace(/\D/g, ''); if (!d) return ''; if (d[0] === '8') d = '7' + d.slice(1); if (d[0] !== '7') d = '7' + d; d = d.slice(0, 11);
  const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)]; let s = '+7';
  if (p[0]) s += ' (' + p[0] + (p[0].length === 3 ? ')' : ''); if (p[1]) s += ' ' + p[1]; if (p[2]) s += '-' + p[2]; if (p[3]) s += '-' + p[3]; return s;
}
$$('input[type="tel"]').forEach(i => { i.addEventListener('input', () => { const at = i.selectionStart === i.value.length; i.value = telFmt(i.value); if (at) i.selectionStart = i.selectionEnd = i.value.length; i.classList.remove('bad'); }); i.addEventListener('focus', () => { if (!i.value) i.value = '+7 '; }); i.addEventListener('blur', () => { if (i.value.trim() === '+7') i.value = ''; }); });
$$('form[data-form]').forEach(f => f.addEventListener('submit', e => {
  e.preventDefault(); const note = $('.fnote', f), say = (t, err) => { if (note) { note.textContent = t; note.classList.toggle('err', !!err); } };
  const tel = $('input[type="tel"]', f), mail = $('input[type="email"]', f), ok = $('input[name="ok"]', f);
  const telOk = tel && tel.value.replace(/\D/g, '').length === 11, mailOk = mail && /^\S+@\S+\.\S+$/.test(mail.value);
  if (tel && !telOk && !(mail && mailOk)) { tel.classList.add('bad'); tel.focus(); say(mail ? 'Оставьте телефон или почту, чтобы мы могли ответить' : 'Проверьте телефон: нужно 11 цифр', true); return; }
  if (ok && !ok.checked) { say('Отметьте согласие на обработку персональных данных', true); return; }
  say('Отправляем…'); store.set('form', f.dataset.form || 'Заявка', true); setTimeout(() => go('spasibo.html'), 350);
}));
$$('[data-copy]').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.copy, done = () => toast('Скопировано: ' + v);
  const sel = () => { const t = b.previousElementSibling; if (t) { const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Выделено, скопируйте сочетанием Ctrl+C'); };
  try { navigator.clipboard.writeText(v).then(done, sel); } catch (_) { sel(); }
}));

/* ---------- cookie notice ---------- */
const ck = $('#ck');
if (ck && !store.get('ck')) { ck.hidden = false; ck.addEventListener('click', e => { const b = e.target.closest('[data-ck]'); if (b) { store.set('ck', b.dataset.ck); ck.hidden = true; } }); }

/* ---------- lightbox ---------- */
const lb = $('#lb'); let lbList = [], lbI = 0;
function lbShow(k) { lbI = (k + lbList.length) % lbList.length; const [src, cap] = lbList[lbI]; $('#lbImg').src = src; $('#lbImg').alt = cap; $('#lbCap').textContent = cap; $('#lbCnt').textContent = (lbI + 1) + ' из ' + lbList.length; }
function lbOpen(list, k) { if (!lb) return; lbList = list; lbShow(k); lb.hidden = false; document.body.classList.add('lock'); $('#lbX').focus(); }
function lbClose() { lb.hidden = true; document.body.classList.remove('lock'); }
if (lb) {
  $('#lbX').addEventListener('click', lbClose); $('#lbP').addEventListener('click', () => lbShow(lbI - 1)); $('#lbN').addEventListener('click', () => lbShow(lbI + 1));
  lb.addEventListener('click', e => { if (e.target === lb) lbClose(); });
  addEventListener('keydown', e => { if (lb.hidden) return; if (e.key === 'Escape') lbClose(); if (e.key === 'ArrowLeft') lbShow(lbI - 1); if (e.key === 'ArrowRight') lbShow(lbI + 1); });
  document.addEventListener('click', e => { const g = e.target.closest('[data-lb]'); if (!g) return; e.preventDefault(); const all = $$(`[data-lb="${g.dataset.lb}"]`).filter(x => !x.closest('[hidden]')); lbOpen(all.map(x => [x.dataset.src, x.dataset.cap || '']), all.indexOf(g)); });
}

/* product hero: a small photo window that leafs through real photos */
$$('.p-win').forEach(w => {
  const set = JSON.parse(w.dataset.set || '[]'); if (!set.length) return; let i = 0, t = 0;
  let img = $('.im img', w); const cap = $('.bar b', w);
  const show = k => { i = (k + set.length) % set.length; const n = img.cloneNode(); n.src = set[i][0]; n.alt = set[i][1]; img.replaceWith(n); img = n; cap.textContent = set[i][1]; };
  const auto = () => { clearInterval(t); if (!reduced()) t = setInterval(() => { if (!document.hidden) show(i + 1); }, 4200); };
  w.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { e.stopPropagation(); show(i + (b.dataset.d === 'p' ? -1 : 1)); auto(); return; } lbOpen(set, i); });
  auto();
});

/* quality: a marker on the photo lights its line in the list */
$$('.mk-dot[data-k]').forEach(m => { const li = document.querySelector(`.checks li[data-k="${m.dataset.k}"]`); const on = v => { m.classList.toggle('on', v); if (li) li.classList.toggle('on', v); };
  m.addEventListener('mouseenter', () => on(true)); m.addEventListener('mouseleave', () => on(false)); m.addEventListener('focus', () => on(true)); m.addEventListener('blur', () => on(false));
  if (li) { li.addEventListener('mouseenter', () => on(true)); li.addEventListener('mouseleave', () => on(false)); } });

/* ---------- 3D: three.js from the CDN, models are base64 .glb.txt next to the page ---------- */
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
const loadScript = src => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('не загрузился ' + src.split('/').pop())); document.head.appendChild(s); });
// three.js is served with the site (s/three-r147.js): some networks block the CDN, then the page fell back to the render
const loadThree = () => (window.THREE && THREE.GLTFLoader ? Promise.resolve() : loadScript('s/three-r147.js')).catch(() => loadScript(CDN + 'build/three.min.js').then(() => Promise.all(['examples/js/loaders/GLTFLoader.js', 'examples/js/loaders/DRACOLoader.js', 'examples/js/controls/OrbitControls.js', 'examples/js/environments/RoomEnvironment.js'].map(f => loadScript(CDN + f)))));
// full quality by default; only when the model really cannot turn (under ~15 fps for three seconds) the resolution steps down to 1, then to 0.75
const PR_FLOOR = .75, prStep = cap => cap;
function prTune(o, dt) { if (!o.prev) { o.prev = true; return; } if (o.warm > 0) { o.warm--; return; } o.acc = (o.acc || 0) + dt; o.cnt = (o.cnt || 0) + 1; if (o.acc < 3000) return; const avg = o.acc / o.cnt; o.acc = o.cnt = 0; if (avg > 66 && o.cap > PR_FLOOR) o.cap = o.cap > 1 ? 1 : PR_FLOOR; }
let libs = null, loader = null; const glbBuf = {};
function load3d() {
  if (!libs) libs = loadThree().then(() => {
    const draco = new THREE.DRACOLoader(); draco.setDecoderPath(new URL('draco/', location.href).href); draco.setDecoderConfig({ type: 'js' });
    loader = new THREE.GLTFLoader(); loader.setDRACOLoader(draco);
  });
  return libs;
}
function glbData(id) { return glbBuf[id] || (glbBuf[id] = fetch('glb/' + id + '.glb.txt').then(r => { if (!r.ok) throw new Error('нет модели ' + id); return r.text(); }).then(t => { const bin = atob(t.replace(/\s+/g, '')), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b.buffer; })); }
function parseModel(id) {
  return glbData(id).then(data => new Promise((ok, fail) => {
    // the GLTF parser picks its texture loader when it is created: hide createImageBitmap only for that synchronous moment
    const cib = self.createImageBitmap; try { self.createImageBitmap = undefined; } catch (_) {}
    try { loader.parse(data, '', g => { g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); ok(g.scene); }, fail); } catch (e) { fail(e); } finally { try { self.createImageBitmap = cib; } catch (_) {} }
  }));
}
const stages = [];
class Stage {
  constructor(el) { this.el = el; this.slot = $('.slot', el); this.msg = $('.msg', el); this.id = el.dataset.model; this.asm = el.hasAttribute('data-asm'); this.zoom = el.hasAttribute('data-zoom'); this.p = 1; this.seen = false; this.need = true; stages.push(this); }
  say(t) { if (!this.msg) return; this.msg.hidden = !t; this.msg.textContent = t; }
  start() {
    if (this.ready) return this.ready;
    this.say('Загружаю 3D-модель…');
    return (this.ready = load3d().then(() => { this.setup(); return this.show(this.id); }).catch(err => { this.say('3D-модель не загрузилась, показываем рендер'); this.el.classList.remove('live'); console.warn(err); }));
  }
  setup() {
    // the light and the model stand still while the camera orbits, so the shadow map is drawn only when the model or the light changes
    const T = THREE, r = new T.WebGLRenderer({ antialias: true, alpha: true });
    this.cap = Math.min(devicePixelRatio || 1, 2); this.pr = prStep(this.cap); this.warm = 30;
    r.setPixelRatio(this.pr); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;
    const scene = new T.Scene(), pm = new T.PMREMGenerator(r); scene.environment = pm.fromScene(new T.RoomEnvironment(), .04).texture;
    const sun = new T.DirectionalLight(0xffffff, 1.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun, sun.target);
    const camera = new T.PerspectiveCamera(this.asm ? 30 : 32, 16 / 9, .05, 200), controls = new T.OrbitControls(camera, r.domElement);
    controls.enableDamping = true; controls.dampingFactor = .08; controls.autoRotate = !this.asm && !reduced(); controls.autoRotateSpeed = .9; controls.maxPolarAngle = Math.PI * .52; controls.enableZoom = this.zoom; controls.enablePan = false; controls.enabled = !this.asm;
    controls.addEventListener('start', () => { controls.autoRotate = false; });
    controls.addEventListener('change', () => { this.need = true; });
    r.domElement.style.touchAction = 'pan-y'; r.domElement.setAttribute('aria-label', this.asm ? 'Изделие собирается по мере прокрутки' : '3D-модель изделия, зажмите и ведите, чтобы вращать');
    const ground = new T.Mesh(new T.CircleGeometry(1, 64), new T.ShadowMaterial({ opacity: .14 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const pivot = new T.Group(); scene.add(pivot);
    Object.assign(this, { T, r, scene, sun, camera, controls, ground, pivot });
    this.slot.appendChild(r.domElement); this.fit();
    new ResizeObserver(() => this.fit()).observe(this.el);
  }
  fit() { if (!this.r) return; const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return; this.r.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); if (this.root) this.frame(); this.need = true; }
  async show(id) {
    this.id = id; this.say('Загружаю 3D-модель…');
    const root = await parseModel(id); if (this.id !== id) return;
    if (this.root) this.pivot.remove(this.root);
    this.pivot.rotation.y = 0; this.pivot.add(root); this.root = root; this.frame();
    if (this.asm) this.prepAsm(); this.setP(this.p);
    this.el.classList.add('live'); this.say(''); this.need = true;
  }
  frame() {
    const T = this.T, root = this.pivot, box = new T.Box3().setFromObject(root), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3()), r = size.length() / 2;
    this.c = c; this.r0 = r; this.ground.scale.setScalar(r * 3); this.ground.position.set(c.x, box.min.y - .002, c.z);
    this.sun.position.set(c.x - r * 1.2, c.y + r * 2.2, c.z + r * 1.6); this.sun.target.position.copy(c); this.r.shadowMap.needsUpdate = true; this.warm = 30;
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -r * 1.5; sc.right = sc.top = r * 1.5; sc.near = .1; sc.far = r * 8; sc.updateProjectionMatrix();
    const cam = this.camera, vf = T.MathUtils.degToRad(cam.fov / 2), asp = Math.max(1.1, cam.aspect), hf = Math.atan(Math.tan(vf) * asp), hxz = Math.hypot(size.x, size.z) / 2;
    let dist = Math.max(size.y / 2 / Math.tan(vf), hxz / Math.tan(hf)) + hxz * .85; if (this.asm) dist *= 1.32;
    const dir = new T.Vector3(-.55, this.asm ? .5 : .38, .75).normalize();
    cam.position.copy(c).addScaledVector(dir, dist); this.controls.target.copy(c); this.controls.minDistance = r * .5; this.controls.maxDistance = dist * 2.2;
    cam.near = r / 100; cam.far = dist * 6; cam.updateProjectionMatrix(); cam.lookAt(c); this.controls.update(); this.need = true;
  }
  // assembly: each connected piece of the model flies in from outside, bottom pieces first; the frame and big shells stay
  prepAsm() {
    const T = this.T, root = this.root; root.updateMatrixWorld(true);
    const mb = new T.Box3().setFromObject(root), mc = mb.getCenter(new T.Vector3()), R = mb.getSize(new T.Vector3()).length() / 2, H = mb.max.y - mb.min.y;
    this.uP = this.uP || { value: 1 };
    const isl = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    root.traverse(o => {
      if (!o.isMesh || !o.geometry.attributes.position) return;
      const g = o.geometry, pos = g.attributes.position, n = pos.count, idx = g.index, q = R / 2e4;
      // weld vertices by position so a piece split by its normals or uv seams stays one piece
      const rep = new Int32Array(n), key = new Map();
      for (let i = 0; i < n; i++) { const k = Math.round(pos.getX(i) / q) + ',' + Math.round(pos.getY(i) / q) + ',' + Math.round(pos.getZ(i) / q); const e = key.get(k); if (e === undefined) { key.set(k, i); rep[i] = i; } else rep[i] = e; }
      const par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
      const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
      const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
      const tri = idx ? idx.count : n; for (let t = 0; t < tri; t += 3) { const a = rep[idx ? idx.getX(t) : t], b = rep[idx ? idx.getX(t + 1) : t + 1], c = rep[idx ? idx.getX(t + 2) : t + 2]; uni(a, b); uni(a, c); }
      const id = new Int32Array(n), map = new Map(), bx = [];
      for (let i = 0; i < n; i++) { const r = find(rep[i]); let k = map.get(r); if (k === undefined) { k = bx.length; map.set(r, k); bx.push([1e9, 1e9, 1e9, -1e9, -1e9, -1e9]); } id[i] = k; const b = bx[k], x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (z < b[2]) b[2] = z; if (x > b[3]) b[3] = x; if (y > b[4]) b[4] = y; if (z > b[5]) b[5] = z; }
      const off = new Float32Array(n * 3), tt = new Float32Array(n), per = bx.map(b => {
        const lc = new T.Vector3((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2), wc = lc.clone().applyMatrix4(o.matrixWorld);
        const lmin = new T.Vector3(b[0], b[1], b[2]).applyMatrix4(o.matrixWorld), lmax = new T.Vector3(b[3], b[4], b[5]).applyMatrix4(o.matrixWorld), diag = lmin.distanceTo(lmax);
        if (diag > R * .9) return [0, 0, 0, 0];
        const d = wc.clone().sub(mc); d.y = Math.max(d.y, 0) + R * .35; if (d.lengthSq() < 1e-9) d.set(0, 1, 0); d.normalize();
        const wt = wc.clone().addScaledVector(d, R * (.3 + rnd() * .2)), lt = o.worldToLocal(wt.clone()).sub(lc);
        return [lt.x, lt.y, lt.z, clamp((wc.y - mb.min.y) / (H || 1)) * .62 + rnd() * .08];
      });
      for (let i = 0; i < n; i++) { const p = per[id[i]]; off[i * 3] = p[0]; off[i * 3 + 1] = p[1]; off[i * 3 + 2] = p[2]; tt[i] = p[3]; }
      g.setAttribute('aOff', new T.BufferAttribute(off, 3)); g.setAttribute('aT', new T.BufferAttribute(tt, 1)); isl.push(bx.length);
      const ms = Array.isArray(o.material) ? o.material : [o.material], uP = this.uP;
      ms.forEach(m => { m.onBeforeCompile = sh => { sh.uniforms.uP = uP; sh.vertexShader = 'attribute vec3 aOff;\nattribute float aT;\nuniform float uP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat kk = clamp((uP - aT) / .3, 0., 1.); kk = kk * kk * (3. - 2. * kk); transformed += aOff * (1. - kk);'); }; m.customProgramCacheKey = () => 'asm'; m.needsUpdate = true; });
      o.castShadow = false; o.frustumCulled = false;
    });
    this.pieces = isl.reduce((a, b) => a + b, 0);
  }
  setP(p) { this.p = p; if (!this.uP) return; this.uP.value = p; if (this.pivot) this.pivot.rotation.y = (1 - p) * -.9 + p * .25; if (this.ground) this.ground.visible = p > .98; if (this.r) this.r.shadowMap.needsUpdate = true; this.need = true; }
  // the spin follows the clock, so a slow GPU turns the model at the same speed, only less smoothly
  draw(now) {
    if (!this.r || !this.vis || document.hidden) { this.last = 0; this.prev = false; return; }
    const dt = this.last ? now - this.last : 16.7; this.last = now;
    if (this.controls.enabled) { this.controls.autoRotateSpeed = .9 * Math.min(4, Math.max(.25, dt / 16.7)); if (this.controls.update()) this.need = true; }
    if (!this.need) { this.prev = false; return; }
    this.need = false; this.r.render(this.scene, this.camera); prTune(this, dt);
    if (this.pr !== prStep(this.cap)) { this.pr = prStep(this.cap); this.r.setPixelRatio(this.pr); this.fit(); this.warm = 20; }
  }
}
// load a model a little before it scrolls in, but draw it only while it is on screen
const sio = new IntersectionObserver(en => en.forEach(x => { const s = x.target._st; s.seen = x.isIntersecting; if (x.isIntersecting) { s.need = true; s.start(); } }), { rootMargin: '300px 0px' });
const vio = new IntersectionObserver(en => en.forEach(x => { const s = x.target._st; s.vis = x.isIntersecting; if (s.vis) s.need = true; }));
$$('.stage3[data-model]').forEach(el => { el._st = new Stage(el); sio.observe(el); vio.observe(el); });
if (stages.length) (function loop(now) { requestAnimationFrame(loop); now = now || performance.now(); for (const s of stages) s.draw(now); })();

/* ---------- scroll-driven blocks ---------- */
const prog = el => { const r = el.getBoundingClientRect(), span = r.height - innerHeight; return span > 0 ? clamp(-r.top / span) : (r.top < innerHeight ? 1 : 0); };
const xwins = $$('.xwin'), hss = $$('.hs'), flows = $$('.flow'), asms = $$('.asm'), whs = $$('.wh'), rprog = $('.rprog b'), mob = $('.mob-cta');
const ASM = asms.map(a => ({ a, st: $('.stage3', a), li: $$('.asm-list li', a), bar: $('.asm-bar', a), lbl: $('.lbl b', a) }));
let rafQ = 0;
function onScroll() {
  rafQ = 0; const vh = innerHeight;
  xwins.forEach(w => { const r = w.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return; const p = clamp(-r.top / (r.height - vh)); w.style.setProperty('--e', ease(clamp(p / .55)).toFixed(4)); w.style.setProperty('--c', clamp((p - .5) / .3).toFixed(3)); });
  hss.forEach(h => { const r = h.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return; const p = clamp(-r.top / (r.height - vh)), tr = $('.hs-track', h), max = Math.max(0, tr.scrollWidth - tr.clientWidth); tr.style.transform = `translate3d(${(-max * p).toFixed(1)}px,0,0)`; h.style.setProperty('--p', p.toFixed(3)); });
  flows.forEach(f => { const r = f.getBoundingClientRect(), p = clamp((vh * .85 - r.top) / (vh * .5)); f.style.setProperty('--fp', p.toFixed(3)); const li = $$('li', f); li.forEach((l, i) => l.classList.toggle('on', p >= i / Math.max(1, li.length - 1) - .001 || reduced())); });
  ASM.forEach(({ a, st, li, bar, lbl }) => { const p = prog(a), q = clamp(p / .86); if (st && st._st) st._st.setP(q); if (bar) bar.style.setProperty('--p', q.toFixed(3)); li.forEach((l, i) => l.classList.toggle('on', q >= (i + .5) / li.length)); if (lbl) lbl.textContent = Math.round(q * 100) + '%'; });
  whs.forEach(w => w._wh && w._wh(prog(w)));
  if (rprog) { const art = $('.prose'), r = art.getBoundingClientRect(); rprog.parentNode.style.setProperty('--p', clamp(-r.top / Math.max(1, r.height - vh * .6)).toFixed(3)); }
  if (mob) { const f = $('.ft') || $('.foot'); mob.classList.toggle('on', scrollY > vh * .8 && (!f || f.getBoundingClientRect().top > vh)); }
}
const kick = () => { if (!rafQ) rafQ = requestAnimationFrame(onScroll); };
addEventListener('scroll', kick, { passive: true }); addEventListener('resize', kick); kick();

/* ---------- catalog: the path of water and heat through a building ---------- */
whs.forEach(w => {
  const data = json('whData'); if (!data) return; const path = $('#whPath', w), dot = $('#whDot', w), card = $('.wh-card', w), steps = $$('.wh-steps i', w);
  const len = path ? path.getTotalLength() : 0; if (path) { path.style.strokeDasharray = len; path.style.strokeDashoffset = len; }
  let cur = -1;
  const show = i => { if (i === cur) return; cur = i; const s = data[i];
    card.innerHTML = `<span class="code">${s.code}</span><h3>${s.t}</h3><p>${s.d}</p>${s.href ? `<a class="lnk" href="${s.href}">Перейти на страницу «${s.go}» <span>→</span></a>` : ''}`;
    $$('.room', w).forEach(r => r.classList.toggle('lit', +r.dataset.step <= i)); $$('.room', w).forEach(r => r.classList.toggle('cur', +r.dataset.step === i)); };
  // every step gets the same scroll distance; the dot runs faster along long pipes
  const lit = $$('[data-lit]', w);
  w._wh = p => { const q = clamp(p / .92), n = data.length, i = Math.min(n - 1, Math.floor(q * n)), loc = clamp(q * n - i);
    const a0 = data[i].at ?? i / n, a1 = i + 1 < n ? (data[i + 1].at ?? (i + 1) / n) : 1, fp = q >= 1 ? 1 : a0 + (a1 - a0) * loc;
    if (path) { path.style.strokeDashoffset = (len * (1 - fp)).toFixed(1); if (dot) { const pt = path.getPointAtLength(len * fp); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); } }
    lit.forEach(el => el.classList.toggle('lit', i >= +el.dataset.lit));
    steps.forEach((s, k) => s.style.setProperty('--f', clamp(q * n - k).toFixed(3))); show(i); };
  // a unit on the scheme opens a side panel with a short description; its button leads to the page (hover with a mouse, tap on touch)
  const pn = $('.whp', w), pb = pn && $('.whp-b', pn), swb = t => `<span class="sw" data-t="${t}"><span>${t}</span></span>`; let pi = -1, pt = 0;
  const pOpen = (i, focus) => { const s = data[i]; if (!pn || !s) return; clearTimeout(pt);
    if (i !== pi) { pi = i; pb.innerHTML = `${s.img ? `<div class="whp-im"><img src="${s.img}" alt="${s.one}"></div>` : ''}<span class="code">${s.code}</span><h3>${s.one}</h3><p class="whp-d">${s.d}</p>${s.pd ? `<p class="whp-s">${s.pd}</p>` : ''}<ul class="whp-f"><li><b>1 день</b>расчёт</li><li><b>до 6 недель</b>изготовление</li><li><b>5 лет</b>гарантия</li></ul><div class="btns"><a class="btn btn-red" href="${s.href}">${swb('Смотреть')} <span class="ar">→</span></a><button class="btn btn-line" type="button" data-pop="Рассчитать">${swb('Рассчитать')}</button></div>`; }
    $$('.room', w).forEach(r => r.classList.toggle('pk', +r.dataset.step === i));
    pn.hidden = false; requestAnimationFrame(() => pn.classList.add('on')); if (focus) { const a = $('.btn-red', pn); if (a) a.focus({ preventScroll: true }); } };
  const pClose = () => { if (!pn || pn.hidden) return; clearTimeout(pt); pn.classList.remove('on'); pi = -1; $$('.room', w).forEach(r => r.classList.remove('pk')); setTimeout(() => { if (!pn.classList.contains('on')) pn.hidden = true; }, reduced() ? 0 : 450); };
  $$('.room', w).forEach(r => {
    r.addEventListener('click', () => pOpen(+r.dataset.step));
    r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pOpen(+r.dataset.step, true); } });
    r.addEventListener('pointerenter', e => { if (e.pointerType === 'touch') return; clearTimeout(pt); pt = setTimeout(() => pOpen(+r.dataset.step), pn && !pn.hidden ? 60 : 160); });
    r.addEventListener('pointerleave', () => clearTimeout(pt));
  });
  if (pn) {
    $('.whp-x', pn).addEventListener('click', pClose);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') pClose(); });
    $('.wh-svg', w).addEventListener('click', e => { if (!e.target.closest('.room')) pClose(); });
    new IntersectionObserver(en => en.forEach(x => { if (!x.isIntersecting) pClose(); }), { threshold: 0 }).observe(w);
  }
  w._wh(0);
});

/* ---------- about: plan of the hall, a zone opens its photo and text ---------- */
/* ---------- about: factory photos change on their own, a bar under the photo shows the timing ---------- */
$$('[data-hsl]').forEach(h => {
  const figs = $$('figure', h), segs = $$('.hsl-seg button', h), cap = $('.hsl-cap', h), caps = JSON.parse(h.dataset.hsl || '[]'), T = 5500;
  let cur = 0, timer = 0, vis = true;
  const set = k => { if (k === cur) return; figs.forEach((f, j) => { f.classList.toggle('was', j === cur); f.classList.remove('on'); });
    void figs[k].offsetWidth; figs[k].classList.add('on'); cur = k;
    segs.forEach((b, j) => { b.classList.remove('on'); b.classList.toggle('done', j < k); }); void segs[k].offsetWidth; segs[k].classList.add('on');
    if (cap) { cap.textContent = caps[k] || ''; cap.style.animation = 'none'; void cap.offsetWidth; cap.style.animation = ''; } };
  const tick = () => { clearTimeout(timer); if (reduced() || !vis) return; timer = setTimeout(() => { set((cur + 1) % figs.length); tick(); }, T); };
  segs.forEach((b, j) => b.addEventListener('click', () => { set(j); tick(); }));
  h.style.setProperty('--hsl-t', T / 1000 + 's');
  new IntersectionObserver(en => { const v = en[0].isIntersecting; if (v === vis) return; vis = v; if (vis) { segs[cur].classList.remove('on'); void segs[cur].offsetWidth; segs[cur].classList.add('on'); tick(); } else clearTimeout(timer); }).observe(h);
  tick();
});

const plan = $('.plan'), planD = json('planData');
if (plan && planD) {
  const side = $('.plan-side', plan);
  const pick = id => { const z = planD.find(x => x.id === id); if (!z) return;
    side.innerHTML = `<div class="ph"><img src="${z.img}" alt="${z.t}" loading="lazy"></div><div class="tx"><span class="eb">${z.k}</span><h3>${z.t}</h3><p>${z.d}</p></div>`;
    $$('.z', plan).forEach(g => g.classList.toggle('on', g.dataset.z === id)); $$('.zbtns [data-z]').forEach(b => b.setAttribute('aria-pressed', b.dataset.z === id)); };
  document.addEventListener('click', e => { const t = e.target.closest('[data-z]'); if (t && (plan.contains(t) || t.closest('.zbtns'))) pick(t.dataset.z); });
  $$('.z', plan).forEach(g => g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g.dataset.z); } }));
  pick(planD[0].id);
}

/* ---------- projects: dot map of Russia with pins ---------- */
const pmap = $('.pmap'), MAPD = json('mapd'), OBJS = json('objs');
if (pmap && MAPD && OBJS) {
  const cv = $('canvas', pmap), box = $('.pmap-cv', pmap), pins = $('.pmap-pins', pmap), list = $('.pmap-side ol', pmap), card = $('#pjCard');
  const CITY = json('cities') || {};
  let f = 'all', sel = -1;
  // colour map: land dots appear in a wave from the plant, routes draw out to each city, a light runs along them
  const TONES = ['#aed7c8', '#90c9b5', '#70b89f', '#51a68a', '#2f9073']; // brighter since v48 (Nikita 2026-10-28)
  let geo = null, t0 = 0, raf = 0, seen = false, base = null;
  function layout() {
    const W = box.clientWidth, H = box.clientHeight, d = Math.min(devicePixelRatio || 1, 2); if (!W || !H) return null;
    cv.width = W * d; cv.height = H * d;
    const narrow = W < 600, s = Math.min(W / (narrow ? 700 : 900), H / MAPD.H), mw = MAPD.W * s, ox = mw <= W ? (W - mw) / 2 : Math.max(W - mw, Math.min(0, W / 2 - (narrow ? 548 : 470) * s)), oy = (H - MAPD.H * s) / 2, st = MAPD.step, rad = Math.max(.9, st * s * .3), sam = MAPD.cities.samara;
    const dots = [];
    MAPD.runs.forEach((row, y) => { for (let k = 0; k < row.length; k += 2) for (let x = row[k]; x < row[k] + row[k + 1]; x++) {
      const px = (x + .5) * st, py = (y + .5) * st, dist = Math.hypot(px - sam[0], py - sam[1]), h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const near = Math.max(0, 1 - dist / 420), tone = Math.min(TONES.length - 1, Math.floor((h - Math.floor(h)) * 2.2 + near * 3));
      dots.push([ox + px * s, oy + py * s, dist, TONES[tone]]);
    } });
    const P = k => [ox + MAPD.cities[k][0] * s, oy + MAPD.cities[k][1] * s];
    const arcs = Object.keys(MAPD.cities).filter(k => k !== 'samara').map(k => { const p = MAPD.cities[k], mx = (sam[0] + p[0]) / 2, my = Math.min(sam[1], p[1]) - Math.abs(p[0] - sam[0]) * .18 - 18; return [P('samara'), [ox + mx * s, oy + my * s], P(k)]; });
    $$('.ppin', pins).forEach(b => { const q = P(b.dataset.city); b.style.left = q[0] + 'px'; b.style.top = q[1] + 'px'; b._x = q[0]; b._y = q[1]; });
    base = null; requestAnimationFrame(labels);
    return { W, H, d, s, ox, oy, rad, dots, arcs };
  }
  const qp = (a, u) => { const v = 1 - u; return [v * v * a[0][0] + 2 * v * u * a[1][0] + u * u * a[2][0], v * v * a[0][1] + 2 * v * u * a[1][1] + u * u * a[2][1]]; };
  function frame(now) {
    raf = 0; if (!geo) return;
    const { W, H, d, s, ox, oy, rad, dots, arcs } = geo, c = cv.getContext('2d'), t = reduced() ? 1e6 : now - t0;
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
    const grown = t > 2600;
    if (grown && base) c.drawImage(base, 0, 0, W, H);
    else {
      dots.forEach(([x, y, dist, col]) => { const a = Math.min(1, Math.max(0, (t - dist * 2.6) / 500)); if (!a) return; c.globalAlpha = a; c.fillStyle = col; c.beginPath(); c.arc(x, y, rad * (.4 + .6 * a), 0, 7); c.fill(); });
      c.globalAlpha = 1;
      if (MAPD.volga) { c.strokeStyle = 'rgba(58,141,184,.75)'; c.lineWidth = 2.4; c.lineJoin = 'round'; c.beginPath(); MAPD.volga.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](ox + x * s, oy + y * s)); c.stroke(); }
      if (grown) { base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height; base.getContext('2d').drawImage(cv, 0, 0); }
    }
    arcs.forEach((a, i) => {
      const u = Math.min(1, Math.max(0, (t - 900 - i * Math.min(260, 2600 / arcs.length)) / 1300)); if (!u) return;
      c.strokeStyle = 'rgba(232,66,55,.8)'; c.lineWidth = 1.8; c.beginPath(); for (let k = 0; k <= 40; k++) { const q = qp(a, u * k / 40); c[k ? 'lineTo' : 'moveTo'](q[0], q[1]); } c.stroke();
      if (u === 1 && !reduced()) { const v = ((t - 2200) / 2600 + i * .19) % 1, q = qp(a, Math.max(0, v)); const g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], 9); g.addColorStop(0, 'rgba(232,66,55,.95)'); g.addColorStop(1, 'rgba(232,66,55,0)'); c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], 9, 0, 7); c.fill(); }
    });
    if (seen && !reduced()) raf = requestAnimationFrame(frame);
  }
  function draw() { geo = layout(); if (!raf) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { if (!seen) { seen = true; if (!t0) { t0 = performance.now(); pmap.classList.add('live'); } } if (!raf) raf = requestAnimationFrame(frame); } else { seen = false; } }), { threshold: .2 }).observe(box);
  const cities = Object.keys(MAPD.cities);
  pins.innerHTML = cities.map(k => `<button class="ppin${k === 'samara' ? ' fac' : ''}" type="button" data-city="${k}" aria-label="${CITY[k] || k}"><i></i><span>${CITY[k] || k}${k === 'samara' ? ', завод' : ''}</span></button>`).join('');
  const hasF = o => f === 'all' || (o.kk || [o.k]).includes(f);
  // labels that would cover another label or a dot hide (the plant and the picked city always show), a hidden label shows on hover; a city with one object gets a small dot
  function labels() {
    const W = box.clientWidth, vis = $$('.ppin', pins).filter(b => !b.hidden && b._x != null), placed = [];
    const n = b => OBJS.filter(o => o.c === b.dataset.city && hasF(o)).length, hit = (a, q) => a[0] < q[2] && a[2] > q[0] && a[1] < q[3] && a[3] > q[1];
    vis.forEach(b => { b._n = n(b); b.classList.toggle('sm', b.dataset.city !== 'samara' && b._n < 2); });
    const dots = vis.map(b => { const r = b.classList.contains('fac') ? 13 : b.classList.contains('sm') ? 7 : 10; return [b._x - r, b._y - r, b._x + r, b._y + r, b]; });
    vis.sort((a, b) => (b.classList.contains('fac') - a.classList.contains('fac')) || (b.classList.contains('on') - a.classList.contains('on')) || (b._n - a._n));
    for (const b of vis) {
      const sp = b.firstElementChild.nextElementSibling, w = sp.offsetWidth, h = sp.offsetHeight, dx = b.classList.contains('fac') ? 16 : b.classList.contains('sm') ? 8 : 12, must = b.classList.contains('fac') || b.classList.contains('on');
      const opts = [[b._x + dx, false], [b._x - dx - w, true]].filter(([x]) => x > 2 && x + w < W - 2);
      let ok = opts.find(([x]) => { const r = [x, b._y - h / 2, x + w, b._y + h / 2]; return !placed.some(q => hit(r, q)) && !dots.some(q => q[4] !== b && hit(r, q)); });
      if (!ok && must) ok = opts[0] || [b._x + dx, false];
      b.classList.toggle('nol', !ok); b.classList.toggle('lft', !!ok && ok[1]);
      if (ok) placed.push([ok[0], b._y - h / 2, ok[0] + w, b._y + h / 2]);
    }
  }
  function renderList() {
    list.innerHTML = OBJS.map((o, i) => hasF(o) ? `<li><button type="button" data-i="${i}" class="${i === sel ? 'on' : ''}"><b>${o.who}</b><em>${o.t}</em><small>${CITY[o.c] || ''} · ${o.n}</small></button></li>` : '').join('');
    $$('.ppin', pins).forEach(b => { const has = b.dataset.city === 'samara' || OBJS.some(o => o.c === b.dataset.city && hasF(o)); b.hidden = !has; });
    labels();
  }
  function pick(i) { sel = i; const o = OBJS[i]; $$('.ppin', pins).forEach(b => b.classList.toggle('on', b.dataset.city === o.c)); renderList();
    openDrawer({ t: o.n, x: o.d, img: o.img || '', tag: o.t, meta: `${o.who} · ${CITY[o.c] || ''}`, p: o.p, go: /Лада-Дом/.test(o.who) ? ['proekt.html', 'Читать о проекте'] : null }); }
  list.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) pick(+b.dataset.i); });
  pins.addEventListener('click', e => { const b = e.target.closest('.ppin'); if (!b) return; const i = OBJS.findIndex(o => o.c === b.dataset.city && hasF(o)); if (i >= 0) pick(i); });
  document.addEventListener('filter', e => { if (e.detail.name === 'pmap') { f = e.detail.f; sel = -1; renderList(); } });
  renderList(); new ResizeObserver(draw).observe(box); draw();
}

/* ---------- typical solutions: list on the left, the solution with its 3D model on the right ---------- */
const tsData = json('tsData'), tsView = $('.ts-view');
if (tsData && tsView) {
  const st = $('.stage3', tsView), fb = $('.fb', tsView);
  const pick = (id, scroll) => { const s = tsData.find(x => x.id === id); if (!s) return;
    $$('.ts-list .ts').forEach(b => b.setAttribute('aria-selected', b.dataset.id === id));
    $('#tsCode').textContent = s.code; $('#tsName').textContent = s.n; $('#tsText').textContent = s.d;
    const tp = $('#tsPrice'); if (tp) { tp.hidden = !s.pr; $('b', tp).textContent = s.pr || ''; }
    $('#tsSpec').innerHTML = s.p.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join(''); $('#tsSch').innerHTML = s.sch || '';
    $('#tsProd').href = s.href; $('#tsProd').querySelector('.t').textContent = s.pn;
    fb.src = s.fb; if (s.model) { st.dataset.model = s.model; const S = st._st; if (S && S.r) S.show(s.model).catch(() => {}); else if (S) S.id = s.model; }
    history.replaceState(null, '', '#' + id); if (scroll && innerWidth < 980) tsView.scrollIntoView({ behavior: 'smooth' }); };
  $('.ts-list').addEventListener('click', e => { const b = e.target.closest('.ts[data-id]'); if (b) pick(b.dataset.id, true); });
  document.addEventListener('filter', e => { if (e.detail.name !== 'ts') return; const first = $$('.ts-list .ts').find(b => !b.hidden); if (first && $('.ts-list .ts[aria-selected="true"]')?.hidden !== false) pick(first.dataset.id); });
  // the solution named by the link is selected, the page itself stays on its first screen
  const h = jumpTo, byId = tsData.find(x => x.id === h), byP = tsData.find(x => x.prod === h);
  if (byP && !byId) { filterBy('ts', h); pick(byP.id); } else pick(byId ? byId.id : tsData[0].id);
}

/* ---------- letters and reviews: a preview switches the letter shown below ---------- */
$$('[data-lsw]').forEach(w => {
  const tabs = $$('.lsw-tab', w), panes = $$('.lsw-p', w);
  const show = (i, focus) => { tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; }); panes.forEach((p, k) => { p.hidden = k !== i; p.classList.toggle('on', k === i); }); if (focus) tabs[i].focus(); };
  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
  w.querySelector('.lsw-tabs').addEventListener('keydown', e => { const i = tabs.indexOf(document.activeElement); if (i < 0) return;
    const k = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (k >= 0) { e.preventDefault(); show(k, true); } });
});

/* ---------- article: contents and reading progress ---------- */
const toc = $('.toc');
if (toc) {
  const hs = $$('.prose h2[id]'); toc.insertAdjacentHTML('beforeend', hs.map(h => `<a href="#${h.id}">${h.textContent}</a>`).join(''));
  const tio = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) $$('a', toc).forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + x.target.id)); }), { rootMargin: '0px 0px -70% 0px' });
  hs.forEach(h => tio.observe(h));
}

/* thank-you page names the form that was filled */
const thxW = $('#thxWhat'); if (thxW) { const f = store.get('form', true); if (f) thxW.textContent = f; }

/* ---------- a round label follows the pointer over tiles and links that carry data-cur ---------- */
if (matchMedia('(hover: hover) and (pointer: fine)').matches && $('[data-cur]')) {
  const cb = document.createElement('div'); cb.className = 'curb'; cb.setAttribute('aria-hidden', 'true');
  cb.innerHTML = '<span><b></b><i>→</i></span>'; document.body.appendChild(cb);
  const lb = $('b', cb); let x = -200, y = -200, cx = x, cy = y, cur = null, raf = 0;
  const pick = el => {
    const t = el && el.closest('[data-cur]');
    if (t === cur) return; cur = t;
    cb.classList.toggle('on', !!t); cb.classList.toggle('wh', !!t && t.dataset.curTone === 'wh');
    document.documentElement.classList.toggle('curon', !!t);
    if (t) lb.textContent = t.dataset.cur;
  };
  const step = () => { cx += (x - cx) * .28; cy += (y - cy) * .28; cb.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`; raf = Math.abs(x - cx) + Math.abs(y - cy) > .3 ? requestAnimationFrame(step) : 0; };
  const go = () => { if (!raf) raf = requestAnimationFrame(step); };
  document.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; if (!cur) { cx = e.clientX; cy = e.clientY; } x = e.clientX; y = e.clientY; pick(e.target); go(); }, { passive: true });
  // scrolling moves the page under a still pointer, so look again at what is under it
  addEventListener('scroll', () => { if (x > -100) pick(document.elementFromPoint(x, y)); }, { passive: true });
  document.addEventListener('pointerleave', () => pick(null));
  addEventListener('blur', () => pick(null));
}

/* ---------- a schematic opens large on click ---------- */
if ($('[data-zoom]')) {
  const zm = document.createElement('div'); zm.className = 'zoom'; zm.hidden = true; zm.setAttribute('role', 'dialog'); zm.setAttribute('aria-modal', 'true'); zm.setAttribute('aria-label', 'Схема крупно');
  zm.innerHTML = '<div class="zoom-in"><button class="zoom-x" type="button" aria-label="Закрыть">×</button><div class="zoom-sv"></div><p class="zoom-cap"></p></div>';
  document.body.appendChild(zm);
  let back = null;
  const close = () => { zm.hidden = true; document.documentElement.classList.remove('zoomed'); if (back) back.focus(); };
  const open = el => {
    const sv = $('svg', el); if (!sv) return; back = el;
    const c = sv.cloneNode(true); c.removeAttribute('width'); c.removeAttribute('height');
    $('.zoom-sv', zm).replaceChildren(c);
    const box = el.closest('.tsx-tx, .ts-view'); const h = box && $('h3, h2', box); $('.zoom-cap', zm).textContent = h ? h.textContent : '';
    zm.hidden = false; document.documentElement.classList.add('zoomed'); $('.zoom-x', zm).focus();
  };
  document.addEventListener('click', e => { const z = e.target.closest('[data-zoom]'); if (z && !zm.contains(z)) open(z); });
  document.addEventListener('keydown', e => { const z = e.target.closest && e.target.closest('[data-zoom]'); if (z && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(z); } if (e.key === 'Escape' && !zm.hidden) close(); });
  zm.addEventListener('click', e => { if (e.target === zm || e.target.closest('.zoom-x')) close(); });
}

/* ---------- a statement fills with green word by word as it passes the screen ---------- */
const fills = $$('[data-fill]');
fills.forEach(el => {
  const walk = n => [...n.childNodes].forEach(c => {
    if (c.nodeType === 3) { const f = document.createDocumentFragment(); c.textContent.split(/([ \t\n\r]+)/).forEach(t => { if (!t) return; if (/^[ \t\n\r]+$/.test(t)) f.appendChild(document.createTextNode(t)); else { const w = document.createElement('span'); w.className = 'fw'; w.textContent = t; f.appendChild(w); } }); c.replaceWith(f); }
    else if (c.nodeType === 1) walk(c);
  });
  walk(el); el._w = $$('.fw', el);
});
/* ---------- history: the year, the event and the photo follow the scroll ---------- */
const hists = $$('.hist');
hists.forEach(h => $$('.hist-ticks button', h).forEach(b => b.addEventListener('click', () => {
  const n = +getComputedStyle(h).getPropertyValue('--n') || 5, top = h.getBoundingClientRect().top + scrollY, run = h.offsetHeight - innerHeight;
  scrollTo({ top: top + run * ((+b.dataset.i + .5) / n), behavior: reduced() ? 'auto' : 'smooth' });
})));
let fillRaf = 0;
const fillTick = () => {
  fillRaf = 0; const vh = innerHeight;
  fills.forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom < -vh || r.top > vh * 2) return; const p = reduced() ? 1 : clamp((vh * .82 - r.top) / (r.height + vh * .3)); const k = Math.round(p * el._w.length); el._w.forEach((w, i) => w.classList.toggle('on', i < k)); });
  hists.forEach(h => {
    const r = h.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
    const p = clamp(-r.top / (h.offsetHeight - vh)), ys = $$('.hist-yr b', h), n = ys.length, i = Math.min(n - 1, Math.floor(p * n));
    h.style.setProperty('--p', p.toFixed(3));
    [ys, $$('.hist-ev p', h), $$('.hist-ph figure', h)].forEach(g => g.forEach((x, j) => x.classList.toggle('on', j === i)));
    $$('.hist-ticks button', h).forEach((b, j) => { b.classList.toggle('on', j === i); b.classList.toggle('past', j < i); });
  });
};
if (fills.length || hists.length) { addEventListener('scroll', () => { if (!fillRaf) fillRaf = requestAnimationFrame(fillTick); }, { passive: true }); addEventListener('resize', fillTick); fillTick(); }

/* ---------- side panel: projects, news, promotions and articles open their details here ---------- */
let drwEl = null, drwBack = null;
function openDrawer(D, from) {
  if (!drwEl) {
    drwEl = document.createElement('div'); drwEl.className = 'drw'; drwEl.hidden = true;
    drwEl.innerHTML = '<div class="drw-sh" data-close></div><aside class="drw-p" role="dialog" aria-modal="true" aria-labelledby="drwT"><button class="drw-x" type="button" data-close aria-label="Закрыть">×</button><div class="drw-b"></div></aside>';
    document.body.appendChild(drwEl);
    drwEl.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDrawer(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && drwEl && !drwEl.hidden) closeDrawer(); });
  }
  const T = x => nbText(String(x || ''));
  const ps = String(D.x || '').split(/\n\n+/).filter(Boolean).map(x => `<p>${T(x)}</p>`).join('');
  const dl = D.p && D.p.length ? `<dl class="drw-dl">${D.p.map(([k, v]) => `<div><dt>${T(k)}</dt><dd>${T(v)}</dd></div>`).join('')}</dl>` : '';
  const meta = D.tag || D.meta ? `<div class="nmeta">${D.tag ? `<b>${T(D.tag)}</b>` : ''}${D.meta ? `<span>${T(D.meta)}</span>` : ''}</div>` : '';
  const go = D.go ? `<a class="btn btn-red" href="${D.go[0]}"${D.go[2] ? ` data-pq="${D.go[2].replace(/"/g, '&quot;')}"` : ''}><span class="sw" data-t="${D.go[1]}"><span>${D.go[1]}</span></span> <span class="ar">→</span></a>` : '';
  $('.drw-b', drwEl).innerHTML = `${D.img ? `<div class="drw-ph"><img src="${D.img}" alt=""></div>` : ''}<div class="drw-tx">${meta}<h2 id="drwT">${T(D.t)}</h2>${ps}${dl}${go ? `<div class="btns">${go}</div>` : ''}</div>`;
  $('.drw-b', drwEl).scrollTop = 0; drwBack = from || document.activeElement;
  drwEl.hidden = false; document.documentElement.classList.add('zoomed');
  requestAnimationFrame(() => { drwEl.classList.add('on'); $('.drw-x', drwEl).focus({ preventScroll: true }); });
}
function closeDrawer() {
  if (!drwEl) return; drwEl.classList.remove('on'); document.documentElement.classList.remove('zoomed');
  setTimeout(() => { drwEl.hidden = true; }, reduced() ? 0 : 420); if (drwBack && drwBack.focus) drwBack.focus({ preventScroll: true });
}
document.addEventListener('click', e => {
  const c = e.target.closest('[data-drawer]'); if (!c || e.metaKey || e.ctrlKey || e.shiftKey) return;
  let D; try { D = JSON.parse(c.dataset.drawer); } catch (_) { return; }
  e.preventDefault(); e.stopPropagation(); openDrawer(D, c);
}, true);
document.addEventListener('keydown', e => { const c = e.target.closest && e.target.closest('div[data-drawer]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.click(); } });

/* ---------- contacts: the Yandex map widget; where the host forbids frames the street plan stays ---------- */
const ymap = $('[data-ymap]');
if (ymap) {
  let blocked = false;
  const fr = document.createElement('iframe'); fr.title = 'Офис на карте Яндекса'; fr.loading = 'lazy'; fr.setAttribute('allowfullscreen', '');
  document.addEventListener('securitypolicyviolation', ev => { if (/yandex/.test(ev.blockedURI || '')) { blocked = true; fr.remove(); ymap.classList.remove('on'); } });
  fr.addEventListener('load', () => setTimeout(() => { if (!blocked && fr.isConnected) ymap.classList.add('on'); }, 400));
  fr.src = ymap.dataset.ymap; ymap.appendChild(fr);
}

/* ---------- request form in a side panel: buttons like «Оставить заявку» and «Задать вопрос» open it in place ---------- */
const pop = $('#pop');
if (pop) {
  const POP_IDS = ['vopros', 'forma', 'raschet-forma', 'zayavka'];
  let popBack = null;
  const popClose = () => { pop.classList.remove('on'); document.documentElement.classList.remove('zoomed'); setTimeout(() => { pop.hidden = true; }, reduced() ? 0 : 420); if (popBack && popBack.focus) popBack.focus({ preventScroll: true }); };
  const popOpen = from => {
    if (typeof closeDrawer === 'function' && drwEl && !drwEl.hidden) closeDrawer();
    const t = ((from && (from.dataset.pop || from.textContent)) || '').toLowerCase();
    const ask = /вопрос|написать|спросить|связаться/.test(t), calc = /рассч|расч|стоимост|цен/.test(t);
    $('#popT').textContent = ask ? 'Задать вопрос' : calc ? 'Расчёт за 1 день' : 'Оставить заявку';
    $('#popS').textContent = ask ? 'Ответим в рабочее время, по существу. Можно приложить проект или фото узла.' : 'Менеджер перезвонит в рабочее время, уточнит параметры объекта и подготовит расчёт за 1 день в нескольких вариантах.';
    const f = $('form', pop); f.dataset.form = $('#popT').textContent; const n = $('.fnote', f); if (n) n.textContent = '';
    const q = $('#pop-q'); if (q && from && from.dataset.pq && !q.value) q.value = from.dataset.pq;
    popBack = from; pop.hidden = false; document.documentElement.classList.add('zoomed');
    requestAnimationFrame(() => { pop.classList.add('on'); const i = $('#pop-n'); if (i) i.focus({ preventScroll: true }); });
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-pop], a[href]'); if (!a || pop.contains(a) || a.closest('[data-drawer]') || e.metaKey || e.ctrlKey || e.shiftKey) return;
    let hit = a.hasAttribute('data-pop');
    if (!hit) { try { const u = new URL(a.href, location.href); hit = u.origin === location.origin && POP_IDS.includes(u.hash.slice(1)); } catch (_) {} }
    if (!hit) return;
    e.preventDefault(); e.stopPropagation(); setMenu(false); popOpen(a);
  }, true);
  pop.addEventListener('click', e => { if (e.target.closest('[data-pclose]')) popClose(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) popClose(); });
}

/* ---------- attach files: list, remove, drop onto the field ---------- */
$$('.ffile').forEach(box => {
  const inp = $('input[type="file"]', box), list = $('.ffile-l', box), lab = $('label', box);
  const size = b => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ';
  const draw = () => { list.innerHTML = [...inp.files].map((f, i) => `<li class="${f.size > 20971520 ? 'bad' : ''}"><span>${f.name.replace(/</g, '&lt;')}</span><small>${f.size > 20971520 ? 'больше 20 МБ' : size(f.size)}</small><button type="button" data-i="${i}" aria-label="Убрать файл">×</button></li>`).join(''); };
  const set = files => { try { const dt = new DataTransfer(); files.forEach(f => dt.items.add(f)); inp.files = dt.files; } catch (_) {} draw(); };
  inp.addEventListener('change', draw);
  list.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) set([...inp.files].filter((_, i) => i !== +b.dataset.i)); });
  ['dragenter', 'dragover'].forEach(t => lab.addEventListener(t, e => { e.preventDefault(); box.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(t => lab.addEventListener(t, () => box.classList.remove('drag')));
  lab.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) set([...inp.files, ...e.dataTransfer.files]); });
});

/* ---------- "show more": draft tiles stand in for projects that will be added ---------- */
$$('[data-more]').forEach(b => { let n = 0; b.addEventListener('click', () => {
  const g = document.getElementById(b.dataset.more); if (!g) return;
  g.insertAdjacentHTML('beforeend', Array.from({ length: 3 }, () => '<div class="pjt pjt-draft"><span class="pjt-tag"><b>Объект</b>скоро</span><div class="pjt-tx"><span class="pjt-who">Черновик</span><h3>Здесь будет следующий проект</h3></div></div>').join(''));
  if (++n >= 2) b.closest('.more-row').hidden = true;
}); });
})();

// footer: a render of the product follows the cursor over the product list
(() => {
  const ft = document.querySelector('.ft'); if (!ft || !matchMedia('(hover: hover)').matches) return;
  const pic = ft.querySelector('.ft-pic'), img = pic.querySelector('img'); let x = 0, y = 0, tx = 0, ty = 0, raf = 0, on = false;
  const step = () => { x += (tx - x) * .2; y += (ty - y) * .2; pic.style.setProperty('--x', x + 'px'); pic.style.setProperty('--y', y + 'px'); raf = on || Math.abs(tx - x) + Math.abs(ty - y) > .5 ? requestAnimationFrame(step) : 0; };
  const place = e => { const r = ft.getBoundingClientRect(); tx = e.clientX - r.left + 28; ty = e.clientY - r.top - pic.offsetHeight / 2; };
  ft.querySelectorAll('[data-ftimg]').forEach(a => {
    a.addEventListener('pointerenter', e => { img.src = a.dataset.ftimg; if (!on) { place(e); x = tx; y = ty; } on = true; pic.classList.add('on'); if (!raf) raf = requestAnimationFrame(step); });
    a.addEventListener('pointerleave', () => { on = false; pic.classList.remove('on'); });
  });
  ft.addEventListener('pointermove', e => { if (on) place(e); });
})();

// cx: centred blocks get a quiet drawing grid centred on their text; cells under the cursor fill in and fade
(() => {
  const els = document.querySelectorAll('[data-cx]'); if (!els.length) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches, hover = matchMedia('(hover: hover)').matches;
  els.forEach(sec => {
    const cv = sec.querySelector('.cx-bg'), c = cv && cv.getContext('2d'); if (!c) return;
    const rgb = sec.classList.contains('gr') ? '255,255,255' : '1,90,87', anchor = sec.querySelector('.cx-in, .st') || sec;
    let W = 0, H = 0, S = 64, ox = 0, oy = 0, X = 0, Y = 0, RX = 1, RY = 1, dpr = 1, raf = 0, t0 = 0, p = still ? 1 : 0, e = p; const cells = new Map();
    const fall = (x, y) => Math.max(0, 1 - Math.hypot((x - X) / (RX * e), (y - Y) / (RY * e))) ** 1.3;
    function draw() {
      raf = 0; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      const now = performance.now(); if (t0 && p < 1) p = Math.min(1, (now - t0) / 1600); if (p <= 0) return;
      e = Math.max(.001, 1 - (1 - p) ** 3);   // the grid spreads out from the centre when the block comes into view
      cells.forEach((tc, key) => { const a = 1 - (now - tc) / 1100; if (a <= 0) { cells.delete(key); return; }
        const i = key >> 10, j = (key & 1023) - 512, x = ox + i * S, y = oy + j * S;
        c.fillStyle = `rgba(${rgb},${(.06 + .07 * fall(x + S / 2, y + S / 2)) * a})`; c.fillRect(x, y, S, S); });
      c.lineWidth = 1;
      for (let x = ox; x <= W; x += S) for (let y = oy - S; y < H; y += S) { const a = .16 * fall(x, y + S / 2); if (a < .004) continue; c.strokeStyle = `rgba(${rgb},${a})`; c.beginPath(); c.moveTo(x + .5, y); c.lineTo(x + .5, y + S); c.stroke(); }
      for (let y = oy; y <= H; y += S) for (let x = ox - S; x < W; x += S) { const a = .16 * fall(x + S / 2, y); if (a < .004) continue; c.strokeStyle = `rgba(${rgb},${a})`; c.beginPath(); c.moveTo(x, y + .5); c.lineTo(x + S, y + .5); c.stroke(); }
      // drafting crosses on every third node
      for (let x = X - Math.floor(X / (S * 3)) * S * 3; x <= W; x += S * 3) for (let y = Y - Math.floor(Y / (S * 3)) * S * 3; y <= H; y += S * 3) { const a = .45 * fall(x, y); if (a < .01) continue; c.strokeStyle = `rgba(${rgb},${a})`; c.beginPath(); c.moveTo(x - 5, y + .5); c.lineTo(x + 6, y + .5); c.moveTo(x + .5, y - 5); c.lineTo(x + .5, y + 6); c.stroke(); }
      if (cells.size || p < 1) raf = requestAnimationFrame(draw);
    }
    const size = () => {
      const r = sec.getBoundingClientRect(), b = anchor.getBoundingClientRect(); if (!r.width) return;
      dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      S = W < 700 ? 44 : 64; X = Math.round(W / 2); Y = Math.round(b.top - r.top + b.height / 2);
      RX = Math.max(W * .48, 320); RY = Math.max(b.height * .95, 260); ox = ((X % S) + S) % S; oy = ((Y % S) + S) % S; draw();
    };
    new ResizeObserver(size).observe(sec);
    new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { sec.classList.add('cx-on'); if (!t0) t0 = performance.now(); size(); } }), { threshold: .2 }).observe(sec);
    if (hover && !still) sec.addEventListener('pointermove', e => {
      const r = sec.getBoundingClientRect(), i = Math.floor((e.clientX - r.left - ox) / S), j = Math.floor((e.clientY - r.top - oy) / S);
      if (i < 0 || j < -512 || j > 511) return; cells.set((i << 10) | (j + 512), performance.now()); if (!raf) raf = requestAnimationFrame(draw);
    });
  });
})();


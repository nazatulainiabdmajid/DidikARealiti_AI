/* ArKad · pustaka AR kad bercetak untuk aplikasi DidikARealiti AI
   © 2026 FTSM, Universiti Kebangsaan Malaysia · CC BY-NC-SA 4.0

   Cara guna (tambah dalam <head>, SEBELUM skrip lain):
     <script src="https://nazatulainiabdmajid.github.io/DidikARealiti_AI/ar-kad.js"></script>

   Kemudian dalam skrip aplikasi:
     ArKad.sediakan({
       kad: [ {nama:"Ayam", info:"Bertelur"}, {nama:"Kucing", info:"Beranak"} ],
       apabilaJumpa: (i, kad) => { ... },   // dipanggil apabila kamera mengesan kad ke-i
       apabilaHilang: (i, kad) => { ... }   // pilihan
     });
     ArKad.mula();              // butang "Dengan kamera": buka kamera AR skrin penuh
     ArKad.henti();             // tutup kamera (butang Tutup juga disediakan)
     ArKad.paparKad("#kadSaya"); // papar kad untuk dicetak dalam elemen itu
     ArKad.gambarKad();         // senarai gambar kad (data URL), contohnya untuk mod klik

   Kad dilukis sendiri oleh pustaka ini (bingkai bercorak + nama), jadi kad yang dicetak
   sama dengan kad yang dikesan kamera. Penanda disediakan dalam pelayar, sekali sahaja. */
(function () {
  "use strict";
  if (window.ArKad) return;
  var V = "1.0";
  var URLS = {
    three: "https://unpkg.com/three@0.160.0/build/three.module.js",
    mindImage: "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js",
    mindThree: "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js"
  };
  // Peta import untuk "three" (diperlukan oleh MindAR). Ditambah hanya jika halaman belum ada.
  try {
    if (!document.querySelector('script[type="importmap"]')) {
      var im = document.createElement("script");
      im.type = "importmap";
      im.textContent = JSON.stringify({ imports: { three: URLS.three, "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/" } });
      var cs = document.currentScript; if (cs && cs.parentNode) cs.insertAdjacentElement("afterend", im); else (document.head || document.documentElement).appendChild(im);
    }
  } catch (e) {}

  var cfg = { kad: [], apabilaJumpa: null, apabilaHilang: null, misi: null, suara: true };
  var last = { i: -1, t: 0 };
  var misT = null;
  var cards = [];       // data URL bagi setiap kad
  var mindar = null, run = 0, wrap = null;

  function prng(seed) { var x = seed; return function () { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function drawCard(k, i) {
    var N = 600, cv = document.createElement("canvas"); cv.width = cv.height = N;
    var c = cv.getContext("2d"), r = prng(97 + i * 7919);
    var COL = ["#D9480F", "#1864AB", "#2B8A3E", "#6741D9", "#C2255C", "#0B7285", "#E67700", "#5C940D"], K = COL[i % COL.length];
    c.fillStyle = "#fff"; c.fillRect(0, 0, N, N);
    // bingkai bercorak: ciri unik untuk pengesanan
    for (var y = 0; y < N; y += 30) for (var x = 0; x < N; x += 30) {
      if (x >= 60 && x < N - 60 && y >= 60 && y < N - 60) continue;
      var t = Math.floor(r() * 4); c.fillStyle = r() < .5 ? K : "#1B2430"; c.beginPath();
      if (t === 0) { c.moveTo(x, y); c.lineTo(x + 30, y); c.lineTo(x, y + 30); }
      else if (t === 1) { c.moveTo(x + 30, y); c.lineTo(x + 30, y + 30); c.lineTo(x, y + 30); }
      else if (t === 2) { c.arc(x + 15, y + 15, 11, 0, 7); }
      else { c.rect(x + 6, y + 6, 18, 18); }
      c.fill();
    }
    c.lineWidth = 6; c.strokeStyle = "#1B2430"; c.strokeRect(60, 60, N - 120, N - 120);
    // gambar: lukisan guru jika ada, jika tiada corak geometri unik
    c.save(); c.beginPath(); c.rect(66, 66, N - 132, 330); c.clip();
    if (typeof k.lukis === "function") { try { c.save(); c.translate(N / 2, 235); k.lukis(c, 300); c.restore(); } catch (e) {} }
    else {
      for (var j = 0; j < 14; j++) {
        var cx = 90 + r() * 420, cy = 90 + r() * 290, s = 26 + r() * 46, tt = Math.floor(r() * 3);
        c.fillStyle = [K, "#1B2430", "#FFD43B", "#74C0FC", "#8CE99A"][Math.floor(r() * 5)];
        c.strokeStyle = "#1B2430"; c.lineWidth = 5; c.beginPath();
        if (tt === 0) c.arc(cx, cy, s / 2, 0, 7);
        else if (tt === 1) c.rect(cx - s / 2, cy - s / 2, s, s);
        else { c.moveTo(cx, cy - s / 2); c.lineTo(cx + s / 2, cy + s / 2); c.lineTo(cx - s / 2, cy + s / 2); c.closePath(); }
        c.fill(); c.stroke();
      }
    }
    c.restore();
    // nama kad
    c.fillStyle = "#fff"; c.fillRect(66, 400, N - 132, 134);
    c.fillStyle = "#1B2430"; c.textAlign = "center"; c.textBaseline = "middle";
    var nm = String(k.nama || ("Kad " + (i + 1))), fs = 64;
    c.font = "700 " + fs + "px Arial, Helvetica, sans-serif";
    while (c.measureText(nm).width > N - 160 && fs > 26) { fs -= 4; c.font = "700 " + fs + "px Arial, Helvetica, sans-serif"; }
    c.fillText(nm, N / 2, 455);
    c.font = "700 26px Arial, Helvetica, sans-serif"; c.fillStyle = K; c.fillText("KAD " + (i + 1), N / 2, 510);
    return cv.toDataURL("image/png");
  }

  function sediakan(o) {
    o = o || {};
    cfg.kad = (o.kad || []).map(function (k) { return typeof k === "string" ? { nama: k } : k; });
    cfg.apabilaJumpa = o.apabilaJumpa || null;
    cfg.apabilaHilang = o.apabilaHilang || null;
    cfg.misi = o.misi || null;
    cfg.suara = o.suara !== false;
    cards = cfg.kad.map(drawCard);
    return cards.slice();
  }
  function gambarKad() { if (!cards.length && cfg.kad.length) cards = cfg.kad.map(drawCard); return cards.slice(); }

  // ---------- simpanan penanda (IndexedDB) ----------
  function idb() { return new Promise(function (res, rej) { var r = indexedDB.open("arkad", 1); r.onupgradeneeded = function () { r.result.createObjectStore("k"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function idbGet(k) { return idb().then(function (db) { return new Promise(function (r) { var q = db.transaction("k").objectStore("k").get(k); q.onsuccess = function () { r(q.result); }; q.onerror = function () { r(null); }; }); }).catch(function () { return null; }); }
  function idbSet(k, v) { return idb().then(function (db) { db.transaction("k", "readwrite").objectStore("k").put(v, k); }).catch(function () {}); }

  // ---------- antara muka skrin penuh ----------
  function css() {
    if (document.getElementById("arkad-css")) return;
    var s = document.createElement("style"); s.id = "arkad-css";
    s.textContent = "#arkad{position:fixed;inset:0;z-index:2147483000;background:#000;font-family:Arial,Helvetica,sans-serif}#arkad .ak-box{position:absolute;inset:0;overflow:hidden}#arkad .ak-box video{object-fit:cover}"
      + "#arkad .ak-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;background:linear-gradient(#000a,#0000);z-index:5;color:#fff}"
      + "#arkad .ak-st{font-size:14px;font-weight:700;text-shadow:0 1px 3px #000}#arkad .ak-x{border:0;border-radius:999px;padding:10px 16px;font:700 15px Arial,sans-serif;background:#fff;color:#1B2430;cursor:pointer}"
      + "#arkad .ak-bar{height:6px;background:#ffffff40;border-radius:3px;margin-top:6px;overflow:hidden;width:180px}#arkad .ak-bar i{display:block;height:100%;width:0;background:#FFD43B}"
      + "#arkad .ak-lab{position:absolute;z-index:4;transform:translate(-50%,-100%);background:#fff;color:#1B2430;border:3px solid #0E7C7B;border-radius:14px;padding:8px 12px;font-weight:700;font-size:18px;text-align:center;pointer-events:none;max-width:70vw;box-shadow:0 4px 14px #0006}"
      + "#arkad .ak-lab small{display:block;font-weight:400;font-size:14px;color:#33414C;margin-top:2px}"
      + "#arkad .ak-info{position:absolute;left:12px;right:12px;top:calc(64px + env(safe-area-inset-top,0px));z-index:5;background:#fffffff2;color:#1B2430;border-radius:14px;padding:10px 14px;font-size:16px;display:none}"
      + "#arkad .ak-mis{position:absolute;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:5;background:#fffffff2;color:#1B2430;border-radius:14px;padding:10px 14px;font-size:15px;line-height:1.4;max-height:34vh;overflow:auto;box-shadow:0 4px 14px #0006}#arkad .ak-mis:empty{display:none}#arkad .ak-mis p{margin:4px 0 0}#arkad .ak-mis .ak-mt{display:block;font-size:12px;font-weight:700;color:#0E7C7B;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}"
      + "#arkad .ak-err{position:absolute;left:16px;right:16px;top:40%;z-index:6;background:#fff;color:#1B2430;border-radius:14px;padding:14px;font-size:15px;display:none}"
      + ".arkad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.arkad-grid figure{margin:0;text-align:center;font:600 13px Arial,sans-serif;color:#1B2430}.arkad-grid img{width:100%;max-width:7cm;aspect-ratio:1;border:1px dashed #999}"
      + "@media print{.arkad-noprint{display:none!important}.arkad-grid{grid-template-columns:repeat(2,7cm);gap:1cm}.arkad-grid img{width:7cm;height:7cm}}";
    document.head.appendChild(s);
  }
  function ui() {
    css();
    wrap = document.createElement("div"); wrap.id = "arkad";
    wrap.innerHTML = '<div class="ak-box"></div><div class="ak-top"><div><div class="ak-st">Menyediakan kamera…</div><div class="ak-bar" hidden><i></i></div></div><button class="ak-x" type="button">✕ Tutup</button></div><div class="ak-lab" hidden></div><div class="ak-info"></div><div class="ak-mis" aria-live="polite"></div><div class="ak-err"></div>';
    document.body.appendChild(wrap);
    wrap.querySelector(".ak-x").onclick = function () { henti(); };
    return wrap;
  }
  // ---------- misi semasa (dipaparkan di atas video kamera) ----------
  function misiHTML() {
    var m = cfg.misi, el = null;
    try {
      if (typeof m === "function") m = m();
      if (typeof m === "string" && m.trim()) {
        if (/^[#.\[]/.test(m.trim())) { el = document.querySelector(m.trim()); }
        else return '<span class="ak-mt">Misi</span>' + esc(m);
      } else if (m && m.nodeType === 1) el = m;
      if (!el) el = document.querySelector(".mcur") || document.querySelector("[id*='misi' i]:not(#arkad *),[class*='misi' i]:not(#arkad *)");
      if (!el) return "";
      var c = el.cloneNode(true);
      c.querySelectorAll("button,input,select,textarea,script,style,svg,img,canvas,video").forEach(function (x) { x.remove(); });
      c.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;display:block"; c.removeAttribute("hidden"); document.body.appendChild(c);
      var kids = Array.prototype.map.call(c.children, function (ch) { return (ch.innerText || ch.textContent || "").replace(/\s+/g, " ").trim(); }).filter(Boolean);
      var txt = kids.length > 1 ? kids.join("\n") : (c.innerText || c.textContent || ""); c.remove(); txt = txt.replace(/\n{2,}/g, "\n").trim();
      if (!txt) return "";
      var lines = txt.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      return '<span class="ak-mt">' + esc(lines[0]) + "</span>" + lines.slice(1, 5).map(function (x, k) { return k === 0 ? "<b>" + esc(x) + "</b>" : "<p>" + esc(x) + "</p>"; }).join("");
    } catch (e) { return ""; }
  }
  // Sebut nama kad jika aplikasi sendiri tidak bersuara (suara:false untuk mematikan).
  function suara(k) {
    try {
      if (!cfg.suara || !window.speechSynthesis) return;
      if (speechSynthesis.speaking || speechSynthesis.pending) return;
      var u = new SpeechSynthesisUtterance(String(k.nama || "") + (k.info ? ". " + k.info : ""));
      u.lang = "ms-MY";
      var v = speechSynthesis.getVoices().filter(function (x) { return /^(ms|id)/i.test(x.lang); })[0];
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function misi(t) { if (t !== undefined) cfg.misi = t; if (wrap) { var h = misiHTML(), b = wrap.querySelector(".ak-mis"); if (b && b.innerHTML !== h) b.innerHTML = h; } }
  function st(t) { if (wrap) wrap.querySelector(".ak-st").textContent = t; }
  function prog(p) { if (!wrap) return; var b = wrap.querySelector(".ak-bar"); b.hidden = p == null; b.querySelector("i").style.width = (p || 0) + "%"; }

  async function targets() {
    var key = "v" + V + "|" + cfg.kad.map(function (k) { return k.nama; }).join("|");
    var buf = await idbGet(key);
    if (!buf) {
      st("Menyediakan kad untuk dikesan (sekali sahaja)…"); prog(0);
      var mod = await import(URLS.mindImage);
      var Compiler = mod.Compiler || (window.MINDAR && window.MINDAR.IMAGE && window.MINDAR.IMAGE.Compiler);
      if (!Compiler) throw new Error("Pengkompil MindAR tidak ditemui.");
      var imgs = await Promise.all(gambarKad().map(function (src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }));
      var comp = new Compiler();
      await comp.compileImageTargets(imgs, function (p) { prog(Math.round(p)); });
      buf = await comp.exportData(); await idbSet(key, buf); prog(null);
    }
    return URL.createObjectURL(new Blob([buf]));
  }

  function camErr(e) {
    var n = e && e.name, m = (e && e.message) || String(e);
    var inFrame = (function () { try { return window.self !== window.top; } catch (_) { return true; } })();
    if (n === "NotAllowedError" || /permission|denied/i.test(m)) return "Kebenaran kamera ditolak. Benarkan kamera dalam tetapan pelayar, kemudian cuba lagi.";
    if (n === "NotFoundError") return "Tiada kamera ditemui pada peranti ini.";
    if (n === "NotReadableError") return "Kamera sedang digunakan oleh aplikasi atau tab lain. Tutup yang lain, kemudian cuba lagi.";
    if (inFrame) return "Kamera AR tidak dapat dibuka dalam pratonton ini. Terbitkan aplikasi di GitHub Pages dan buka pautannya dalam Chrome untuk mengimbas kad.";
    return "AR tidak dapat dimulakan: " + m + ". Pastikan halaman dibuka melalui https dan internet tersedia.";
  }

  async function mula() {
    last = { i: -1, t: 0 };
    try { if (window.speechSynthesis) speechSynthesis.getVoices(); } catch (e) {}
    if (!cfg.kad.length) { console.warn("ArKad: panggil ArKad.sediakan({kad:[...]}) dahulu."); return; }
    if (wrap) return;
    var my = ++run; ui();
    try {
      if (!window.isSecureContext) throw new Error("Kamera hanya berfungsi melalui pautan https (contohnya GitHub Pages).");
      var src = await targets(); if (my !== run) return;
      st("Membuka kamera…");
      var THREE = await import("three");
      var MT = (await import(URLS.mindThree)).MindARThree;
      if (my !== run) return;
      var box = wrap.querySelector(".ak-box"), lab = wrap.querySelector(".ak-lab"), info = wrap.querySelector(".ak-info");
      mindar = new MT({ container: box, imageTargetSrc: src, maxTrack: 1, uiLoading: "no", uiScanning: "yes" });
      var shown = -1, v = new THREE.Vector3();
      cfg.kad.forEach(function (k, i) {
        var a = mindar.addAnchor(i);
        a.onTargetFound = function () {
          shown = i;
          lab.innerHTML = esc(k.nama) + (k.info ? "<small>" + esc(k.info) + "</small>" : ""); lab.hidden = false;
          info.style.display = k.terangan ? "block" : "none"; info.innerHTML = k.terangan ? esc(k.terangan) : "";
          // Kamera kerap "hilang dan jumpa semula" kad yang sama dalam sesaat. Panggil aplikasi sekali sahaja
          // bagi setiap kad, kecuali kad itu dijumpai semula selepas 4 saat. Ini mengelakkan suara terputus-putus.
          var now = Date.now();
          if (i !== last.i || now - last.t > 4000) {
            last = { i: i, t: now };
            try { cfg.apabilaJumpa && cfg.apabilaJumpa(i, k); } catch (e) { console.error(e); }
            setTimeout(function () { suara(k); }, 400);
          } else last.t = now;
          setTimeout(misi, 150);
        };
        a.onTargetLost = function () {
          if (shown === i) { shown = -1; lab.hidden = true; info.style.display = "none"; }
          try { cfg.apabilaHilang && cfg.apabilaHilang(i, k); } catch (e) { console.error(e); }
        };
      });
      var m = mindar; await m.start();
      if (my !== run) { try { m.renderer.setAnimationLoop(null); await m.stop(); } catch (_) {} return; }
      st("Halakan kamera ke kad"); misi(); clearInterval(misT); misT = setInterval(misi, 1000);
      m.renderer.setAnimationLoop(function () {
        m.renderer.render(m.scene, m.camera);
        if (shown >= 0 && m.anchors[shown]) {
          try {
            v.setFromMatrixPosition(m.anchors[shown].group.matrixWorld); v.y += 0.55; v.project(m.camera);
            var W = box.clientWidth, H = box.clientHeight;
            lab.style.left = Math.max(60, Math.min(W - 60, (v.x * .5 + .5) * W)) + "px";
            lab.style.top = Math.max(70, Math.min(H - 20, (-v.y * .5 + .5) * H)) + "px";
          } catch (_) {}
        }
      });
    } catch (e) {
      if (my !== run) return;
      console.error(e);
      var er = wrap && wrap.querySelector(".ak-err"); if (er) { er.textContent = camErr(e); er.style.display = "block"; }
      st(""); prog(null); await cleanup(false);
    }
  }

  async function cleanup(removeUi) {
    clearInterval(misT); misT = null;
    var m = mindar; mindar = null;
    try { m && m.renderer.setAnimationLoop(null); } catch (e) {}
    try { m && await m.stop(); } catch (e) {}
    try { document.querySelectorAll("#arkad video").forEach(function (vd) { if (vd.srcObject) vd.srcObject.getTracks().forEach(function (t) { t.stop(); }); }); } catch (e) {}
    document.querySelectorAll(".mindar-ui-overlay,.mindar-ui-scanning,.mindar-ui-loading,.mindar-ui-compatibility").forEach(function (e) { e.remove(); });
    if (removeUi !== false && wrap) { wrap.remove(); wrap = null; }
  }
  async function henti() { run++; await cleanup(true); }

  function paparKad(el) {
    var host = typeof el === "string" ? document.querySelector(el) : el; if (!host) return;
    css();
    var imgs = gambarKad();
    host.innerHTML = '<p class="arkad-noprint" style="font:14px Arial,sans-serif;color:#33414C;margin:0 0 8px">Cetak kad ini saiz sebenar (7 cm). Murid mengimbas kad dengan butang kamera.</p>'
      + '<button type="button" class="arkad-noprint arkad-print" style="border:0;border-radius:10px;padding:8px 14px;font:700 14px Arial,sans-serif;background:#0E7C7B;color:#fff;cursor:pointer;margin-bottom:10px">🖨 Cetak kad</button>'
      + '<div class="arkad-grid">' + imgs.map(function (s, i) { return '<figure><img src="' + s + '" alt="Kad ' + (i + 1) + ': ' + esc(cfg.kad[i].nama) + '"><figcaption>' + (i + 1) + '. ' + esc(cfg.kad[i].nama) + '</figcaption></figure>'; }).join("") + "</div>";
    host.querySelector(".arkad-print").onclick = function () { cetak(); };
  }
  function cetak() {
    var imgs = gambarKad();
    var html = '<!doctype html><meta charset="utf-8"><title>Kad AR</title><style>@page{size:A4;margin:12mm}body{font:12px Arial,sans-serif;margin:0}.g{display:grid;grid-template-columns:repeat(2,7cm);gap:8mm 10mm;justify-content:center}figure{margin:0;text-align:center;break-inside:avoid}img{width:7cm;height:7cm;border:1px dashed #999}</style><div class="g">'
      + imgs.map(function (s, i) { return '<figure><img src="' + s + '"><figcaption>' + (i + 1) + ". " + esc(cfg.kad[i].nama) + "</figcaption></figure>"; }).join("") + "</div>";
    var w = null; try { w = window.open("", "_blank"); } catch (e) {}
    if (w) { w.document.write(html); w.document.close(); setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 400); }
    else { try { window.print(); } catch (e) {} }
  }

  window.ArKad = { versi: V, sediakan: sediakan, mula: mula, misi: misi, henti: henti, gambarKad: gambarKad, paparKad: paparKad, cetak: cetak };
})();

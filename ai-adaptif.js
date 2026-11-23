/* AIAdaptif · kuiz adaptif berasaskan logik kabur (fuzzy Mamdani) untuk aplikasi DidikARealiti AI
   © 2026 FTSM, Universiti Kebangsaan Malaysia · CC BY-NC-SA 4.0
   Enjin, fungsi keahlian dan 10 peraturan sama seperti dalam template DidikARealiti AI.

   Cara guna:
     <script src="https://nazatulainiabdmajid.github.io/DidikARealiti_AI/ai-adaptif.js"></script>
     AIAdaptif.kuiz("#bekasKuiz", {
       soalan: [ {lvl:1, c:"konsep", t:"Teks soalan?", o:["A","B","C","D"], a:"A", h:"Petunjuk"} , ... ],
       pembetulan: { "konsep": {t:"Tajuk ulang kaji", d:"Penerangan ringkas"} },
       jumlah: 8,
       mesej: (jenis, teks) => { ... },      // jenis: "pencetus" | "cadangan" | "pujian" | "ganjaran"
       apabilaBetul: (soalan, cubaanPertama) => { ... },
       apabilaSelesai: (keputusan) => { ... }
     });
     AIAdaptif.rekod({ok:true, hints:0, secs:12, exp:20, concept:"konsep"});  // aktiviti lain (contohnya fasa Cuba)
     AIAdaptif.tahap();   // {ready, tier:"novis|sederhana|mahir", lvl:1..3, score}
     AIAdaptif.panel("#bekasPanel");   // panel AI Adaptif sahaja                                       */
(function () {
  "use strict";
  if (window.AIAdaptif) return;

  /* ================= AI ADAPTIF: ENJIN LOGIK KABUR (FUZZY) MAMDANI ================= */
  function fzTrap(x, s) { var a = s[0], b = s[1], c = s[2], d = s[3]; if (x < a || x > d) return 0; if (x >= b && x <= c) return 1; return x < b ? (x - a) / (b - a) : (d - x) / (d - c); }
  var FZ = {
    in: { ketepatan: { label: "Ketepatan", max: 100, fmt: function (v) { return Math.round(v) + "%"; }, sets: { rendah: [0, 0, 30, 50], sederhana: [30, 55, 55, 80], tinggi: [60, 80, 100, 100] } },
          petunjuk: { label: "Petunjuk", max: 2, fmt: function (v) { return v.toFixed(1) + " / soalan"; }, sets: { sedikit: [0, 0, 0.2, 0.6], sederhana: [0.2, 0.6, 0.6, 1.2], banyak: [0.8, 1.4, 2, 2] } },
          masa: { label: "Masa", max: 3, fmt: function (v) { return v.toFixed(1) + "× jangkaan"; }, sets: { pantas: [0, 0, 0.5, 0.9], biasa: [0.6, 1, 1, 1.5], lambat: [1.2, 2, 3, 3] } } },
    out: { novis: [0, 0, 25, 45], sederhana: [30, 50, 50, 70], mahir: [55, 75, 100, 100] },
    rules: [
      [{ ketepatan: "rendah" }, "novis"],
      [{ ketepatan: "sederhana", petunjuk: "sedikit" }, "sederhana"],
      [{ ketepatan: "sederhana", petunjuk: "sederhana" }, "sederhana"],
      [{ ketepatan: "sederhana", petunjuk: "banyak" }, "novis"],
      [{ ketepatan: "tinggi", petunjuk: "sedikit" }, "mahir"],
      [{ ketepatan: "tinggi", petunjuk: "sederhana" }, "sederhana"],
      [{ ketepatan: "tinggi", petunjuk: "banyak" }, "sederhana"],
      [{ ketepatan: "tinggi", masa: "pantas" }, "mahir"],
      [{ ketepatan: "tinggi", masa: "lambat" }, "sederhana"],
      [{ petunjuk: "banyak", masa: "lambat" }, "novis"]] };
  var FZ_N = { novis: "Novis", sederhana: "Sederhana", mahir: "Mahir" };
  var ARAS = ["", "Mudah", "Sederhana", "Sukar"];
  var AIA_DO = { novis: "Jadi soalan seterusnya lebih mudah, dan petunjuk diberi dengan lebih jelas.", sederhana: "Jadi soalan seterusnya pada aras Sederhana, dengan petunjuk umum apabila perlu.", mahir: "Jadi soalan seterusnya lebih mencabar, dan petunjuk hanya diberi jika kamu memintanya." };
  function fzInfer(x) {
    var mu = {}, k, s;
    for (k in FZ.in) { mu[k] = {}; for (s in FZ.in[k].sets) mu[k][s] = fzTrap(Math.max(0, Math.min(x[k], FZ.in[k].max)), FZ.in[k].sets[s]); }
    var fired = FZ.rules.map(function (r, i) { return { i: i + 1, c: r[0], o: r[1], w: Math.min.apply(null, Object.keys(r[0]).map(function (kk) { return mu[kk][r[0][kk]]; })) }; });
    var cut = {}; fired.forEach(function (r) { cut[r.o] = Math.max(cut[r.o] || 0, r.w); });
    var num = 0, den = 0;
    for (var y = 0; y <= 100; y++) { var m = 0; for (var o in FZ.out) m = Math.max(m, Math.min(cut[o] || 0, fzTrap(y, FZ.out[o]))); num += y * m; den += m; }
    var score = den ? num / den : 50, tier = score < 40 ? "novis" : score < 65 ? "sederhana" : "mahir";
    return { score: Math.round(score), tier: tier, lvl: { novis: 1, sederhana: 2, mahir: 3 }[tier], mu: mu, cut: cut, fired: fired.filter(function (r) { return r.w > 0; }).sort(function (a, b) { return b.w - a.w; }) };
  }

  // ---------- model murid (5 cubaan terakhir) ----------
  var KEY = "aiadaptif:" + location.pathname;
  var M = { h: [] };
  try { M = JSON.parse(localStorage.getItem(KEY) || "null") || { h: [] }; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(M)); } catch (e) {} }
  function tahap() {
    var h = M.h; if (h.length < 2) return { ready: false, tier: "sederhana", lvl: 2, n: h.length };
    var sum = function (f) { return h.reduce(function (a, b) { return a + b[f]; }, 0); };
    var x = { ketepatan: 100 * sum("ok") / h.length, petunjuk: sum("hint") / h.length, masa: sum("t") / h.length };
    var r = fzInfer(x); r.ready = true; r.x = x; r.n = h.length; return r;
  }
  function remedialDue() { var h = M.h, n = h.length; if (n < 2 || !h[n - 1].w || !h[n - 2].w) return false; if ((M.cnt || 0) - (M.remCnt == null ? -9 : M.remCnt) < 2) return false; M.remCnt = M.cnt; return true; }
  function rekod(r) {
    var before = tahap(); M.cnt = (M.cnt || 0) + 1;
    M.h.push({ ok: r.ok ? 1 : 0, w: r.wrong ? 1 : 0, hint: Math.min(2, r.hints || 0), t: Math.min(3, (r.secs || r.exp || 20) / (r.exp || 20)), c: r.concept || "" });
    M.h = M.h.slice(-5); save();
    var after = tahap(); panels.forEach(drawPanel);
    return { before: before, after: after, changed: before.ready && after.ready && before.tier !== after.tier, remedial: remedialDue() };
  }
  function setSemula() { M = { h: [] }; save(); panels.forEach(drawPanel); }

  // ---------- gaya ----------
  function css() {
    if (document.getElementById("aia-css")) return;
    var s = document.createElement("style"); s.id = "aia-css";
    s.textContent = ".aiak{font-family:inherit;color:#1B2430;display:flex;flex-direction:column;gap:12px}"
      + ".aiak .aia{border:2px solid #0B7285;background:#F1F9FA;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}"
      + ".aiak .aiah{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.aiak .sd-ai{display:inline-block;background:#0B7285;color:#fff;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}"
      + ".aiak .aian{margin:0;font-size:15px}.aiak details{font-size:14.5px}.aiak summary{cursor:pointer;font-weight:700;color:#0B7285}.aiak ul,.aiak ol{margin:4px 0 8px;padding-left:20px}"
      + ".aiak .fzt{border-collapse:collapse;width:100%;font-size:14.5px;margin:6px 0}.aiak .fzt th,.aiak .fzt td{border-bottom:1px solid #C9D4DA;padding:4px 6px;text-align:left}"
      + ".aiak .qcard{border:1.5px solid #C9D4DA;border-radius:14px;padding:14px;background:#fff;display:flex;flex-direction:column;gap:10px}"
      + ".aiak .qprog{font-size:14px;color:#5B6675;font-weight:700}.aiak .qtext{font-size:18px;font-weight:700}"
      + ".aiak .qaras{display:inline-block;border-radius:999px;padding:1px 10px;font-weight:800;font-size:13px;margin-left:6px}.aiak .a1{background:#D3F9D8;color:#2B8A3E}.aiak .a2{background:#FFF3BF;color:#8a6100}.aiak .a3{background:#FFE3E3;color:#C92A2A}"
      + ".aiak .qopts{display:grid;gap:8px}.aiak .qopt{border:2px solid #C9D4DA;background:#fff;border-radius:12px;padding:10px 12px;text-align:left;font:inherit;font-size:16px;cursor:pointer;color:#1B2430}"
      + ".aiak .qopt:hover:not(:disabled){border-color:#0B7285}.aiak .qopt.right{border-color:#2B8A3E;background:#EBFBEE}.aiak .qopt.wrong{border-color:#C92A2A;background:#FFF5F5}.aiak .qopt:disabled{cursor:not-allowed}"
      + ".aiak .qrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.aiak .qbtn{border:0;border-radius:999px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer;background:#0B7285;color:#fff}.aiak .qbtn.ghost{background:#fff;color:#0B7285;border:1.5px solid #0B7285}"
      + ".aiak .qhint{border:1.5px dashed #E67700;background:#FFF9DB;color:#7a4b00;border-radius:999px;padding:6px 14px;font:inherit;font-weight:700;cursor:pointer}"
      + ".aiak .fb{border-radius:12px;padding:8px 12px;font-size:15px}.aiak .fb.ok{background:#EBFBEE;color:#2B8A3E}.aiak .fb.bad{background:#FFF5F5;color:#C92A2A}.aiak .fb.info{background:#E7F5FF;color:#1864AB}"
      + ".aiak .remed{border:2px dashed #C92A2A;background:#FFF5F5;border-radius:14px;padding:12px 14px}";
    document.head.appendChild(s);
  }

  // ---------- panel AI Adaptif ----------
  var panels = [];
  function why(st) {
    var h = M.h, ok = h.reduce(function (a, b) { return a + b.ok; }, 0), p = st.x.petunjuk, m = st.x.masa;
    return "Kamu menjawab <b>" + ok + " daripada " + h.length + "</b> dengan betul pada cubaan pertama, " + (p < 0.1 ? "tanpa petunjuk" : p < 0.6 ? "dengan sedikit petunjuk" : p < 1.2 ? "dengan beberapa petunjuk" : "dengan banyak petunjuk") + ", dan " + (m < 0.9 ? "lebih pantas daripada jangkaan" : m <= 1.5 ? "dalam masa biasa" : "agak lambat") + ". " + AIA_DO[st.tier];
  }
  var fzShort = function (r) { return Object.keys(r.c).map(function (k) { return FZ.in[k].label + " " + r.c[k]; }).join(" + ") + " → " + FZ_N[r.o]; };
  function drawPanel(el) {
    var st = tahap();
    var head = '<div class="aiah"><span class="sd-ai">AI Adaptif</span>' + (st.ready ? "<b>Tahap kamu: " + FZ_N[st.tier] + "</b><span>→ soalan seterusnya: <b>" + ARAS[st.lvl] + "</b></span>" : "<b>Sedang mengenali tahap kamu</b>") + "</div>";
    if (!st.ready) { el.innerHTML = '<div class="aia">' + head + '<p class="aian">Selesaikan ' + (2 - st.n) + " lagi soalan. Kuiz bermula pada aras Sederhana. Selepas itu, AI memilih aras dan jenis petunjuk yang sesuai untuk kamu.</p></div>"; return; }
    var lv = function (k) { var e = Object.keys(st.mu[k]).map(function (s) { return [s, st.mu[k][s]]; }).sort(function (a, b) { return b[1] - a[1]; })[0]; return e[0]; };
    el.innerHTML = '<div class="aia">' + head + '<p class="aian">' + why(st) + "</p>"
      + "<details><summary>Bagaimana AI membuat keputusan?</summary><p>AI menggunakan <b>logik kabur (fuzzy)</b>: ia melihat tiga perkara, menilai setiap satu sebagai rendah, sederhana atau tinggi, kemudian menggunakan peraturan seperti seorang guru.</p>"
      + '<table class="fzt"><tr><th>Perkara</th><th>Data kamu</th><th>Nilai</th></tr>' + Object.keys(FZ.in).map(function (k) { return "<tr><td>" + FZ.in[k].label + "</td><td>" + FZ.in[k].fmt(st.x[k]) + "</td><td><b>" + lv(k) + "</b></td></tr>"; }).join("") + "</table>"
      + "<p>Peraturan yang digunakan:</p><ul>" + st.fired.slice(0, 3).map(function (r) { return "<li>" + fzShort(r) + "</li>"; }).join("") + "</ul><p>Keputusan: <b>" + FZ_N[st.tier] + "</b> (skor " + st.score + "/100).</p>"
      + "<details><summary>Semua 10 peraturan (untuk guru dan pakar)</summary><ol>" + FZ.rules.map(function (r) { return "<li>" + fzShort({ c: r[0], o: r[1] }) + "</li>"; }).join("") + "</ol></details></details></div>";
  }
  function panel(sel) { css(); var el = typeof sel === "string" ? document.querySelector(sel) : sel; if (!el) return; el.classList.add("aiak"); if (panels.indexOf(el) < 0) panels.push(el); drawPanel(el); }

  // ---------- kuiz adaptif ----------
  var PRAISE = ["Hebat!", "Bagus sekali!", "Syabas!", "Tepat!", "Cemerlang!"];
  function kuiz(sel, cfg) {
    css(); cfg = cfg || {};
    var root = typeof sel === "string" ? document.querySelector(sel) : sel; if (!root) { console.warn("AIAdaptif: bekas tidak ditemui", sel); return; }
    var QB = (cfg.soalan || []).map(function (q, i) { var o = {}; for (var k in q) o[k] = q[k]; o.id = o.id || "q" + (i + 1); o.lvl = +o.lvl || 2; return o; });
    var total = Math.min(cfg.jumlah || 8, QB.length || 8), exp = cfg.masa || 25;
    var msg = function (j, t) { try { cfg.mesej && cfg.mesej(j, t); } catch (e) {} };
    root.classList.add("aiak");
    root.innerHTML = '<div class="aiaP"></div><div class="qcard"><div class="qprog"></div><div class="qtext"></div><div class="qopts"></div><div class="qfb"></div><div class="qrow"><button type="button" class="qhint">💡 Petunjuk</button><button type="button" class="qbtn qnext" hidden>Soalan seterusnya →</button></div></div>';
    var $ = function (s) { return root.querySelector(s); };
    panel($(".aiaP"));
    var Q = { n: 0, cur: null, round: 1, used: [], wrongIds: [], remed: null, tries: 0, hints: 0, t0: 0, res: null };
    var freshRes = function () { return { ok: 0, n: 0, by: { 1: [0, 0], 2: [0, 0], 3: [0, 0] } }; }; Q.res = freshRes();
    function gen(L) {
      var recent = Q.used.slice(-2), fresh = QB.filter(function (q) { return Q.used.indexOf(q.id) < 0; });
      var c = fresh.filter(function (q) { return q.lvl === L; });
      if (!c.length) c = QB.filter(function (q) { return q.lvl === L && Q.wrongIds.indexOf(q.id) >= 0 && recent.indexOf(q.id) < 0; });
      if (!c.length && fresh.length) { var d = Math.min.apply(null, fresh.map(function (q) { return Math.abs(q.lvl - L); })); c = fresh.filter(function (q) { return Math.abs(q.lvl - L) === d; }); }
      if (!c.length) c = QB.filter(function (q) { return q.lvl === L && recent.indexOf(q.id) < 0; });
      if (!c.length) c = QB;
      return c[Math.floor(Math.random() * c.length)];
    }
    function next() {
      if (!QB.length) { $(".qtext").textContent = "Tiada soalan."; return; }
      if (Q.n >= total) { result(); return; }
      if (Q.remed) { remedial(); return; }
      var L = tahap().lvl; Q.cur = gen(L); Q.used.push(Q.cur.id);
      Q.tries = 0; Q.hints = 0; Q.t0 = Date.now(); $(".qhint").hidden = false; $(".qhint").disabled = false;
      var opts = (Q.cur.o || []).map(function (x) { return { html: x, ok: x === Q.cur.a }; }).sort(function () { return Math.random() - .5; });
      $(".qprog").innerHTML = "Soalan " + (Q.n + 1) + " daripada " + total + ' <span class="qaras a' + Q.cur.lvl + '">Aras ' + ARAS[Q.cur.lvl] + "</span>";
      $(".qtext").innerHTML = Q.cur.t; $(".qfb").innerHTML = ""; $(".qnext").hidden = true;
      $(".qopts").innerHTML = opts.map(function (o, i) { return '<button type="button" class="qopt" data-i="' + i + '">' + o.html + "</button>"; }).join("");
      root.querySelectorAll(".qopt").forEach(function (b) {
        b.onclick = function () {
          if (root.querySelector(".qopt.right")) return;
          var o = opts[+b.dataset.i];
          if (o.ok) {
            b.classList.add("right"); var clean = Q.tries === 0;
            if (!clean && Q.wrongIds.indexOf(Q.cur.id) < 0) Q.wrongIds.push(Q.cur.id);
            if (clean) Q.wrongIds = Q.wrongIds.filter(function (x) { return x !== Q.cur.id; });
            Q.res.n++; if (clean) Q.res.ok++; var bl = Q.res.by[Q.cur.lvl]; bl[1]++; if (clean) bl[0]++;
            Q.n++; var m = PRAISE[Math.floor(Math.random() * PRAISE.length)]; $(".qhint").hidden = true;
            try { cfg.apabilaBetul && cfg.apabilaBetul(Q.cur, clean); } catch (e) {}
            var r = rekod({ ok: clean && Q.hints === 0, wrong: Q.tries > 0, hints: Q.tries + Q.hints, secs: (Date.now() - Q.t0) / 1000, exp: exp, concept: Q.cur.c });
            if (r.after.ready && r.after.lvl !== Q.cur.lvl) m += " AI Adaptif: tahap kamu kini " + FZ_N[r.after.tier] + ", jadi soalan seterusnya aras " + ARAS[r.after.lvl] + ".";
            Q.remed = r.remedial ? Q.cur.c : null;
            $(".qfb").innerHTML = '<div class="fb ok">' + m + "</div>"; msg("pujian", m); $(".qnext").hidden = false;
          } else {
            b.classList.add("wrong"); b.disabled = true; Q.tries++;
            try { cfg.apabilaSalah && cfg.apabilaSalah(Q.cur); } catch (e) {}
            var t = tahap().tier, hint;
            if (t === "mahir" && Q.tries === 1) hint = "Cuba fikir semula. Kamu boleh!";
            else if (t === "novis") {
              var rest = Array.prototype.filter.call(root.querySelectorAll(".qopt"), function (x) { return !x.disabled && !opts[+x.dataset.i].ok; });
              if (rest.length > 1) { rest[0].disabled = true; rest[0].classList.add("wrong"); rest[0].insertAdjacentHTML("beforeend", " <small>(bukan)</small>"); }
              hint = "Petunjuk: " + (Q.cur.h || "") + " Satu pilihan yang salah telah dibuang.";
            } else hint = "Petunjuk: " + (Q.cur.h || "");
            $(".qfb").innerHTML = '<div class="fb bad">Belum tepat. ' + hint + "</div>"; msg("cadangan", "Belum tepat. " + hint);
          }
        };
      });
    }
    function remedial() {
      var k = Q.remed, P = cfg.pembetulan || {}, m = P[k] || P[Object.keys(P)[0]]; Q.remed = null; if (!m) { next(); return; }
      $(".qprog").textContent = "Aktiviti pembetulan"; $(".qtext").innerHTML = ""; $(".qopts").innerHTML = ""; $(".qhint").hidden = true; $(".qnext").hidden = false;
      $(".qfb").innerHTML = '<div class="remed"><p style="margin:0 0 6px"><span class="sd-ai">AI Adaptif</span> <b>Dua jawapan terakhir salah pada cubaan pertama.</b> Mari ulang kaji: <b>' + (m.t || k) + '</b>.</p><p style="margin:0">' + (m.d || "") + "</p></div>";
      msg("cadangan", "AI Adaptif mengesan kamu perlu ulang kaji: " + (m.t || k) + ".");
    }
    function result() {
      var r = Q.res, st = tahap(), L = st.lvl; Q.cur = null;
      var row = function (k) { return r.by[k][1] ? '<tr><td><span class="qaras a' + k + '">' + ARAS[k] + "</span></td><td>" + r.by[k][0] + " daripada " + r.by[k][1] + "</td></tr>" : ""; };
      var tip = { novis: "Cuba sekali lagi. AI akan bermula dengan soalan <b>Mudah</b> untuk mengukuhkan asas kamu.", sederhana: "Cuba sekali lagi. AI akan bermula pada aras <b>Sederhana</b>, dan menaikkan aras jika kamu menjawab dengan baik.", mahir: "Hebat! Cuba sekali lagi untuk lebih banyak soalan <b>Sukar</b>, atau teruskan ke fasa Cuba." }[st.tier];
      $(".qprog").textContent = "Keputusan pusingan " + Q.round;
      $(".qtext").innerHTML = "<b>Kuiz selesai!</b> Betul " + r.ok + " daripada " + r.n + ' pada cubaan pertama.<table class="fzt" style="max-width:340px"><tr><th>Aras soalan</th><th>Betul pada cubaan pertama</th></tr>' + row(1) + row(2) + row(3) + '</table><div class="fb info"><span class="sd-ai">AI Adaptif</span> Tahap kamu sekarang: <b>' + FZ_N[st.tier] + "</b>. " + tip + "</div>";
      $(".qopts").innerHTML = '<div class="qrow"><button type="button" class="qbtn qagain">🔁 Cuba lagi (mula aras ' + ARAS[L] + ')</button><button type="button" class="qbtn ghost qreset">🔄 Mula semula kuiz dari awal</button></div>';
      $(".qhint").hidden = true; $(".qfb").innerHTML = ""; $(".qnext").hidden = true;
      msg("ganjaran", "Kuiz selesai! Betul " + r.ok + " daripada " + r.n + " pada cubaan pertama.");
      try { cfg.apabilaSelesai && cfg.apabilaSelesai({ betul: r.ok, jumlah: r.n, tahap: st.tier }); } catch (e) {}
      var fresh = function () { Q.n = 0; Q.round++; Q.used = []; Q.res = freshRes(); Q.cur = null; Q.remed = null; };
      $(".qagain").onclick = function () { fresh(); next(); msg("pencetus", "Pusingan " + Q.round + ": AI memulakan soalan pada aras " + ARAS[tahap().lvl] + "."); };
      $(".qreset").onclick = function () { fresh(); Q.round = 1; Q.wrongIds = []; setSemula(); next(); msg("pencetus", "Kuiz bermula semula. AI akan mengenali tahap kamu dari awal, bermula pada aras Sederhana."); };
    }
    $(".qnext").onclick = next;
    $(".qhint").onclick = function () { if (!Q.cur || root.querySelector(".qopt.right")) return; Q.hints++; $(".qhint").disabled = true; $(".qfb").innerHTML = '<div class="fb info">💡 ' + (Q.cur.h || "") + "</div>"; msg("cadangan", "Petunjuk: " + (Q.cur.h || "")); };
    next(); msg("pencetus", "Kuiz bermula. AI akan mengenali tahap kamu, bermula pada aras Sederhana.");
    return { next: next };
  }

  window.AIAdaptif = { kuiz: kuiz, panel: panel, rekod: rekod, tahap: tahap, setSemula: setSemula, enjin: { FZ: FZ, fzInfer: fzInfer } };
})();

/* app.js — 拍時計 本体（メトロノーム＋カウントダウンタイマー）
 * 保存は store.js 経由。音は Web Audio の自前合成。外部ライブラリなし。
 */
(function () {
  "use strict";

  var DEFAULTS = {
    bpm: 100, beats: 4, denom: 4, sub: 1,
    accents: [2, 1, 1, 1],
    timerSet: 1500, link: true, vol: 80
  };

  var S = Store.load(DEFAULTS);
  function save() { Store.save(S); }

  var $ = function (id) { return document.getElementById(id); };
  var dotsG = $("dots"), arc = $("arc"), bpmBig = $("bpmBig"), tempoName = $("tempoName"),
      unitNote = $("unitNote"), timeBig = $("timeBig"), timerState = $("timerState"),
      mini = $("mini"), setVal = $("setVal"), bpmRange = $("bpmRange"),
      beatsVal = $("beatsVal"), playBtn = $("playBtn"), playIcon = $("playIcon"),
      timerBtn = $("timerBtn"), linkSw = $("linkSw"), volIn = $("vol");

  var C = 2 * Math.PI * 143;
  arc.setAttribute("stroke-dasharray", C);
  arc.setAttribute("stroke-dashoffset", C);

  /* ---------- audio ---------- */
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null;
  function ensureCtx() {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = S.vol / 100;
      master.connect(ctx.destination);
    }
    if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function voice(time, freq, peak, dur, type) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "triangle";
    o.frequency.setValueAtTime(freq, time);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.55), time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g); g.connect(master);
    o.start(time); o.stop(time + dur + 0.03);
  }
  function click(time, kind) {
    if (kind === 2) voice(time, 2050, 0.85, 0.06);
    else if (kind === 1) voice(time, 1350, 0.42, 0.05);
    else if (kind === "sub") voice(time, 900, 0.16, 0.035);
  }
  function alarm() {
    ensureCtx();
    var t = ctx.currentTime + 0.05;
    for (var i = 0; i < 3; i++) voice(t + i * 0.30, i === 2 ? 1046 : 784, 0.6, 0.24, "sine");
    if (navigator.vibrate) { try { navigator.vibrate([200, 120, 200, 120, 320]); } catch (e) {} }
  }

  /* ---------- metronome ---------- */
  var playing = false, beatIx = 0, subIx = 0, nextTime = 0, schedId = null, queue = [];
  var LOOKAHEAD = 25, AHEAD = 0.12;

  function secondsPerBeat() { return 60.0 / S.bpm; }

  function schedule() {
    while (nextTime < ctx.currentTime + AHEAD) {
      var kind;
      if (subIx === 0) kind = S.accents[beatIx];
      else kind = (S.accents[beatIx] === 0) ? -1 : "sub";
      if (kind !== 0 && kind !== -1) click(nextTime, kind);
      if (subIx === 0) queue.push({ b: beatIx, t: nextTime });
      nextTime += secondsPerBeat() / S.sub;
      subIx++;
      if (subIx >= S.sub) { subIx = 0; beatIx = (beatIx + 1) % S.beats; }
    }
  }
  function startMetro() {
    ensureCtx();
    if (playing) return;
    playing = true; beatIx = 0; subIx = 0; queue = [];
    nextTime = ctx.currentTime + 0.08;
    schedId = setInterval(schedule, LOOKAHEAD);
    playBtn.classList.add("on");
    playIcon.innerHTML = '<rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect>';
    playBtn.setAttribute("aria-label", "メトロノーム停止");
    requestWake();
    draw();
  }
  function stopMetro() {
    if (!playing) return;
    playing = false; clearInterval(schedId); schedId = null; queue = [];
    playBtn.classList.remove("on");
    playIcon.innerHTML = '<path d="M7 4l13 8-13 8z"></path>';
    playBtn.setAttribute("aria-label", "メトロノーム再生");
    var nodes = dotsG.querySelectorAll(".dot");
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove("hit");
    maybeRelease();
  }
  function toggleMetro() { playing ? stopMetro() : startMetro(); }

  function draw() {
    if (!playing) return;
    var now = ctx.currentTime;
    while (queue.length && queue[0].t <= now + 0.02) flash(queue.shift().b);
    requestAnimationFrame(draw);
  }
  function flash(i) {
    var el = dotsG.querySelector('[data-i="' + i + '"]');
    if (!el) return;
    el.classList.add("hit");
    setTimeout(function () { el.classList.remove("hit"); }, Math.min(120, secondsPerBeat() * 400));
  }

  /* ---------- dots ---------- */
  function buildDots() {
    dotsG.innerHTML = "";
    var n = S.beats, R = 121;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", (160 + R * Math.cos(a)).toFixed(2));
      c.setAttribute("cy", (160 + R * Math.sin(a)).toFixed(2));
      c.setAttribute("class", "dot");
      c.setAttribute("data-i", i);
      dotsG.appendChild(c);
      (function (idx) {
        c.addEventListener("click", function () {
          S.accents[idx] = (S.accents[idx] + 2) % 3;
          paintDots(); save();
        });
      })(i);
    }
    paintDots();
  }
  function paintDots() {
    var n = S.beats;
    var base = Math.max(6.5, Math.min(13, 62 / n + 3.5));
    for (var i = 0; i < n; i++) {
      var el = dotsG.querySelector('[data-i="' + i + '"]');
      if (!el) continue;
      var a = S.accents[i];
      el.setAttribute("r", (a === 2 ? base * 1.32 : base).toFixed(1));
      if (a === 2) { el.setAttribute("fill", "#ffb23f"); el.setAttribute("stroke", "none"); }
      else if (a === 1) { el.setAttribute("fill", "#8a5a15"); el.setAttribute("stroke", "none"); }
      else { el.setAttribute("fill", "transparent"); el.setAttribute("stroke", "#3b3550"); el.setAttribute("stroke-width", "2"); }
    }
  }

  /* ---------- tempo naming ---------- */
  function tempoWord(b) {
    if (b < 40) return "GRAVE";
    if (b < 54) return "LARGO";
    if (b < 58) return "LARGHETTO";
    if (b < 76) return "ADAGIO";
    if (b < 98) return "ANDANTE";
    if (b < 109) return "MODERATO";
    if (b < 120) return "ALLEGRETTO";
    if (b < 156) return "ALLEGRO";
    if (b < 176) return "VIVACE";
    if (b < 200) return "PRESTO";
    return "PRESTISSIMO";
  }
  function noteMark(d) { return d === 8 ? "♪=" : (d === 2 ? "𝅗𝅥=" : "♩="); }

  function renderMetro() {
    bpmBig.textContent = S.bpm;
    bpmRange.value = S.bpm;
    beatsVal.textContent = S.beats;
    unitNote.textContent = noteMark(S.denom);
    tempoName.textContent = tempoWord(S.bpm) + " · " + S.beats + "/" + S.denom;
  }

  /* ---------- timer ---------- */
  var tRunning = false, tRemain = S.timerSet, tEndAt = 0, tInt = null, tDone = false;
  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = h ? (m < 10 ? "0" + m : m) : String(m);
    var ss = s < 10 ? "0" + s : String(s);
    return (h ? h + ":" : "") + mm + ":" + ss;
  }
  function renderTimer() {
    setVal.textContent = fmt(S.timerSet);
    timeBig.textContent = fmt(tDone ? 0 : tRemain);
    var frac = S.timerSet > 0 ? Math.max(0, Math.min(1, tRemain / S.timerSet)) : 0;
    arc.setAttribute("stroke-dashoffset", (C * (1 - frac)).toFixed(2));
    arc.style.opacity = (tRunning || (tRemain < S.timerSet && !tDone)) ? 1 : 0;
    timerState.textContent = tDone ? "完了" : (tRunning ? "残り時間" : (tRemain < S.timerSet ? "一時停止" : "停止中"));
    timerBtn.textContent = tRunning ? "一時停止" : (tRemain < S.timerSet && !tDone ? "再開" : "開始");
    timerBtn.classList.toggle("on", tRunning);
    mini.textContent = mode === "metro"
      ? ((tRunning || (tRemain < S.timerSet && !tDone)) ? "TIMER " + fmt(tRemain) : "")
      : "♩=" + S.bpm + "  " + S.beats + "/" + S.denom;
    mini.className = "mini" + (mode === "metro" ? "" : " amber");
  }
  function timerStart() {
    if (tRunning) return;
    ensureCtx();
    if (tDone || tRemain <= 0) tRemain = S.timerSet;
    tDone = false;
    tEndAt = Date.now() + tRemain * 1000;
    tRunning = true;
    if (S.link && !playing) startMetro();
    requestWake();
    tInt = setInterval(tick, 200);
    renderTimer();
  }
  function timerPause() {
    if (!tRunning) return;
    tRunning = false; clearInterval(tInt); tInt = null;
    tRemain = Math.max(0, (tEndAt - Date.now()) / 1000);
    maybeRelease();
    renderTimer();
  }
  function timerReset() {
    tRunning = false;
    if (tInt) { clearInterval(tInt); tInt = null; }
    tDone = false; tRemain = S.timerSet;
    maybeRelease();
    renderTimer();
  }
  function tick() {
    tRemain = Math.max(0, (tEndAt - Date.now()) / 1000);
    if (tRemain <= 0) {
      tRunning = false; clearInterval(tInt); tInt = null;
      tRemain = 0; tDone = true;
      if (S.link && playing) stopMetro();
      alarm();
      maybeRelease();
    }
    renderTimer();
  }

  /* ---------- wake lock ---------- */
  var wl = null;
  function requestWake() {
    if (!("wakeLock" in navigator) || wl) return;
    navigator.wakeLock.request("screen").then(function (l) {
      wl = l;
      l.addEventListener("release", function () { wl = null; });
    }).catch(function () {});
  }
  function maybeRelease() {
    if (!playing && !tRunning && wl) { try { wl.release(); } catch (e) {} wl = null; }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (playing || tRunning) requestWake();
      if (tRunning) tick();
    }
  });

  /* ---------- mode ---------- */
  var mode = "metro";
  function setMode(m) {
    mode = m;
    $("tabM").setAttribute("aria-selected", m === "metro");
    $("tabT").setAttribute("aria-selected", m === "timer");
    $("panelM").hidden = m !== "metro";
    $("panelT").hidden = m !== "timer";
    $("view-metro").hidden = m !== "metro";
    $("view-timer").hidden = m !== "timer";
    renderTimer();
  }

  /* ---------- controls ---------- */
  function setBpm(v) {
    S.bpm = Math.max(30, Math.min(280, Math.round(v)));
    renderMetro(); renderTimer(); save();
  }
  $("bpmDown").addEventListener("click", function () { setBpm(S.bpm - 1); });
  $("bpmUp").addEventListener("click", function () { setBpm(S.bpm + 1); });
  bpmRange.addEventListener("input", function () { setBpm(+bpmRange.value); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-nudge]"), function (b) {
    b.addEventListener("click", function () { setBpm(S.bpm + (+b.dataset.nudge)); });
  });

  var taps = [];
  $("tapBtn").addEventListener("click", function () {
    ensureCtx();
    var now = Date.now();
    if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 2) {
      var sum = 0;
      for (var i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
      setBpm(60000 / (sum / (taps.length - 1)));
    }
    voice(ctx.currentTime, 1350, 0.3, 0.04);
  });

  function setBeats(n) {
    n = Math.max(1, Math.min(12, n));
    var next = [];
    for (var i = 0; i < n; i++) next[i] = (S.accents[i] === undefined) ? (i === 0 ? 2 : 1) : S.accents[i];
    if (next[0] === 0) next[0] = 2;
    S.beats = n; S.accents = next;
    buildDots(); renderMetro(); save();
  }
  $("beatsDown").addEventListener("click", function () { setBeats(S.beats - 1); });
  $("beatsUp").addEventListener("click", function () { setBeats(S.beats + 1); });

  Array.prototype.forEach.call(document.querySelectorAll("[data-denom]"), function (b) {
    b.addEventListener("click", function () {
      S.denom = +b.dataset.denom;
      syncPressed("[data-denom]", "denom", S.denom);
      renderMetro(); renderTimer(); save();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-sub]"), function (b) {
    b.addEventListener("click", function () {
      S.sub = +b.dataset.sub;
      syncPressed("[data-sub]", "sub", S.sub);
      save();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-min]"), function (b) {
    b.addEventListener("click", function () {
      S.timerSet = Math.max(60, Math.min(7200, S.timerSet + (+b.dataset.min) * 60));
      syncPresets();
      if (!tRunning) { tDone = false; tRemain = S.timerSet; }
      renderTimer(); save();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (b) {
    b.addEventListener("click", function () {
      S.timerSet = (+b.dataset.preset) * 60;
      syncPresets();
      if (!tRunning) { tDone = false; tRemain = S.timerSet; }
      renderTimer(); save();
    });
  });

  function syncPressed(sel, key, val) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (x) {
      x.setAttribute("aria-pressed", (+x.dataset[key]) === val);
    });
  }
  function syncPresets() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (x) {
      x.setAttribute("aria-pressed", (+x.dataset.preset) * 60 === S.timerSet);
    });
  }

  timerBtn.addEventListener("click", function () { tRunning ? timerPause() : timerStart(); });
  $("timerReset").addEventListener("click", timerReset);
  linkSw.addEventListener("click", function () {
    S.link = !S.link;
    linkSw.setAttribute("aria-pressed", S.link);
    save();
  });
  playBtn.addEventListener("click", toggleMetro);
  $("tabM").addEventListener("click", function () { setMode("metro"); });
  $("tabT").addEventListener("click", function () { setMode("timer"); });
  volIn.addEventListener("input", function () {
    S.vol = +volIn.value;
    if (master) master.gain.value = S.vol / 100;
    save();
  });
  document.addEventListener("keydown", function (e) {
    if (e.code === "Space") { e.preventDefault(); toggleMetro(); }
  });

  /* ---------- 画面全体の再描画（起動時・クラウド同期で値が変わったとき） ---------- */
  function renderAll() {
    if (!Array.isArray(S.accents) || S.accents.length !== S.beats) {
      var a = [];
      for (var i = 0; i < S.beats; i++) a[i] = (S.accents && S.accents[i] !== undefined) ? S.accents[i] : (i === 0 ? 2 : 1);
      S.accents = a;
    }
    volIn.value = S.vol;
    if (master) master.gain.value = S.vol / 100;
    syncPressed("[data-denom]", "denom", S.denom);
    syncPressed("[data-sub]", "sub", S.sub);
    syncPresets();
    linkSw.setAttribute("aria-pressed", S.link);
    buildDots(); renderMetro(); renderTimer();
  }

  Store.onRemote(function (next) {
    S = next;
    if (!tRunning) { tDone = false; tRemain = S.timerSet; }
    renderAll();
  });

  /* ---------- iOS: 触るたびに音を有効化し、復帰時に鳴り続けられるようにする ---------- */
  function unlockAudio() {
    ensureCtx();
    try {
      var b = ctx.createBuffer(1, 1, 22050);
      var s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(master);
      s.start(0);
    } catch (e) {}
  }
  ["touchend", "pointerup", "click"].forEach(function (ev) {
    document.addEventListener(ev, unlockAudio, { passive: true });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && ctx && ctx.state !== "running") {
      try { ctx.resume(); } catch (e) {}
    }
  });

  tRemain = S.timerSet;
  renderAll();
})();

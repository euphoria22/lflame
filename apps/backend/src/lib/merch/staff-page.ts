/**
 * Страница задания для консультанта (телефон): открывается по секретной ссылке без входа.
 * Обычный HTML + немного JS, данные — /staff/merch/<token>/data. Фото уменьшаются в браузере до 1600 px.
 */
export const STAFF_PAGE = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>Задание по выкладке · Laflamme</title>
<style>
  :root { --bg:#f4f4f2; --card:#fff; --ink:#111; --muted:#6b6b6b; --line:#e4e4e0; --ok:#15803d; --warn:#b45309; --red:#b91c1c; }
  * { box-sizing:border-box }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; -webkit-text-size-adjust:100% }
  header { position:sticky; top:0; z-index:5; background:#111; color:#fff; padding:14px 16px 12px }
  .brand { font-weight:600; letter-spacing:.02em; font-size:13px; opacity:.7 }
  h1 { margin:2px 0 8px; font-size:19px; font-weight:600 }
  .bar { height:6px; background:#333; border-radius:3px; overflow:hidden } .bar i { display:block; height:100%; background:#22c55e; width:0; transition:width .3s }
  .prog { font-size:13px; opacity:.8; margin-top:6px }
  main { padding:12px; max-width:720px; margin:0 auto }
  .note { background:#fff8e1; border:1px solid #f1d58a; border-radius:12px; padding:12px; margin-bottom:12px; white-space:pre-wrap }
  .step { background:var(--card); border:1px solid var(--line); border-radius:14px; margin-bottom:12px; overflow:hidden }
  .step.done { border-color:#bbe5c8 }
  .head { display:flex; gap:10px; align-items:flex-start; padding:14px 14px 8px }
  .num { flex:none; width:28px; height:28px; border-radius:50%; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600 }
  .done .num { background:var(--ok) }
  .t { font-weight:600; font-size:16px } .w { color:var(--muted); font-size:13px }
  .chip { display:inline-block; font-size:12px; padding:2px 8px; border-radius:999px; margin-top:4px }
  .chip.ok { background:#dcfce7; color:var(--ok) } .chip.redo { background:#fee2e2; color:var(--red) } .chip.wait { background:#fef3c7; color:var(--warn) }
  .render { display:block; width:100%; max-height:300px; object-fit:cover; background:#ddd }
  ul.text { margin:10px 14px; padding-left:18px } ul.text li { margin:4px 0 }
  .comment { margin:8px 14px; padding:10px 12px; border-radius:10px; background:#fee2e2; color:#7f1d1d; font-size:14px }
  .comment b { display:block; font-size:12px; margin-bottom:2px }
  .list { padding:4px 14px 8px }
  .row { display:flex; gap:10px; align-items:center; padding:8px 0; border-top:1px solid var(--line) }
  .row:first-child { border-top:0 }
  .row img { width:56px; height:70px; object-fit:cover; border-radius:8px; background:#eee; flex:none }
  .row .i { flex:1; min-width:0 } .row .b { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.03em }
  .row .n { font-size:14px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical }
  .row .s { font-size:12px; color:var(--muted) }
  .row .q { flex:none; font-weight:600; font-size:13px; background:#f1f1ef; border-radius:8px; padding:4px 8px }
  .row.rm { opacity:.55 } .row.rm .q { background:#fee2e2; color:var(--red) }
  .sub { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; padding:10px 14px 0 }
  .photos { display:flex; gap:8px; flex-wrap:wrap; padding:6px 14px }
  .photos img { width:84px; height:84px; object-fit:cover; border-radius:10px }
  .actions { display:flex; gap:8px; padding:10px 14px 14px }
  button, label.btn { flex:1; appearance:none; border:0; border-radius:12px; padding:13px 10px; font:inherit; font-weight:600; text-align:center; cursor:pointer }
  .primary { background:#111; color:#fff } .ghost { background:#efefec; color:#111 } .okb { background:var(--ok); color:#fff }
  input[type=file] { display:none }
  .busy { opacity:.5; pointer-events:none }
  .err { color:var(--red); padding:20px; text-align:center }
  .who { display:flex; gap:8px; margin-bottom:12px } .who input { flex:1; border:1px solid var(--line); border-radius:12px; padding:12px; font:inherit; background:#fff }
  .toast { position:fixed; left:50%; bottom:20px; transform:translateX(-50%); background:#111; color:#fff; padding:10px 16px; border-radius:12px; font-size:14px; display:none; z-index:10 }
</style>
</head>
<body>
<header><div class="brand">LAFLAMME · ВЫКЛАДКА</div><h1 id="name">Загрузка…</h1><div class="bar"><i id="barfill"></i></div><div class="prog" id="prog"></div></header>
<main id="main"></main>
<div class="toast" id="toast"></div>
<script>
(function () {
  var token = location.pathname.split("/").filter(Boolean).pop()
  var base = "/staff/merch/" + token
  var main = document.getElementById("main")
  var task = null
  var who = ""
  try { who = localStorage.getItem("lf_merch_who") || "" } catch (e) {}

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] }) }
  function toast(t) { var el = document.getElementById("toast"); el.textContent = t; el.style.display = "block"; clearTimeout(el._t); el._t = setTimeout(function () { el.style.display = "none" }, 2600) }
  function plural(n, a, b, c) { var x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c }

  function row(p, rm) {
    var q = rm ? "убрать" : p.place === "rail" ? (p.n + " " + plural(p.n, "вешалка", "вешалки", "вешалок")) : (p.n > 1 ? p.n + " места" : "1 место")
    if (p.face && !rm) q = "лицом · " + q
    return '<div class="row' + (rm ? " rm" : "") + '">' + (p.thumb ? '<img loading="lazy" src="' + esc(p.thumb) + '" alt="">' : '<img alt="">') +
      '<div class="i"><div class="b">' + esc(p.brand || "") + '</div><div class="n">' + esc(p.title) + '</div>' +
      (p.sizes && p.sizes.length && !rm ? '<div class="s">Размеры: ' + esc(p.sizes.join(", ")) + (p.color ? " · " + esc(p.color) : "") + '</div>' : "") + '</div>' +
      '<div class="q">' + q + '</div></div>'
  }

  function render() {
    document.getElementById("name").textContent = task.name
    var done = task.steps.filter(function (s) { return s.done_at }).length
    document.getElementById("barfill").style.width = (task.steps.length ? Math.round(done / task.steps.length * 100) : 0) + "%"
    document.getElementById("prog").textContent = "Сделано " + done + " из " + task.steps.length + (task.status === "closed" ? " · задание закрыто" : "")
    var h = ""
    h += '<div class="who"><input id="who" placeholder="Ваше имя (для отчёта)" value="' + esc(who) + '"></div>'
    if (task.note) h += '<div class="note">' + esc(task.note) + '</div>'
    task.steps.forEach(function (s, i) {
      var chip = s.review === "ok" ? '<span class="chip ok">Принято</span>' : s.review === "redo" ? '<span class="chip redo">Переделать</span>' : s.done_at ? '<span class="chip wait">Ждёт проверки</span>' : ""
      h += '<section class="step' + (s.done_at ? " done" : "") + '" id="' + esc(s.id) + '">'
      h += '<div class="head"><div class="num">' + (s.done_at ? "✓" : i + 1) + '</div><div><div class="t">' + esc(s.title) + '</div><div class="w">' + esc(s.where) + '</div>' + chip + '</div></div>'
      if (s.render) h += '<img class="render" loading="lazy" src="' + esc(s.render) + '" alt="Как должно выглядеть">'
      if (s.comment) h += '<div class="comment"><b>Замечание мерчендайзера</b>' + esc(s.comment) + '</div>'
      if (s.text && s.text.length) h += '<ul class="text">' + s.text.map(function (t) { return "<li>" + esc(t) + "</li>" }).join("") + '</ul>'
      if (s.remove && s.remove.length) h += '<div class="sub">Убрать на склад</div><div class="list">' + s.remove.map(function (p) { return row(p, true) }).join("") + '</div>'
      if (s.products && s.products.length) h += '<div class="sub">По порядку</div><div class="list">' + s.products.map(function (p) { return row(p, false) }).join("") + '</div>'
      if (s.photos && s.photos.length) h += '<div class="photos">' + s.photos.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt=""></a>' }).join("") + '</div>'
      if (task.status !== "closed") {
        h += '<div class="actions"><label class="btn ghost">📷 Фото результата<input type="file" accept="image/*" capture="environment" data-photo="' + esc(s.id) + '"></label>'
        h += s.done_at ? '<button class="ghost" data-undo="' + esc(s.id) + '">Отменить отметку</button>' : '<button class="primary" data-done="' + esc(s.id) + '">Сделано</button>'
        h += '</div>'
      }
      h += '</section>'
    })
    main.innerHTML = h
    var w = document.getElementById("who")
    w.addEventListener("change", function () { who = w.value.trim(); try { localStorage.setItem("lf_merch_who", who) } catch (e) {} })
  }

  function load() {
    fetch(base + "/data", { cache: "no-store" }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || "Ошибка"); return d }) })
      .then(function (d) { task = d; render() })
      .catch(function (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; document.getElementById("name").textContent = "Задание" })
  }

  function post(path, body, el) {
    if (el) el.classList.add("busy")
    return fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || "Ошибка"); return d }) })
      .then(function (d) { task = d; render() })
      .catch(function (e) { toast(e.message) })
      .finally(function () { if (el) el.classList.remove("busy") })
  }

  // Фото: уменьшаем до 1600 px по длинной стороне, JPEG
  function shrink(file) {
    return new Promise(function (ok, fail) {
      var img = new Image()
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height))
        var c = document.createElement("canvas")
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(img.src)
        ok(c.toDataURL("image/jpeg", 0.82))
      }
      img.onerror = function () { fail(new Error("Не получилось прочитать фото")) }
      img.src = URL.createObjectURL(file)
    })
  }

  main.addEventListener("click", function (e) {
    var t = e.target
    if (t.dataset.done) post("/steps/" + t.dataset.done, { done: true, who: who }, t.closest(".step")).then(function () { toast("Отмечено") })
    if (t.dataset.undo) post("/steps/" + t.dataset.undo, { done: false }, t.closest(".step"))
  })
  main.addEventListener("change", function (e) {
    var t = e.target
    if (!t.dataset.photo || !t.files || !t.files[0]) return
    var step = t.closest(".step")
    step.classList.add("busy")
    toast("Загружаю фото…")
    shrink(t.files[0]).then(function (data) { return post("/steps/" + t.dataset.photo + "/photo", { data: data }) })
      .then(function () { toast("Фото добавлено") }).catch(function (err) { toast(err.message) }).finally(function () { step.classList.remove("busy") })
  })
  load()
})()
</script>
</body>
</html>`

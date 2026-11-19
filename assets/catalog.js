/* Особый маршрут — поиск, фильтры и «Мой маршрут» для статического сайта.
   Файл работает без сервера и без баз данных: сохранённые места хранятся
   в localStorage браузера посетителя.

   Подключение (в конце <body>):
     <script src="assets/catalog.js"></script>

   Требования к разметке:
     1) Карточки живут внутри <section id="catalog"> и выглядят как
        <article class="card" data-org="уникальный-id" data-okrug="СВАО"
                 data-district="Марфино" data-tags="Диагностика,Консультации">
     2) На странице есть элементы с id: q, f-okrug, f-tags, f-cost, f-age,
        f-reset, f-count, route, route-count, route-print, print-btn, clear-btn.
        Если какого-то элемента нет, соответствующая часть просто не включится.
*/
(function () {
  "use strict";

  var STORE_KEY = "om-route-v1";

  function byId(id) {
    return document.getElementById(id);
  }

  function cards() {
    return [].slice.call(document.querySelectorAll('#catalog article.card[data-org]'));
  }

  /* ---------- сохранённые места ---------- */

  function readRoute() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeRoute(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch (e) {
      /* приватный режим браузера: просто работаем без сохранения */
    }
  }

  function inRoute(id) {
    return readRoute().indexOf(id) !== -1;
  }

  function toggleRoute(id) {
    var list = readRoute();
    var i = list.indexOf(id);
    if (i === -1) list.push(id);
    else list.splice(i, 1);
    writeRoute(list);
    renderButtons();
    renderRoutePanel();
  }

  /* ---------- язык ---------- */

  function currentLang() {
    return document.documentElement.lang === "en" ? "en" : "ru";
  }

  // Подписываемся на смену языка: после setLang() страница шлёт событие om:lang.
  document.addEventListener("om:lang", function () {
    renderButtons();
    renderRoutePanel();
    buildTagChips();
  });

  function t(ru, en) {
    return currentLang() === "en" ? en : ru;
  }

  /* ---------- фильтры ---------- */

  // Собираем пары «русское значение → английское».
  // Английские значения берутся из data-tags-en и data-okrug-en; порядок слов
  // в них должен совпадать с data-tags и data-okrug. Если английского атрибута
  // нет, остаётся русский текст — фильтрация при этом не ломается.
  function pairsFrom(ruAttr, enAttr) {
    var map = {};
    cards().forEach(function (card) {
      var ruList = (card.getAttribute(ruAttr) || "").split(",");
      var enList = (card.getAttribute(enAttr) || "").split(",");
      ruList.forEach(function (value, i) {
        value = value.trim();
        if (!value) return;
        var en = (enList[i] || "").trim();
        if (!map[value] || map[value] === value) map[value] = en || value;
      });
    });
    return map;
  }

  function sortedKeys(map) {
    return Object.keys(map).sort(function (a, b) {
      return a.localeCompare(b, "ru");
    });
  }

  // Подписи в селекте округов меняются при переключении языка.
  // Значением option всегда остаётся русский округ — на фильтрацию не влияет.
  function refreshOkrugLabels() {
    var sel = byId("f-okrug");
    if (!sel) return;
    var isEn = currentLang() === "en";
    [].slice.call(sel.options).forEach(function (opt) {
      if (!opt.dataset.ru) return;
      opt.textContent = isEn ? opt.dataset.en || opt.dataset.ru : opt.dataset.ru;
    });
  }

  var activeTag = "";

  function buildOkrugSelect() {
    var sel = byId("f-okrug");
    if (!sel || sel.options.length > 1) return;
    var map = pairsFrom("data-okrug", "data-okrug-en");
    sortedKeys(map).forEach(function (ru) {
      var opt = document.createElement("option");
      opt.value = ru;
      opt.dataset.ru = ru;
      opt.dataset.en = map[ru];
      opt.textContent = ru;
      sel.appendChild(opt);
    });
    refreshOkrugLabels();
  }

  function buildTagChips() {
    var box = byId("f-tags");
    // Перерисовываем и подписи округов: buildTagChips вызывается при загрузке
    // и на каждое событие om:lang, то есть в нужный момент для обоих блоков.
    refreshOkrugLabels();
    if (!box) return;
    box.innerHTML = "";

    var tagPairs = pairsFrom("data-tags", "data-tags-en");
    var tags = sortedKeys(tagPairs);
    if (!tags.length) return;
    var isEn = currentLang() === "en";

    var all = document.createElement("button");
    all.type = "button";
    all.className = "om-chip" + (activeTag === "" ? " om-chip-on" : "");
    all.textContent = t("Все услуги", "All services");
    all.addEventListener("click", function () {
      activeTag = "";
      buildTagChips();
      applyFilters();
    });
    box.appendChild(all);

    tags.forEach(function (tag) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "om-chip" + (activeTag === tag ? " om-chip-on" : "");
      // Подпись может быть английской, но filter всегда сверяет русское значение.
      b.textContent = isEn ? tagPairs[tag] || tag : tag;
      b.addEventListener("click", function () {
        activeTag = activeTag === tag ? "" : tag;
        buildTagChips();
        applyFilters();
      });
      box.appendChild(b);
    });
  }

  function cardText(card) {
    // textContent зависит от текущего языка, поэтому поиск работает и по-русски,
    // и по-английски без отдельных атрибутов.
    var extra = card.getAttribute("data-search") || "";
    return (card.textContent + " " + extra).toLowerCase();
  }

  function cardMatches(card) {
    var q = (byId("q") ? byId("q").value : "").trim().toLowerCase();
    if (q && cardText(card).indexOf(q) === -1) return false;

    var okrug = byId("f-okrug") ? byId("f-okrug").value : "";
    if (okrug && card.getAttribute("data-okrug") !== okrug) return false;

    if (activeTag) {
      var tags = (card.getAttribute("data-tags") || "").split(",");
      if (tags.map(function (x) { return x.trim(); }).indexOf(activeTag) === -1) return false;
    }

    var cost = byId("f-cost") ? byId("f-cost").value : "";
    var cardCost = card.getAttribute("data-cost") || "unknown";
    // "unknown" не скрываем: стоимость в каталоге пока не подтверждена.
    if (cost === "free" && cardCost === "paid") return false;
    if (cost === "paid" && cardCost === "free") return false;

    var ageEl = byId("f-age");
    var age = ageEl ? Number(ageEl.value) : NaN;
    if (ageEl && ageEl.value !== "" && !isNaN(age)) {
      var min = card.getAttribute("data-age-min");
      var max = card.getAttribute("data-age-max");
      if (min !== null && Number(min) > age) return false;
      if (max !== null && Number(max) < age) return false;
    }

    return true;
  }

  function applyFilters() {
    var visible = 0;
    var unknown = 0;
    cards().forEach(function (card) {
      var ok = cardMatches(card);
      card.classList.toggle("om-hidden", !ok);
      if (ok) {
        visible++;
        if ((card.getAttribute("data-cost") || "unknown") === "unknown") unknown++;
      }
    });
    renderCount(visible, unknown);
  }

  function renderCount(visible, unknown) {
    var el = byId("f-count");
    if (!el) return;
    var text = t("Найдено: ", "Found: ") + visible + " " + t("из", "of") + " " + cards().length;
    if (unknown > 0) {
      text += " · " + t("уточните условия по телефону", "confirm conditions by phone");
    }
    el.textContent = text;
  }

  function resetFilters() {
    if (byId("q")) byId("q").value = "";
    if (byId("f-okrug")) byId("f-okrug").value = "";
    if (byId("f-cost")) byId("f-cost").value = "";
    if (byId("f-age")) byId("f-age").value = "";
    activeTag = "";
    buildTagChips();
    applyFilters();
  }

  /* ---------- кнопка «В маршрут» в каждой карточке ---------- */

  function renderButtons() {
    cards().forEach(function (card) {
      var id = card.getAttribute("data-org");
      var btn = card.querySelector(".om-save");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "om-btn om-btn-ghost om-save";
        card.appendChild(btn);
        btn.addEventListener("click", function () {
          toggleRoute(id);
        });
      }
      var saved = inRoute(id);
      btn.textContent = saved ? t("✓ В маршруте", "✓ In my route") : t("+ В маршрут", "+ Add to route");
      btn.classList.toggle("om-btn-on", saved);
      btn.setAttribute("aria-pressed", saved ? "true" : "false");
    });
  }

  /* ---------- панель «Мой маршрут» ---------- */

  function titleOf(card) {
    var h3 = card.querySelector("h3");
    return h3 ? h3.textContent : card.getAttribute("data-org");
  }

  function phonesOf(card) {
    return [].slice.call(card.querySelectorAll('a[href^="tel:"]')).map(function (a) {
      return a.textContent;
    });
  }

  function addressOf(card) {
    // Собираем все адреса карточки: у ЦЛП их два внутри одной карточки.
    var found = [];
    [].slice.call(card.querySelectorAll("span")).forEach(function (span) {
      var parentText = span.parentNode ? span.parentNode.textContent : "";
      if (parentText.indexOf("Адрес") !== -1 || parentText.indexOf("Address") !== -1) {
        var value = span.textContent.trim();
        if (value && found.indexOf(value) === -1) found.push(value);
      }
    });
    return found.join("; ");
  }

  function renderRoutePanel() {
    var panel = byId("route");
    var counter = byId("route-count");
    var list = readRoute();
    var savedCards = cards().filter(function (c) {
      return list.indexOf(c.getAttribute("data-org")) !== -1;
    });

    if (counter) counter.textContent = String(savedCards.length);
    if (!panel) return;

    var listBox = panel.querySelector(".om-route-list");
    if (!listBox) {
      listBox = document.createElement("div");
      listBox.className = "om-route-list";
      panel.appendChild(listBox);
    }
    listBox.innerHTML = "";

    if (!savedCards.length) {
      var empty = document.createElement("p");
      empty.className = "om-muted";
      empty.textContent = t(
        "Пока пусто. Отмечайте места кнопкой «+ В маршрут» — список сохранится в этом браузере, его можно распечатать.",
        "Nothing saved yet. Use «+ Add to route» — the list stays in this browser and can be printed."
      );
      listBox.appendChild(empty);
      return;
    }

    savedCards.forEach(function (card, i) {
      var item = document.createElement("div");
      item.className = "om-route-item";

      var num = document.createElement("span");
      num.className = "om-route-num";
      num.textContent = String(i + 1);

      var body = document.createElement("div");
      var name = document.createElement("b");
      name.textContent = titleOf(card);
      body.appendChild(name);

      var addr = addressOf(card);
      if (addr) {
        var p1 = document.createElement("div");
        p1.className = "om-muted";
        p1.textContent = addr;
        body.appendChild(p1);
      }
      var ph = phonesOf(card);
      if (ph.length) {
        var p2 = document.createElement("div");
        p2.className = "om-muted";
        p2.textContent = ph.join(", ");
        body.appendChild(p2);
      }

      var del = document.createElement("button");
      del.type = "button";
      del.className = "om-btn om-btn-ghost om-route-del";
      del.textContent = "×";
      del.setAttribute("aria-label", t("Убрать из маршрута", "Remove from route"));
      del.addEventListener("click", function () {
        toggleRoute(card.getAttribute("data-org"));
      });

      item.appendChild(num);
      item.appendChild(body);
      item.appendChild(del);
      listBox.appendChild(item);
    });
  }

  /* ---------- печать маршрута ---------- */

  function buildPrintArea() {
    var area = byId("route-print");
    if (!area) return;
    var list = readRoute();
    var savedCards = cards().filter(function (c) {
      return list.indexOf(c.getAttribute("data-org")) !== -1;
    });
    area.innerHTML = "";

    var h = document.createElement("h2");
    h.textContent = t("Мой маршрут — Особый маршрут", "My route — Osobiy Marshrut");
    area.appendChild(h);

    var date = document.createElement("p");
    date.textContent = t("Распечатано: ", "Printed: ") + new Date().toLocaleDateString("ru-RU");
    area.appendChild(date);

    savedCards.forEach(function (card, i) {
      var item = document.createElement("div");
      item.className = "om-print-item";
      var name = document.createElement("b");
      name.textContent = i + 1 + ". " + titleOf(card);
      item.appendChild(name);
      var addr = addressOf(card);
      if (addr) {
        var p = document.createElement("p");
        p.textContent = t("Адрес: ", "Address: ") + addr;
        item.appendChild(p);
      }
      var ph = phonesOf(card);
      if (ph.length) {
        var p2 = document.createElement("p");
        p2.textContent = t("Телефон: ", "Phone: ") + ph.join(", ");
        item.appendChild(p2);
      }
      var ask = document.createElement("p");
      ask.textContent = t(
        "Вопросы: нужна ли запись? что бесплатно? какие документы взять?",
        "Questions: is an appointment needed? what is free? which documents to bring?"
      );
      item.appendChild(ask);
      area.appendChild(item);
    });
  }

  function printRoute() {
    if (!readRoute().length) return;
    buildPrintArea();
    window.print();
  }

  /* ---------- запуск ---------- */

  function init() {
    buildOkrugSelect();
    buildTagChips();
    renderButtons();
    renderRoutePanel();

    ["q", "f-okrug", "f-cost", "f-age"].forEach(function (id) {
      var el = byId(id);
      if (!el) return;
      el.addEventListener("input", applyFilters);
      el.addEventListener("change", applyFilters);
    });

    var reset = byId("f-reset");
    if (reset) reset.addEventListener("click", resetFilters);

    var printBtn = byId("print-btn");
    if (printBtn) printBtn.addEventListener("click", printRoute);

    var clearBtn = byId("clear-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        writeRoute([]);
        renderButtons();
        renderRoutePanel();
      });
    }

    applyFilters();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Небольшой внешний интерфейс — пригодится для следующих шагов.
  window.omCatalog = {
    applyFilters: applyFilters,
    renderRoutePanel: renderRoutePanel,
    buildPrintArea: buildPrintArea,
    readRoute: readRoute,
    toggleRoute: toggleRoute
  };
})();

/* Особый маршрут — режимы доступности и кнопка «Поделиться».
   Подключение: <script src="assets/tools.js"></script> перед </body>.

   Нужны элементы:
     #a11y-large, #a11y-contrast  — кнопки режимов (необязательно)
     #share-btn                   — кнопка «Поделиться» (необязательно)
   Настройки хранятся в localStorage, поэтому режим сохраняется после перезагрузки.
*/
(function () {
  "use strict";

  var KEY = "om-a11y-v1";

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : { large: false, contrast: false };
    } catch (e) {
      return { large: false, contrast: false };
    }
  }

  function write(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* приватный режим — работаем без сохранения */
    }
  }

  function apply(state) {
    var root = document.documentElement;
    root.classList.toggle("a11y-large", !!state.large);
    root.classList.toggle("a11y-contrast", !!state.contrast);

    var large = document.getElementById("a11y-large");
    var contrast = document.getElementById("a11y-contrast");
    if (large) {
      large.classList.toggle("om-tool-on", !!state.large);
      large.setAttribute("aria-pressed", state.large ? "true" : "false");
    }
    if (contrast) {
      contrast.classList.toggle("om-tool-on", !!state.contrast);
      contrast.setAttribute("aria-pressed", state.contrast ? "true" : "false");
    }
  }

  function init() {
    var state = read();
    apply(state);

    var large = document.getElementById("a11y-large");
    if (large) {
      large.addEventListener("click", function () {
        state.large = !state.large;
        write(state);
        apply(state);
      });
    }

    var contrast = document.getElementById("a11y-contrast");
    if (contrast) {
      contrast.addEventListener("click", function () {
        state.contrast = !state.contrast;
        write(state);
        apply(state);
      });
    }

    var share = document.getElementById("share-btn");
    if (share) {
      share.addEventListener("click", function () {
        var url = location.href.split("#")[0];
        var label = share.querySelector("span") || share;
        var isEn = document.documentElement.lang === "en";
        if (navigator.share) {
          navigator
            .share({
              title: isEn ? "Osobiy Marshrut" : "Особый маршрут",
              text: isEn
                ? "Catalog of support services for families in Moscow"
                : "Каталог организаций поддержки для семей в Москве",
              url: url
            })
            .catch(function () {});
          return;
        }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () {
            var old = label.textContent;
            label.textContent = isEn ? "Link copied ✓" : "Ссылка скопирована ✓";
            setTimeout(function () {
              label.textContent = old;
            }, 2000);
          });
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

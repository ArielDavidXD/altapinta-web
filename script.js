/* ============================================================
   AltaPinta GYM — interacciones del sitio
   Sin dependencias.
   ============================================================ */

(function () {
  "use strict";

  var header = document.getElementById("siteHeader");
  var toggle = document.getElementById("navToggle");
  var menu = document.getElementById("navMenu");

  /* ---------- Tema claro / oscuro ---------- */

  var botonTema = document.getElementById("themeToggle");
  var metaTema = document.getElementById("metaTema");

  function temaActual() {
    return document.documentElement.getAttribute("data-tema") === "claro" ? "claro" : "oscuro";
  }

  function aplicarTema(tema, guardar) {
    tema = tema === "claro" ? "claro" : "oscuro";

    if (document.documentElement.getAttribute("data-tema") !== tema) {
      document.documentElement.classList.add("cambiando-tema");
      window.setTimeout(function () {
        document.documentElement.classList.remove("cambiando-tema");
      }, 350);
    }

    document.documentElement.setAttribute("data-tema", tema);

    if (metaTema) {
      metaTema.setAttribute("content", tema === "claro" ? "#f6f6f3" : "#080808");
    }

    if (botonTema) {
      var hacia = tema === "claro" ? "oscuro" : "claro";
      botonTema.setAttribute("aria-label", "Cambiar a modo " + hacia);
      botonTema.setAttribute("title", "Cambiar a modo " + hacia);
    }

    if (guardar) {
      try {
        localStorage.setItem("gym_tema", tema);
      } catch (e) {
        /* sin almacenamiento: el tema vale por esta visita */
      }
    }
  }

  if (botonTema) {
    botonTema.addEventListener("click", function () {
      aplicarTema(temaActual() === "claro" ? "oscuro" : "claro", true);
    });
  }

  aplicarTema(temaActual(), false);

  /* Lo usa contenido.js para aplicar el tema por defecto del panel */
  window.GYM_TEMA = {
    aplicar: aplicarTema,
    actual: temaActual
  };

  /* ---------- Menú móvil ---------- */

  function cerrarMenu() {
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú");
    document.body.classList.remove("nav-open");
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var abierto = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(abierto));
      toggle.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
      document.body.classList.toggle("nav-open", abierto);
    });

    menu.querySelectorAll("a").forEach(function (enlace) {
      enlace.addEventListener("click", cerrarMenu);
    });

    document.addEventListener("keydown", function (evento) {
      if (evento.key === "Escape") {
        cerrarMenu();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) {
        cerrarMenu();
      }
    });
  }

  /* ---------- Sombra del header al scrollear ---------- */

  function actualizarHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  actualizarHeader();
  window.addEventListener("scroll", actualizarHeader, { passive: true });

  /* ---------- Aparición de secciones ---------- */

  var sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var elementos = document.querySelectorAll(".reveal");

  if (sinMovimiento || !("IntersectionObserver" in window)) {
    elementos.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var observador = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add("is-visible");
          observador.unobserve(entrada.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    elementos.forEach(function (el) {
      observador.observe(el);
    });
  }

  /* ---------- Link activo en la navegación ---------- */

  var enlacesNav = Array.prototype.slice.call(
    document.querySelectorAll(".nav a[href^='#']")
  );

  var secciones = enlacesNav
    .map(function (enlace) {
      return document.querySelector(enlace.getAttribute("href"));
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && secciones.length) {
    var vigia = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          var id = "#" + entrada.target.id;

          enlacesNav.forEach(function (enlace) {
            enlace.classList.toggle(
              "is-active",
              enlace.getAttribute("href") === id
            );
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    secciones.forEach(function (seccion) {
      vigia.observe(seccion);
    });
  }

  /* ---------- Año del footer ---------- */

  var anio = document.getElementById("year");
  if (anio) {
    anio.textContent = String(new Date().getFullYear());
  }
})();

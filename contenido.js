/* ============================================================
   Contenido del sitio
   Trae los datos desde Supabase y actualiza la página.
   Si no hay conexión, queda el contenido de respaldo del HTML.
   ============================================================ */

(function () {
  "use strict";

  var cfg = window.GYM_SITIO;

  /* ---------- Utilidades ---------- */

  function esc(valor) {
    return String(valor == null ? "" : valor).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c];
    });
  }

  function dinero(valor) {
    var n = Number(valor);
    if (!isFinite(n)) return "";
    return "$" + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  }

  function digitos(valor) {
    return String(valor == null ? "" : valor).replace(/\D/g, "");
  }

  function texto(selector, valor) {
    if (valor == null || valor === "") return;
    document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = valor;
    });
  }

  function horaCorta(hhmm) {
    var partes = String(hhmm || "").split(":");
    return String(parseInt(partes[0], 10) || 0);
  }

  function instagramUrl(valor) {
    var v = String(valor || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    return "https://instagram.com/" + v.replace(/^@+/, "");
  }

  function instagramTexto(valor) {
    var v = String(valor || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) {
      return "@" + v.replace(/\/+$/, "").split("/").pop();
    }
    return v.charAt(0) === "@" ? v : "@" + v;
  }

  function mapsUrl(direccion) {
    return "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(String(direccion || "AltaPinta GYM"));
  }

  /* ---------- WhatsApp ---------- */

  var whatsapp = "";

  function aplicarWhatsapp() {
    if (!whatsapp) return;

    document.querySelectorAll("[data-wa]").forEach(function (enlace) {
      var mensaje = enlace.getAttribute("data-wa-texto") || "";
      var url = "https://wa.me/" + whatsapp;
      if (mensaje) url += "?text=" + encodeURIComponent(mensaje);
      enlace.setAttribute("href", url);
    });

    var contacto = document.getElementById("contactoWhatsapp");
    if (contacto) contacto.setAttribute("href", "https://wa.me/" + whatsapp);
  }

  /* ---------- Planes ---------- */

  function pintarPlanes(planes) {
    var contenedor = document.getElementById("planesLista");
    if (!contenedor || !planes || !planes.length) return;

    contenedor.innerHTML = planes.map(function (plan) {
      var destacado = !!plan.destacado;
      var beneficios = (plan.beneficios || []).map(function (b) {
        var incluido = b.incluido !== false;
        return '<li' + (incluido ? "" : ' class="muted-item"') + ">" +
          esc(b.texto) + "</li>";
      }).join("");

      var etiqueta = plan.etiqueta
        ? '<span class="badge">' + esc(plan.etiqueta) + "</span>"
        : "";

      var transferencia = plan.precioTransferencia
        ? '<p class="price-alt">' + dinero(plan.precioTransferencia) +
          " por transferencia</p>"
        : "";

      var mensaje = "Hola! Quiero el plan " + (plan.nombre || "");
      var boton = destacado ? "Quiero este plan" : "Consultar";

      return (
        '<article class="card plan' + (destacado ? " plan-featured" : "") + '">' +
          etiqueta +
          '<header class="plan-head">' +
            "<h3>" + esc(plan.nombre) + "</h3>" +
            "<p>" + esc(plan.descripcion) + "</p>" +
          "</header>" +
          '<p class="price">' +
            '<span class="price-main">' + dinero(plan.precioEfectivo) + "</span>" +
            '<span class="price-note">efectivo</span>' +
          "</p>" +
          transferencia +
          '<ul class="features">' + beneficios + "</ul>" +
          '<a class="btn ' + (destacado ? "btn-primary" : "btn-ghost") + ' btn-block" ' +
            'data-wa data-wa-texto="' + esc(mensaje) + '" ' +
            'href="https://wa.me/" target="_blank" rel="noopener">' + boton + "</a>" +
        "</article>"
      );
    }).join("");

    aplicarWhatsapp();
  }

  /* ---------- Turnos ---------- */

  function pintarTurnos(turnos) {
    var contenedor = document.getElementById("turnosLista");
    if (!contenedor || !turnos || !turnos.length) return;

    var grupos = [];
    turnos.forEach(function (turno) {
      var nombre = turno.grupo || "Turnos";
      var grupo = grupos.filter(function (g) { return g.nombre === nombre; })[0];
      if (!grupo) {
        grupo = { nombre: nombre, items: [] };
        grupos.push(grupo);
      }
      grupo.items.push(turno);
    });

    contenedor.innerHTML = grupos.map(function (grupo) {
      var slots = grupo.items.map(function (t) {
        return "<li>" + esc(t.inicio) + " – " + esc(t.fin) + "</li>";
      }).join("");

      return (
        '<div class="schedule-group">' +
          "<h3>" + esc(grupo.nombre) + "</h3>" +
          '<ul class="slots">' + slots + "</ul>" +
        "</div>"
      );
    }).join("");
  }

  /* ---------- Entrenador ---------- */

  function pintarEntrenador(entrenador) {
    if (!entrenador) return;

    texto("#entrenadorNombre", entrenador.nombre);
    texto("#entrenadorRol", entrenador.rol);
    texto("#entrenadorDesc", entrenador.descripcion);

    var etiqueta = document.getElementById("entrenadorEtiqueta");
    if (etiqueta) {
      if (entrenador.etiqueta) {
        etiqueta.textContent = entrenador.etiqueta;
        etiqueta.hidden = false;
      } else {
        etiqueta.hidden = true;
      }
    }

    var avatar = document.getElementById("entrenadorAvatar");
    if (avatar && entrenador.foto) {
      avatar.innerHTML = '<img src="' + esc(entrenador.foto) + '" alt="">';
      avatar.classList.add("has-foto");
    }
  }

  /* ---------- Galería ---------- */

  function pintarGaleria(fotos) {
    var seccion = document.getElementById("galeria");
    var contenedor = document.getElementById("galeriaLista");
    if (!seccion || !contenedor) return;

    if (!fotos || !fotos.length) {
      seccion.hidden = true;
      return;
    }

    contenedor.innerHTML = fotos.map(function (foto) {
      var url = typeof foto === "string" ? foto : foto.url;
      return (
        '<a class="gallery-item" href="' + esc(url) + '" target="_blank" rel="noopener">' +
          '<img src="' + esc(url) + '" alt="Foto del gimnasio" loading="lazy">' +
        "</a>"
      );
    }).join("");

    seccion.hidden = false;
  }

  /* ---------- Pasos ---------- */

  function pintarPasos(pasos) {
    var contenedor = document.getElementById("pasosLista");
    if (!contenedor || !pasos || !pasos.length) return;

    contenedor.innerHTML = pasos.map(function (paso, indice) {
      return (
        '<li class="card">' +
          '<span class="step-num">' + String(indice + 1).padStart(2, "0") + "</span>" +
          "<h3>" + esc(paso.titulo) + "</h3>" +
          "<p>" + esc(paso.texto) + "</p>" +
        "</li>"
      );
    }).join("");
  }

  /* ---------- Contacto ---------- */

  function pintarContacto(contacto) {
    if (!contacto) return;

    texto("#contactoDireccion", contacto.direccion);
    texto("#contactoHorario", contacto.horarioTexto);

    var mapa = document.getElementById("contactoMapa");
    if (mapa && contacto.direccion) {
      mapa.setAttribute("href", mapsUrl(contacto.direccion));
    }

    var tel = document.getElementById("contactoWhatsapp");
    if (tel) {
      if (contacto.telefonoVisible) tel.textContent = contacto.telefonoVisible;
      whatsapp = digitos(contacto.whatsapp);
      aplicarWhatsapp();
    }

    var insta = document.getElementById("contactoInstagram");
    if (insta && contacto.instagram) {
      insta.setAttribute("href", instagramUrl(contacto.instagram));
      insta.textContent = instagramTexto(contacto.instagram);
    }
  }

  /* ---------- Datos estructurados (Google) ---------- */

  function pintarJsonLd(sitio, contacto) {
    var nodo = document.getElementById("jsonld");
    if (!nodo) return;

    try {
      var datos = JSON.parse(nodo.textContent);
      if (contacto && contacto.telefonoVisible) datos.telephone = contacto.telefonoVisible;
      if (contacto && contacto.direccion) {
        datos.address = datos.address || {};
        datos.address.streetAddress = contacto.direccion;
      }
      if (contacto && contacto.instagram) {
        datos.sameAs = [instagramUrl(contacto.instagram)];
      }
      nodo.textContent = JSON.stringify(datos);
    } catch (e) {
      /* si el JSON está roto, no tocamos nada */
    }
  }

  /* ---------- Hero ---------- */

  function pintarHero(sitio) {
    if (!sitio) return;

    var hero = sitio.hero || {};
    texto("[data-hero-etiqueta]", hero.etiqueta);
    texto("[data-hero-titulo]", hero.titulo);
    texto("[data-hero-destacado]", hero.tituloDestacado);
    texto("[data-hero-bajada]", hero.bajada);
    texto("[data-nota-pagos]", sitio.notaPagos);

    var foto = document.getElementById("heroFoto");
    if (foto && hero.foto) {
      foto.style.backgroundImage = 'url("' + hero.foto.replace(/"/g, "%22") + '")';
      foto.hidden = false;
    }
  }

  function pintarNumeros(turnos, planes) {
    if (turnos && turnos.length) {
      texto("[data-stat-turnos]", String(turnos.length));

      var inicios = turnos.map(function (t) { return t.inicio; }).sort();
      var fines = turnos.map(function (t) { return t.fin; }).sort();
      texto(
        "[data-stat-horario]",
        horaCorta(inicios[0]) + " a " + horaCorta(fines[fines.length - 1])
      );
    }

    if (planes && planes.length) {
      texto("[data-stat-planes]", String(planes.length));
    }
  }

  /* ---------- Apariencia (tema y color de acento) ---------- */

  function contraste(hex) {
    var limpio = String(hex || "").replace("#", "");

    if (limpio.length === 3) {
      limpio = limpio.charAt(0) + limpio.charAt(0) +
        limpio.charAt(1) + limpio.charAt(1) +
        limpio.charAt(2) + limpio.charAt(2);
    }

    if (!/^[0-9a-f]{6}$/i.test(limpio)) return "#0a0a0a";

    var r = parseInt(limpio.slice(0, 2), 16);
    var g = parseInt(limpio.slice(2, 4), 16);
    var b = parseInt(limpio.slice(4, 6), 16);
    var luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminancia > 0.6 ? "#0a0a0a" : "#ffffff";
  }

  function aplicarApariencia(apariencia) {
    if (!apariencia) return;

    var porDefecto = apariencia.temaPorDefecto || "auto";

    try {
      localStorage.setItem("gym_tema_defecto", porDefecto);
    } catch (e) {
      /* sin almacenamiento */
    }

    if (apariencia.acento) {
      document.documentElement.style.setProperty("--acento", apariencia.acento);
      document.documentElement.style.setProperty("--acento-texto", contraste(apariencia.acento));
    }

    var elegido = null;
    try {
      elegido = localStorage.getItem("gym_tema");
    } catch (e) {
      elegido = null;
    }

    /* Si el visitante nunca eligió, mandar el tema por defecto del panel */
    if (!elegido) {
      var tema = porDefecto === "auto"
        ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "oscuro")
        : porDefecto;

      if (window.GYM_TEMA) {
        window.GYM_TEMA.aplicar(tema, false);
      } else {
        document.documentElement.setAttribute(
          "data-tema",
          tema === "claro" ? "claro" : "oscuro"
        );
      }
    }
  }

  /* ---------- Pintar todo ---------- */

  function pintar(datos) {
    var sitio = datos.sitio || {};
    var contacto = sitio.contacto || {};

    aplicarApariencia(sitio.apariencia);

    whatsapp = digitos(contacto.whatsapp);
    aplicarWhatsapp();

    pintarHero(sitio);
    pintarContacto(contacto);
    pintarNumeros(datos.turnos, datos.planes);
    pintarPlanes(datos.planes);
    pintarTurnos(datos.turnos);
    pintarEntrenador(datos.entrenador);
    pintarGaleria(datos.galeria);
    pintarPasos(datos.pasos);
    pintarJsonLd(sitio, contacto);
  }

  /* ---------- Cargar ---------- */

  function cargar() {
    if (!cfg || !cfg.url || !cfg.key) return;

    fetch(cfg.url + "/rest/v1/" + cfg.tabla + "?id=eq.1&select=datos", {
      headers: {
        apikey: cfg.key,
        Authorization: "Bearer " + cfg.key
      },
      cache: "no-store"
    })
      .then(function (respuesta) {
        if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
        return respuesta.json();
      })
      .then(function (filas) {
        var datos = filas && filas[0] && filas[0].datos;
        if (datos && Object.keys(datos).length) pintar(datos);
      })
      .catch(function () {
        /* sin conexión o sin datos: queda el contenido de respaldo */
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cargar);
  } else {
    cargar();
  }
})();

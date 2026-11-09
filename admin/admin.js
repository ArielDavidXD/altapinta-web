/* ============================================================
   Panel del sitio — lógica
   Login con Supabase, edición de contenido y subida de fotos.
   ============================================================ */

(function () {
  "use strict";

  var cfg = window.GYM_SITIO;
  var CLAVE_SESION = "gym_admin_sesion";

  var sesion = null;
  var datos = null;
  var sucio = false;

  /* ---------- Atajos ---------- */

  function $(selector, raiz) {
    return (raiz || document).querySelector(selector);
  }

  function $$(selector, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(selector));
  }

  /* ---------- Tema del panel ---------- */

  var CLAVE_TEMA = "gym_admin_tema";

  function temaActual() {
    return document.documentElement.getAttribute("data-tema") === "claro" ? "claro" : "oscuro";
  }

  function aplicarTema(tema) {
    tema = tema === "claro" ? "claro" : "oscuro";
    document.documentElement.setAttribute("data-tema", tema);

    $$(".js-tema").forEach(function (boton) {
      var hacia = tema === "claro" ? "oscuro" : "claro";
      boton.setAttribute("aria-label", "Cambiar a modo " + hacia);
      boton.setAttribute("title", "Cambiar a modo " + hacia);
    });
  }

  function conectarTema() {
    $$(".js-tema").forEach(function (boton) {
      boton.addEventListener("click", function () {
        var nuevo = temaActual() === "claro" ? "oscuro" : "claro";

        aplicarTema(nuevo);

        try {
          localStorage.setItem(CLAVE_TEMA, nuevo);
        } catch (e) {
          /* sin almacenamiento: el tema vale por esta visita */
        }

        if (datos) renderApariencia();
      });
    });

    aplicarTema(temaActual());
  }

  /* ---------- Títulos de las secciones ---------- */

  var TITULOS = {
    general: "General",
    planes: "Planes y precios",
    turnos: "Turnos",
    entrenador: "Entrenador",
    galeria: "Galería",
    contacto: "Contacto",
    apariencia: "Apariencia",
    cuenta: "Cuenta"
  };

  /* ---------- Rutas dentro del objeto ---------- */

  function getPath(obj, ruta) {
    return ruta.split(".").reduce(function (actual, clave) {
      return actual == null ? undefined : actual[clave];
    }, obj);
  }

  function setPath(obj, ruta, valor) {
    var partes = ruta.split(".");
    var actual = obj;

    for (var i = 0; i < partes.length - 1; i++) {
      var clave = partes[i];
      if (actual[clave] == null || typeof actual[clave] !== "object") {
        actual[clave] = /^\d+$/.test(partes[i + 1]) ? [] : {};
      }
      actual = actual[clave];
    }

    actual[partes[partes.length - 1]] = valor;
  }

  /* ---------- Estado visual ---------- */

  function estado(texto, clase) {
    var el = $("#estadoGuardado");
    if (!el) return;
    el.textContent = texto;
    el.className = "estado" + (clase ? " " + clase : "");
  }

  function actualizarBotones() {
    $("#btnGuardar").disabled = !sucio;
    $("#btnDescartar").hidden = !sucio;
  }

  function marcarSucio() {
    sucio = true;
    estado("Cambios sin guardar", "sucio");
    actualizarBotones();
  }

  /* ---------- Sesión ---------- */

  function guardarSesion() {
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    } catch (e) {
      /* sin almacenamiento: la sesión dura hasta cerrar la pestaña */
    }
  }

  function leerSesion() {
    try {
      var crudo = localStorage.getItem(CLAVE_SESION);
      return crudo ? JSON.parse(crudo) : null;
    } catch (e) {
      return null;
    }
  }

  function borrarSesion() {
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch (e) {
      /* nada */
    }
    sesion = null;
  }

  function traducirError(mensaje) {
    var m = String(mensaje || "");
    if (/invalid login/i.test(m)) return "Email o contraseña incorrectos.";
    if (/email not confirmed/i.test(m)) return "La cuenta todavía no está confirmada.";
    if (/different from the old password/i.test(m)) {
      return "La contraseña nueva tiene que ser distinta de la actual.";
    }
    if (/password should be/i.test(m)) return "La contraseña es demasiado corta.";
    return m || "Ocurrió un error.";
  }

  async function pedirToken(email, password) {
    var respuesta = await fetch(cfg.url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    });

    if (!respuesta.ok) {
      var detalle = "";
      try {
        var error = await respuesta.json();
        detalle = error.error_description || error.msg || "";
      } catch (e) {
        /* sin cuerpo */
      }
      throw new Error(traducirError(detalle));
    }

    var s = await respuesta.json();
    sesion = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expira: Date.now() + (s.expires_in || 3600) * 1000,
      email: (s.user && s.user.email) || email
    };
    guardarSesion();
  }

  async function refrescarSesion() {
    if (!sesion || !sesion.refresh_token) throw new Error("Sesión vencida");

    var respuesta = await fetch(cfg.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: sesion.refresh_token })
    });

    if (!respuesta.ok) {
      borrarSesion();
      throw new Error("Sesión vencida");
    }

    var s = await respuesta.json();
    sesion = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expira: Date.now() + (s.expires_in || 3600) * 1000,
      email: (s.user && s.user.email) || sesion.email
    };
    guardarSesion();
  }

  async function asegurarSesion() {
    if (!sesion) throw new Error("No hay sesión");
    if (Date.now() > sesion.expira - 60000) await refrescarSesion();
  }

  /* ---------- Llamadas a Supabase ---------- */

  async function api(ruta, opciones) {
    opciones = opciones || {};
    await asegurarSesion();

    function hacer() {
      var cabeceras = Object.assign(
        { apikey: cfg.key, Authorization: "Bearer " + sesion.access_token },
        opciones.headers || {}
      );
      return fetch(cfg.url + ruta, Object.assign({}, opciones, { headers: cabeceras }));
    }

    var respuesta = await hacer();

    if (respuesta.status === 401) {
      await refrescarSesion();
      respuesta = await hacer();
    }

    return respuesta;
  }

  /* ---------- Contenido ---------- */

  function normalizar() {
    datos = datos || {};
    datos.sitio = datos.sitio || {};
    datos.sitio.hero = datos.sitio.hero || {};
    datos.sitio.contacto = datos.sitio.contacto || {};
    datos.sitio.apariencia = datos.sitio.apariencia || {};
    datos.entrenador = datos.entrenador || {};

    if (!datos.sitio.apariencia.temaPorDefecto) {
      datos.sitio.apariencia.temaPorDefecto = "auto";
    }

    if (typeof datos.sitio.apariencia.acento !== "string") {
      datos.sitio.apariencia.acento = "";
    }

    ["planes", "turnos", "galeria", "pasos"].forEach(function (clave) {
      if (!Array.isArray(datos[clave])) datos[clave] = [];
    });
  }

  async function cargarContenido() {
    estado("Cargando…");

    var respuesta = await fetch(
      cfg.url + "/rest/v1/" + cfg.tabla + "?id=eq.1&select=datos",
      {
        headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key },
        cache: "no-store"
      }
    );

    if (!respuesta.ok) throw new Error("No se pudo cargar el contenido");

    var filas = await respuesta.json();
    datos = (filas[0] && filas[0].datos) || {};
    normalizar();

    renderPlanes();
    renderTurnos();
    renderPasos();
    renderGaleria();
    llenarTodo();

    sucio = false;
    estado("Sin cambios", "");
    actualizarBotones();
  }

  async function guardar() {
    estado("Guardando…");

    try {
      var respuesta = await api("/rest/v1/" + cfg.tabla + "?id=eq.1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ datos: datos })
      });

      if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);

      sucio = false;
      estado("Guardado ✓", "ok");
      actualizarBotones();
    } catch (error) {
      estado("No se pudo guardar: " + error.message, "error");
    }
  }

  /* ---------- Campos ---------- */

  function leerCampo(el) {
    var tipo = el.getAttribute("data-tipo");

    if (tipo === "numero") {
      var n = Number(el.value);
      return isFinite(n) ? n : 0;
    }

    if (tipo === "check") return el.checked;

    if (tipo === "beneficios") {
      return el.value
        .split("\n")
        .map(function (linea) { return linea.trim(); })
        .filter(Boolean)
        .map(function (linea) {
          var no = linea.charAt(0) === "-";
          return {
            texto: (no ? linea.slice(1) : linea).trim(),
            incluido: !no
          };
        });
    }

    return el.value;
  }

  function escribirCampo(el, valor) {
    var tipo = el.getAttribute("data-tipo");

    if (tipo === "check") {
      el.checked = !!valor;
      return;
    }

    if (tipo === "beneficios") {
      el.value = (valor || [])
        .map(function (b) {
          return (b.incluido === false ? "- " : "") + b.texto;
        })
        .join("\n");
      return;
    }

    el.value = valor == null ? "" : valor;
  }

  function llenarTodo() {
    $$("[data-campo]").forEach(function (el) {
      escribirCampo(el, getPath(datos, el.getAttribute("data-campo")));
    });
    actualizarPreviews();
    renderApariencia();
  }

  /* ---------- Editores ---------- */

  function renderPlanes() {
    var contenedor = $("#planesEditor");

    contenedor.innerHTML = datos.planes.map(function (plan, i) {
      return (
        '<article class="bloque">' +
          '<div class="bloque-head">' +
            "<h3>Plan " + (i + 1) + "</h3>" +
            '<button type="button" class="btn btn-peligro" data-accion="borrar-plan" data-i="' + i + '">Eliminar</button>' +
          "</div>" +

          '<div class="fila">' +
            '<label class="campo"><span>Nombre</span><input data-campo="planes.' + i + '.nombre"></label>' +
            '<label class="campo"><span>Etiqueta (opcional)</span><input data-campo="planes.' + i + '.etiqueta" placeholder="Con entrenador"></label>' +
          "</div>" +

          '<label class="campo"><span>Descripción</span><input data-campo="planes.' + i + '.descripcion"></label>' +

          '<div class="fila">' +
            '<label class="campo"><span>Precio efectivo</span><input type="number" min="0" step="50" data-tipo="numero" data-campo="planes.' + i + '.precioEfectivo"></label>' +
            '<label class="campo"><span>Precio transferencia</span><input type="number" min="0" step="50" data-tipo="numero" data-campo="planes.' + i + '.precioTransferencia"></label>' +
          "</div>" +

          '<label class="check"><input type="checkbox" data-tipo="check" data-campo="planes.' + i + '.destacado"> Plan destacado</label>' +

          '<label class="campo">' +
            "<span>Beneficios</span>" +
            '<textarea rows="4" data-tipo="beneficios" data-campo="planes.' + i + '.beneficios" ' +
              'placeholder="Acceso al gimnasio&#10;Turno fijo de una hora"></textarea>' +
            '<span class="ayuda">Uno por línea. Empezá con "-" los que NO incluye.</span>' +
          "</label>" +
        "</article>"
      );
    }).join("");
  }

  function renderTurnos() {
    var contenedor = $("#turnosEditor");

    contenedor.innerHTML = datos.turnos.map(function (turno, i) {
      return (
        '<div class="turno-fila">' +
          '<input type="time" data-campo="turnos.' + i + '.inicio" aria-label="Desde">' +
          '<span class="separador-hora">a</span>' +
          '<input type="time" data-campo="turnos.' + i + '.fin" aria-label="Hasta">' +
          '<input data-campo="turnos.' + i + '.grupo" list="listaGrupos" placeholder="Grupo" aria-label="Grupo">' +
          '<button type="button" class="icono-borrar" data-accion="borrar-turno" data-i="' + i + '" aria-label="Quitar turno">×</button>' +
        "</div>"
      );
    }).join("");

    if (!document.getElementById("listaGrupos")) {
      var lista = document.createElement("datalist");
      lista.id = "listaGrupos";
      ["Mañana", "Tarde", "Noche"].forEach(function (grupo) {
        var opcion = document.createElement("option");
        opcion.value = grupo;
        lista.appendChild(opcion);
      });
      document.body.appendChild(lista);
    }
  }

  function renderPasos() {
    var contenedor = $("#pasosEditor");

    contenedor.innerHTML = datos.pasos.map(function (paso, i) {
      return (
        '<article class="bloque">' +
          '<div class="bloque-head">' +
            "<h3>Paso " + (i + 1) + "</h3>" +
            '<button type="button" class="btn btn-peligro" data-accion="borrar-paso" data-i="' + i + '">Eliminar</button>' +
          "</div>" +
          '<label class="campo"><span>Título</span><input data-campo="pasos.' + i + '.titulo"></label>' +
          '<label class="campo"><span>Texto</span><textarea rows="2" data-campo="pasos.' + i + '.texto"></textarea></label>' +
        "</article>"
      );
    }).join("");
  }

  function renderGaleria() {
    var contenedor = $("#galeriaEditor");

    if (!datos.galeria.length) {
      contenedor.innerHTML = '<p class="ayuda">Todavía no hay fotos.</p>';
      return;
    }

    contenedor.innerHTML = datos.galeria.map(function (foto, i) {
      var url = typeof foto === "string" ? foto : foto.url;
      return (
        '<figure class="foto-editor">' +
          '<img src="' + url + '" alt="">' +
          '<button type="button" data-accion="borrar-foto" data-i="' + i + '" aria-label="Quitar foto">×</button>' +
        "</figure>"
      );
    }).join("");
  }

  function actualizarPreviews() {
    if (!datos) return;

    var fotoHero = datos.sitio.hero.foto || "";
    var previewHero = $("#previewHero");
    var quitarHero = $("#quitarHero");
    if (fotoHero) {
      previewHero.src = fotoHero;
      previewHero.hidden = false;
      quitarHero.hidden = false;
    } else {
      previewHero.hidden = true;
      quitarHero.hidden = true;
    }

    var fotoEntrenador = datos.entrenador.foto || "";
    var previewEntrenador = $("#previewEntrenador");
    var quitarEntrenador = $("#quitarEntrenador");
    if (fotoEntrenador) {
      previewEntrenador.src = fotoEntrenador;
      previewEntrenador.hidden = false;
      quitarEntrenador.hidden = false;
    } else {
      previewEntrenador.hidden = true;
      quitarEntrenador.hidden = true;
    }
  }

  /* ---------- Apariencia ---------- */

  var ACENTOS = [
    { valor: "", nombre: "Original" },
    { valor: "#f2b544", nombre: "Ámbar" },
    { valor: "#e85c5c", nombre: "Rojo" },
    { valor: "#58c98a", nombre: "Verde" },
    { valor: "#5aa9f0", nombre: "Azul" },
    { valor: "#b48cf2", nombre: "Violeta" }
  ];

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

  function renderApariencia() {
    var contenedor = $("#coloresAcento");
    if (!contenedor || !datos) return;

    var acento = (datos.sitio.apariencia && datos.sitio.apariencia.acento) || "";

    contenedor.innerHTML = ACENTOS.map(function (opcion) {
      var activo = acento.toLowerCase() === opcion.valor.toLowerCase();

      return (
        '<button type="button" class="color-opcion' +
          (opcion.valor ? "" : " original") +
          (activo ? " activo" : "") +
          '" data-acento="' + opcion.valor + '"' +
          ' title="' + opcion.nombre + '"' +
          ' aria-label="' + opcion.nombre + '"' +
          ' aria-pressed="' + (activo ? "true" : "false") + '"' +
          (opcion.valor ? ' style="--swatch: ' + opcion.valor + '"' : "") +
        "></button>"
      );
    }).join("");

    var libre = $("#acentoLibre");
    if (libre) {
      libre.value = /^#[0-9a-f]{6}$/i.test(acento)
        ? acento
        : (temaActual() === "claro" ? "#171715" : "#ffffff");
    }

    var previa = $("#vistaPreviaAcento");
    if (previa) {
      if (acento) {
        previa.style.setProperty("--acento", acento);
        previa.style.setProperty("--acento-texto", contraste(acento));
      } else {
        previa.style.removeProperty("--acento");
        previa.style.removeProperty("--acento-texto");
      }
    }
  }

  /* ---------- Fotos ---------- */

  function comprimir(archivo, maxLado, calidad) {
    maxLado = maxLado || 1600;
    calidad = calidad || 0.85;

    return new Promise(function (resolver, rechazar) {
      if (!/^image\//.test(archivo.type)) {
        rechazar(new Error("El archivo no es una imagen"));
        return;
      }

      var url = URL.createObjectURL(archivo);
      var imagen = new Image();

      imagen.onload = function () {
        URL.revokeObjectURL(url);

        var escala = Math.min(1, maxLado / Math.max(imagen.width, imagen.height));
        var ancho = Math.max(1, Math.round(imagen.width * escala));
        var alto = Math.max(1, Math.round(imagen.height * escala));

        var lienzo = document.createElement("canvas");
        lienzo.width = ancho;
        lienzo.height = alto;

        var contexto = lienzo.getContext("2d");
        contexto.fillStyle = "#ffffff";
        contexto.fillRect(0, 0, ancho, alto);
        contexto.drawImage(imagen, 0, 0, ancho, alto);

        lienzo.toBlob(
          function (blob) {
            if (blob) resolver(blob);
            else rechazar(new Error("No se pudo procesar la imagen"));
          },
          "image/jpeg",
          calidad
        );
      };

      imagen.onerror = function () {
        URL.revokeObjectURL(url);
        rechazar(new Error("No se pudo leer la imagen"));
      };

      imagen.src = url;
    });
  }

  async function subirFoto(archivo) {
    var blob = await comprimir(archivo);
    var nombre = "sitio/" + Date.now() + "-" +
      Math.random().toString(36).slice(2, 8) + ".jpg";

    var respuesta = await api("/storage/v1/object/web/" + nombre, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", "x-upsert": "true" },
      body: blob
    });

    if (!respuesta.ok) {
      var detalle = "";
      try {
        var error = await respuesta.json();
        detalle = error.message || error.error || "";
      } catch (e) {
        /* sin cuerpo */
      }
      throw new Error(detalle || "HTTP " + respuesta.status);
    }

    return cfg.url + "/storage/v1/object/public/web/" + nombre;
  }

  /* ---------- Vistas ---------- */

  function mostrarLogin(mensaje) {
    $("#vistaLogin").hidden = false;
    $("#vistaPanel").hidden = true;

    var error = $("#loginError");
    if (mensaje) {
      error.textContent = mensaje;
      error.hidden = false;
    } else {
      error.hidden = true;
    }
  }

  function mostrarPanel() {
    $("#vistaLogin").hidden = true;
    $("#vistaPanel").hidden = false;

    if (sesion && sesion.email) {
      $("#cuentaEmail").value = sesion.email;
    }
  }

  /* ---------- Eventos ---------- */

  function conectar() {
    /* Login */
    $("#formLogin").addEventListener("submit", async function (evento) {
      evento.preventDefault();

      var boton = $("#btnLogin");
      boton.disabled = true;
      $("#loginError").hidden = true;

      try {
        await pedirToken(
          $("#loginEmail").value.trim(),
          $("#loginPassword").value
        );
        mostrarPanel();
        await cargarContenido();
      } catch (error) {
        mostrarLogin(error.message);
      } finally {
        boton.disabled = false;
      }
    });

    /* Salir */
    $$(".js-salir").forEach(function (boton) {
      boton.addEventListener("click", async function () {
        try {
          if (sesion) {
            await fetch(cfg.url + "/auth/v1/logout", {
              method: "POST",
              headers: {
                apikey: cfg.key,
                Authorization: "Bearer " + sesion.access_token
              }
            });
          }
        } catch (e) {
          /* da igual */
        }

        borrarSesion();
        window.location.reload();
      });
    });

    /* Tabs */
    $$(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        $$(".tab").forEach(function (otro) {
          otro.classList.toggle("activo", otro === tab);
        });
        $$("[data-panel]").forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-panel") !== tab.getAttribute("data-tab");
        });

        var nombre = tab.getAttribute("data-tab");
        var titulo = $("#tituloSeccion");
        if (titulo) titulo.textContent = TITULOS[nombre] || "Panel";

        window.scrollTo(0, 0);
      });
    });

    /* Cambios en campos (delegado: sirve para los editores dinámicos) */
    function alEditar(evento) {
      var el = evento.target.closest("[data-campo]");
      if (!el || !datos) return;

      setPath(datos, el.getAttribute("data-campo"), leerCampo(el));
      marcarSucio();
    }

    document.addEventListener("input", alEditar);
    document.addEventListener("change", alEditar);

    /* Botones de borrar / agregar */
    document.addEventListener("click", function (evento) {
      var boton = evento.target.closest("[data-accion]");
      if (!boton || !datos) return;

      var accion = boton.getAttribute("data-accion");
      var indice = Number(boton.getAttribute("data-i"));

      if (accion === "borrar-plan") {
        datos.planes.splice(indice, 1);
        renderPlanes();
      } else if (accion === "borrar-turno") {
        datos.turnos.splice(indice, 1);
        renderTurnos();
      } else if (accion === "borrar-paso") {
        datos.pasos.splice(indice, 1);
        renderPasos();
      } else if (accion === "borrar-foto") {
        datos.galeria.splice(indice, 1);
        renderGaleria();
      } else {
        return;
      }

      llenarTodo();
      marcarSucio();
    });

    $("#btnAgregarPlan").addEventListener("click", function () {
      datos.planes.push({
        nombre: "Nuevo plan",
        descripcion: "",
        precioEfectivo: 0,
        precioTransferencia: 0,
        destacado: false,
        etiqueta: "",
        beneficios: []
      });
      renderPlanes();
      llenarTodo();
      marcarSucio();
    });

    $("#btnAgregarTurno").addEventListener("click", function () {
      var ultimo = datos.turnos[datos.turnos.length - 1];
      datos.turnos.push({
        grupo: (ultimo && ultimo.grupo) || "Mañana",
        inicio: "07:00",
        fin: "08:00"
      });
      renderTurnos();
      llenarTodo();
      marcarSucio();
    });

    $("#btnAgregarPaso").addEventListener("click", function () {
      datos.pasos.push({ titulo: "", texto: "" });
      renderPasos();
      llenarTodo();
      marcarSucio();
    });

    /* Apariencia: color de acento */
    var colores = $("#coloresAcento");
    if (colores) {
      colores.addEventListener("click", function (evento) {
        var boton = evento.target.closest("[data-acento]");
        if (!boton || !datos) return;

        datos.sitio.apariencia.acento = boton.getAttribute("data-acento");
        renderApariencia();
        marcarSucio();
      });
    }

    var acentoLibre = $("#acentoLibre");
    if (acentoLibre) {
      acentoLibre.addEventListener("input", function () {
        if (!datos) return;

        datos.sitio.apariencia.acento = acentoLibre.value;
        renderApariencia();
        marcarSucio();
      });
    }

    var acentoOriginal = $("#btnAcentoOriginal");
    if (acentoOriginal) {
      acentoOriginal.addEventListener("click", function () {
        if (!datos) return;

        datos.sitio.apariencia.acento = "";
        renderApariencia();
        marcarSucio();
      });
    }

    /* Guardar / descartar */
    $("#btnGuardar").addEventListener("click", guardar);

    $("#btnDescartar").addEventListener("click", async function () {
      try {
        await cargarContenido();
      } catch (error) {
        estado("No se pudo recargar", "error");
      }
    });

    /* Fotos */
    $("#inputHero").addEventListener("change", async function (evento) {
      var archivo = evento.target.files[0];
      if (!archivo) return;

      var nota = $("#estadoHero");
      nota.textContent = "Subiendo…";

      try {
        var url = await subirFoto(archivo);
        datos.sitio.hero.foto = url;
        actualizarPreviews();
        marcarSucio();
        nota.textContent = "Foto lista. Guardá los cambios.";
      } catch (error) {
        nota.textContent = "Error: " + error.message;
      }

      evento.target.value = "";
    });

    $("#inputEntrenador").addEventListener("change", async function (evento) {
      var archivo = evento.target.files[0];
      if (!archivo) return;

      var nota = $("#estadoEntrenador");
      nota.textContent = "Subiendo…";

      try {
        var url = await subirFoto(archivo);
        datos.entrenador.foto = url;
        actualizarPreviews();
        marcarSucio();
        nota.textContent = "Foto lista. Guardá los cambios.";
      } catch (error) {
        nota.textContent = "Error: " + error.message;
      }

      evento.target.value = "";
    });

    $("#inputGaleria").addEventListener("change", async function (evento) {
      var archivos = Array.prototype.slice.call(evento.target.files);
      if (!archivos.length) return;

      var nota = $("#estadoGaleria");
      var subidas = 0;

      for (var i = 0; i < archivos.length; i++) {
        nota.textContent = "Subiendo " + (i + 1) + " de " + archivos.length + "…";
        try {
          var url = await subirFoto(archivos[i]);
          datos.galeria.push({ url: url });
          subidas++;
        } catch (error) {
          nota.textContent = "Error con " + archivos[i].name + ": " + error.message;
        }
      }

      renderGaleria();
      marcarSucio();

      if (subidas === archivos.length) {
        nota.textContent = subidas + " foto(s) subida(s). Guardá los cambios.";
      }

      evento.target.value = "";
    });

    $("#quitarHero").addEventListener("click", function () {
      datos.sitio.hero.foto = "";
      actualizarPreviews();
      marcarSucio();
    });

    $("#quitarEntrenador").addEventListener("click", function () {
      datos.entrenador.foto = "";
      actualizarPreviews();
      marcarSucio();
    });

    /* Contraseña */
    $("#btnCambiarPass").addEventListener("click", async function () {
      var nueva = $("#passNueva").value;
      var repetir = $("#passRepetir").value;
      var mensaje = $("#passMensaje");

      function aviso(texto, esError) {
        mensaje.textContent = texto;
        mensaje.className = "mensaje" + (esError ? " error" : "");
        mensaje.hidden = false;
      }

      if (nueva.length < 8) {
        aviso("La contraseña tiene que tener al menos 8 caracteres.", true);
        return;
      }

      if (nueva !== repetir) {
        aviso("Las contraseñas no coinciden.", true);
        return;
      }

      try {
        var respuesta = await api("/auth/v1/user", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: nueva })
        });

        if (!respuesta.ok) {
          var detalle = "";
          try {
            var cuerpo = await respuesta.json();
            detalle = cuerpo.msg || cuerpo.message || cuerpo.error_description || "";
          } catch (e) {
            /* sin cuerpo */
          }
          throw new Error(traducirError(detalle) || ("HTTP " + respuesta.status));
        }

        $("#passNueva").value = "";
        $("#passRepetir").value = "";
        aviso("Contraseña actualizada ✓", false);
      } catch (error) {
        aviso("No se pudo cambiar: " + error.message, true);
      }
    });

    /* Aviso al cerrar con cambios sin guardar */
    window.addEventListener("beforeunload", function (evento) {
      if (!sucio) return;
      evento.preventDefault();
      evento.returnValue = "";
    });
  }

  /* ---------- Arranque ---------- */

  async function iniciar() {
    conectarTema();
    conectar();

    var guardada = leerSesion();
    if (!guardada) {
      mostrarLogin();
      return;
    }

    sesion = guardada;
    mostrarPanel();

    try {
      await asegurarSesion();
      await cargarContenido();
    } catch (error) {
      borrarSesion();
      mostrarLogin("La sesión venció. Ingresá de nuevo.");
    }
  }

  iniciar();
})();

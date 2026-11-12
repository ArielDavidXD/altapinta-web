# Sitio web — AltaPinta GYM

Landing del gimnasio con panel de administración. HTML + CSS + JavaScript,
sin dependencias ni proceso de build. Los textos, precios, turnos y fotos se
guardan en Supabase y se editan desde `/admin/`.

## Cómo verlo

- Doble clic en `index.html`, o
- Servirlo localmente (recomendado):

```powershell
cd web
py -m http.server 8123
# sitio:  http://127.0.0.1:8123
# panel:  http://127.0.0.1:8123/admin/
```

## Panel de administración

- **Dirección:** `/admin/` (también hay un link "Administrar" en el pie del sitio).
- **Usuario:** `admin@altapintagym.com`
- **Contraseña inicial:** la que te pasé al crear el panel.

Cambiala la primera vez desde la pestaña **Cuenta**.

### Qué se puede editar

| Pestaña | Qué cambia |
| --- | --- |
| General | Textos de la portada, foto de fondo, nota de pagos y pasos |
| Planes | Nombre, descripción, precios, beneficios y plan destacado |
| Turnos | Horarios y grupos (Mañana, Tarde, etc.) |
| Entrenador | Nombre, cargo, descripción, etiqueta y foto (contenido de Supabase) |
| Galería | Fotos del local (si está vacía, la sección no aparece) |
| Contacto | Dirección, WhatsApp, teléfono, Instagram y horarios |
| Apariencia | Tema por defecto del sitio y color de acento |
| Cuenta | Cambiar contraseña |

Los cambios se ven al instante en el sitio al tocar **Guardar cambios**.
Las fotos se achican solas (máx. 1600 px) antes de subirse.

### Tema claro / oscuro

- El sitio tiene un botón de sol/luna en el encabezado; la elección de cada
  visitante se guarda en su navegador.
- En **Apariencia** se elige el tema que ven quienes entran por primera vez
  (automático según el dispositivo, oscuro o claro) y el color de acento de
  botones, etiquetas y detalles. "Original" usa blanco en oscuro y negro en claro.
- El panel también tiene su propio botón de tema (no cambia el del sitio).

## Entrenadores desde la base local

La sección **Equipo** no depende de Supabase. Se genera desde la tabla
`"Entrenadores"` de la base local `GYM` con:

```powershell
.\exportar_entrenadores.ps1
```

Eso reescribe `web/entrenadores.js` (solo entrenadores con `eliminado = false`,
igual que la app de escritorio). Para actualizar también el sitio público:

```powershell
.\exportar_entrenadores.ps1 -Publicar
```

Si `entrenadores.js` tiene datos, esa lista manda sobre el entrenador único
del panel. Si está vacío, queda el bloque de respaldo de `index.html`.

## Cómo está armado

- `index.html`: estructura y contenido de respaldo (si no hay conexión).
- `contenido.js`: trae los datos de Supabase y actualiza la página.
- `entrenadores.js`: lista de entrenadores exportada desde la base local.
- `config.js`: URL y clave pública (`anon`) del proyecto Supabase.
- `admin/`: panel de administración (login, formularios y subida de fotos).
- `styles.css`, `script.js`: estilos y animaciones del sitio.
- `img/`, `fonts/`: logo y tipografía Montserrat (self-hosted).

En Supabase:

- Tabla `web_contenido` (una fila, `id = 1`, columna `datos` en JSON).
- Bucket `web` para las fotos (lectura pública).
- Solo el usuario `admin@altapintagym.com` puede escribir (políticas RLS).
  La clave `anon` de `config.js` es pública: sirve para leer, no para editar.

## Publicar

- **GitHub Pages (actual):** https://arieldavidxd.github.io/altapinta-web/
  (repo público `ArielDavidXD/altapinta-web`, contenido de `web/` en la raíz
  de `main`).
- **Netlify Drop:** arrastrar la carpeta `web/` a https://app.netlify.com/drop
- **Hosting propio:** subir el contenido de `web/` por FTP.

El sitio es estático. Lo único que sale de la base local es
`entrenadores.js`, que se regenera con `exportar_entrenadores.ps1`.

## App para Android

La sección **"Obtené nuestra app"** descarga el APK desde GitHub Releases del
repo `ArielDavidXD/GymApplication` (público):

- Descarga directa:
  `https://github.com/ArielDavidXD/GymApplication/releases/latest/download/altapinta-gym.apk`
- Todas las versiones:
  `https://github.com/ArielDavidXD/GymApplication/releases`

### Publicar una versión nueva

1. Compilar el APK:

   ```powershell
   cd C:\Users\Ariel David\AndroidStudioProjects\GymApplication
   gradlew.bat assembleDebug
   ```

2. Entrar a https://github.com/ArielDavidXD/GymApplication/releases
   → **Draft a new release**.
3. Elegir un tag nuevo (por ejemplo `v1.1`), adjuntar
   `app/build/outputs/apk/debug/app-debug.apk` **renombrado a
   `altapinta-gym.apk`** y publicar.
4. Listo: el botón del sitio siempre baja la última release, no hay que tocar
   el HTML.

> El archivo adjunto debe llamarse siempre `altapinta-gym.apk` para que el
> link `latest/download` siga funcionando.

## Si se olvida la contraseña

1. Entrar a https://supabase.com/dashboard → proyecto del gimnasio.
2. **Authentication → Users** → buscar `admin@altapintagym.com`.
3. **Reset password** (o crear un usuario nuevo y avisar para actualizar la
   política de escritura).

## Notas

- El plan de prueba `nuevo` de la base del gimnasio **no** se publica.
- Los datos de contacto iniciales son provisorios: se cambian desde el panel.
- El sitio respeta `prefers-reduced-motion` y se navega con teclado.

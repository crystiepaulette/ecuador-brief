# The Ecuador Brief

Briefing diario para entender Ecuador, más allá de los titulares. El sitio es una página estática: cada edición es un archivo Markdown. No hace falta tocar el código para publicar una nueva.

**Sitio:** https://crystiepaulette.github.io/ecuador-brief/

La portada muestra siempre la edición más reciente. Cada edición tiene además su propia dirección, por ejemplo `https://crystiepaulette.github.io/ecuador-brief/2026-11-26/`.

## Agregar una edición

1. Crea un archivo nuevo en la carpeta `editions/`.
2. El nombre es la fecha, con este formato exacto: `editions/AAAA-MM-DD.md`.  
   Ejemplo: `editions/2026-11-27.md`.
3. Escribe la edición en Markdown. Puedes copiar la anterior y reemplazar el contenido.
4. Guarda, haz commit y súbelo a la rama `main`.

Con eso basta. El sitio detecta el archivo solo y ordena las ediciones de la más nueva a la más antigua.

Si copias la cabecera `# THE ECUADOR BRIEF` y el lema, no se muestran dos veces: la página ya los dibuja. El párrafo siguiente —fecha, cierre, ventana y lectura— sí aparece, justo debajo de la cabecera.

## Un gráfico, si hace falta

Es opcional. Crea al lado un archivo con el mismo nombre y la terminación `.charts.json`.

Ejemplo: `editions/2026-11-27.charts.json`.

```json
[
  {
    "type": "bars",
    "title": "Título del gráfico",
    "source": "Institución, fecha y corte",
    "unit": "reportes",
    "after": "Primeras palabras del titular",
    "data": [
      { "label": "Los Ríos", "value": 16 },
      { "label": "Guayas", "value": 6 }
    ]
  }
]
```

- `type` puede ser `bars` (barras horizontales), `columns` (columnas) o `line` (línea).
- `after` coloca el gráfico al final de la sección cuyo titular empieza por ese texto. No importan mayúsculas ni tildes.
- También puedes escribir `<!--chart:1-->` en el Markdown, en el lugar exacto. El `1` es el primer gráfico del archivo; si hay marcador, se usa ese lugar y se ignora `after`.
- Si no hay `after` ni marcador, el gráfico queda al final de la edición.
- `unit` es opcional. En cada dato, `display` es opcional y cambia solo el texto del número; la barra usa `value`.

## Activar GitHub Pages (una sola vez)

1. Abre este repositorio en GitHub.
2. Entra en **Settings → Pages**.
3. En **Build and deployment**, en **Source**, elige **GitHub Actions**.

A partir de ahí, cada actualización de `main` publica el sitio en  
https://crystiepaulette.github.io/ecuador-brief/

La primera publicación puede tardar un par de minutos. En la pestaña **Actions** se ve si terminó bien.

## Guardar la app en el iPhone

1. Abre el sitio en Safari.
2. Toca **Compartir**.
3. Elige **Agregar a pantalla de inicio**.
4. El nombre debe verse como **Ecuador Brief**, con su icono. Confirma.

Se abre a pantalla completa, como una app. Si ya abriste una edición con conexión, puedes volver a leerla sin red. Para ver una edición nueva hace falta conexión al menos una vez.

## Para quien mantenga el código

Hace falta Node.js 22.

```bash
npm install
npm run dev
```

Abre http://localhost:4321/ecuador-brief/

```bash
npm test
npm run build
npm run preview:pages
```

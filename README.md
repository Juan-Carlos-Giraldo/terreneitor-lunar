# Terreneitor Lunar

Dashboard en React para cargar y revisar archivos CSV de telemetría de vuelo. La
aplicación procesa los archivos en el navegador; no se conecta directamente al
cohete ni adquiere datos de sensores por sí sola. El CSV debe ser generado por el
sistema de telemetría o por el registrador del vuelo.

## Iniciar la aplicación

Requiere Node.js y npm.

```bash
npm install
npm run dev
```

Para comprobar la versión de producción:

```bash
npm run build
npm run preview
```

## Toma de datos y formato CSV

1. Configura el registrador de vuelo para guardar una fila por muestra de
   telemetría, con los valores de sensores, el estado del vuelo y un número de
   secuencia.
2. Exporta el registro como CSV UTF-8. La primera fila debe contener los nombres
   de columnas que se muestran abajo. Se aceptan separadores reconocidos por
   Papa Parse (por ejemplo, coma o punto y coma); los campos de texto que
   contengan el separador deben ir entre comillas.
3. Usa unidades consistentes: milisegundos para `t_ms`, metros para `alt_m`,
   `g` para aceleración y grados por segundo para giroscopio. `vbat` se interpreta
   en voltios.
4. En el dashboard, selecciona una carpeta de archivo y luego carga o arrastra
   el CSV. La carpeta se solicita mediante el navegador y la aplicación crea
   dentro una subcarpeta `AAAA-MM-DD` para cada fecha de telemetría.
5. Abre **01 / Expediciones pasadas** para ver los CSV archivados. Al abrir una
   expedición se vuelve a analizar el archivo guardado.

La carpeta elegida y su permiso dependen del navegador. Se requiere un navegador
que implemente File System Access API (por ejemplo, Chrome o Edge en un contexto
seguro, como `localhost`). El acceso se puede volver a solicitar si el permiso
expira o se revoca.

### Columnas

Estas columnas numéricas son obligatorias. El orden puede variar; los encabezados
deben coincidir exactamente.

| Columna | Tipo esperado | Unidad / uso |
| --- | --- | --- |
| `t_ms` | Número | Tiempo de la muestra en milisegundos. Ordena el registro y define el tiempo relativo. |
| `seq` | Entero | Secuencia de paquete, usada para detectar pérdidas y duplicados. |
| `estado` | Entero | Código de fase de vuelo. |
| `alt_m` | Número | Altitud en metros. |
| `ax`, `ay`, `az` | Números | Componentes de aceleración en `g`. |
| `gx`, `gy`, `gz` | Números | Componentes de velocidad angular en °/s. |
| `flags` | Entero | Máscara de bits de alertas del registrador. |
| `vbat` | Número | Voltaje de batería en V. |
| `hora_pc` | Texto, opcional | Fecha/hora de registro mostrada en el resumen. |

El archivo debe tener al menos dos filas válidas. Las filas con cantidad incorrecta
de campos o valores numéricos no válidos se omiten; se informa cuántas se
omitieron. Errores estructurales del CSV o columnas requeridas ausentes producen
un mensaje de error.

Ejemplo mínimo:

```csv
t_ms,seq,hora_pc,estado,alt_m,ax,ay,az,gx,gy,gz,flags,vbat
1000,0,2026-11-07T14:00:00,0,0,0,0,1,0,0,0,0,3.8
1040,1,2026-11-07T14:00:00,0,0,0,0,1,0,0,0,0,3.8
```

### Estados y flags

Los códigos de fase que el dashboard reconoce son:

| Código | Fase |
| ---: | --- |
| 0 | ARMADO |
| 1 | LISTO |
| 2 | IMPULSO |
| 3 | ASCENSO |
| 4 | APOGEO |
| 5 | DESCENSO |
| 6 | ATERRIZADO |

Los flags se interpretan como bits: `1` acelerómetro saturado (16 g), `2`
impacto, `4` falla de sensor y `8` paracaídas abierto. Si varios bits están
activos, la tabla muestra sus significados combinados. Otros códigos de estado
se etiquetan como desconocidos; otros bits no tienen descripción configurada.

## Qué muestra Resumen

El tiempo relativo `t` se calcula ordenando las filas por `t_ms` y restando a cada
muestra el menor `t_ms`: `t = (t_ms − t_ms inicial) / 1000`. Así, las gráficas y
los tiempos de fase comienzan en cero.

### Resumen de vuelo

| Indicador | Cálculo |
| --- | --- |
| Duración de captura | Tiempo relativo de la última muestra. |
| Muestras recibidas | Número de filas válidas. |
| Altitud máxima | Máximo `alt_m` del archivo; se toma esa fila como apogeo. |
| Instante del apogeo | Tiempo relativo de la fila con altitud máxima. |
| Aceleración máxima | Máximo de `√(ax² + ay² + az²)`, en g. |
| Giro máximo | Máximo de `√(gx² + gy² + gz²)`, en °/s. |
| Paquetes perdidos | Porcentaje `perdidos / esperados × 100`, donde `esperados = seq máxima − seq mínima + 1`; recibidos para este cálculo son las secuencias únicas. |
| Intervalo medio | Media de las diferencias entre `t_ms` de filas ordenadas consecutivamente, en ms. |

La línea de cobertura muestra `hora_pc` de la primera muestra, secuencias
esperadas y únicas recibidas. Si hay filas repetidas por secuencia, también muestra
el número de duplicados. La cantidad de muestras recibidas, en cambio, cuenta
todas las filas válidas, incluidos duplicados.

### Fases y gráficas

- **Fases de vuelo:** agrupa tramos consecutivos con el mismo `estado`. Para cada
  tramo muestra su inicio, fin, duración (`fin − inicio`) y cantidad de filas.
- **Altitud:** `alt_m` a lo largo del tiempo relativo.
- **Aceleración:** magnitud total `√(ax² + ay² + az²)` y componente `az`.
- **Giroscopio:** componentes `gx`, `gy` y `gz`.
- Las gráficas reducen el número de puntos a aproximadamente 1.500 como máximo
  para mantener una visualización fluida; conservan el último punto.

## Qué muestra Arreglos

La pestaña **Arreglos** prepara un subconjunto para estudiar el lanzamiento y el
vuelo sin las fases de espera en tierra:

- conserva filas con `estado` **2 a 6**: IMPULSO, ASCENSO, APOGEO, DESCENSO y
  ATERRIZADO;
- excluye ARMADO, LISTO y cualquier estado no incluido en ese rango;
- informa el total original, las filas de vuelo conservadas y las filas
  excluidas;
- muestra cuántas muestras conservadas corresponden a cada estado;
- reinicia el eje temporal de sus gráficas a cero en la primera muestra
  conservada, e indica el tiempo T+ de esa muestra en la captura original;
- presenta altitud y aceleración (`√(ax² + ay² + az²)` y `az`) únicamente para el
  subconjunto de vuelo.

Este paso es un **recorte por estado**, no una eliminación ni una corrección del
ruido de los sensores. No modifica ni suaviza las mediciones, no quita outliers y
no interpola huecos: así se preservan las muestras observadas.

### Modelo de altitud

La vista superpone las muestras de altitud desde la primera muestra `ASCENSO`
hasta el final del vuelo registrado con la parábola de lanzamiento vertical:

```text
y(t) = y₀ + v₀ᵧ t − ½ g t²
v₀ᵧ = (y_apogeo − y₀ + ½ g t²) / t
```

`y₀` y el tiempo cero corresponden a la primera muestra `ASCENSO`. `v₀ᵧ` se
calcula usando esa muestra y la de máxima altitud como extremos. Se usa
`g = 9,81 m/s²`. La parábola se prolonga después del apogeo para mostrar el
descenso teórico junto a las muestras reales. Por construcción coincide con las
alturas de inicio y apogeo; no es una regresión estadística de todos los puntos.
El modelo ideal no incluye resistencia del aire ni despliegue de paracaídas, por
lo que es esperable que su predicción de descenso se separe de la trayectoria
medida, especialmente después de abrir el paracaídas.

### Velocidad aproximada integrada desde aceleración

Bajo la gráfica de aceleración se muestra una hipótesis de velocidad vertical:

1. Se inicializa en la `v₀ᵧ` obtenida con el modelo de altitud al comienzo de
   `ASCENSO`.
2. Se usa la componente **firmada** `az`, no la magnitud
   `√(ax² + ay² + az²)`, porque una magnitud no indica dirección vertical.
3. Como `az` está en g y representa aceleración específica del acelerómetro, se
   resta la media de `az` durante ARMADO y se corrige el signo según la
   orientación indicada por ese reposo:

   ```text
   a_vertical ≈ (az − media_az_ARMADO) × signo(media_az_ARMADO) × 9,81
   ```

   La estimación requiere que `|media_az_ARMADO| ≥ 0,25 g`; este umbral solo
   comprueba que exista una referencia de orientación suficientemente clara, no
   demuestra que el eje Z esté exactamente vertical.
4. Se integra desde la primera muestra `ASCENSO` con la regla trapezoidal:

   ```text
   vᵢ = vᵢ₋₁ + (aᵢ₋₁ + aᵢ) / 2 × (tᵢ − tᵢ₋₁)
   ```

Es una estimación, no velocidad medida. Supone que el eje Z se mantiene alineado
con la vertical y que la referencia ARMADO permite compensar la gravedad. Una
rotación del cohete, inclinación inicial, deriva del sensor, vibración o pérdidas
de muestras pueden hacer que la curva se aparte mucho de la velocidad real. Si
falta referencia ARMADO clara o un tramo ASCENSO válido, no se dibuja la
estimación. No se aplica filtrado adicional ni se procesa el giroscopio.

## Qué muestra Análisis

### Calidad de datos

- **Paquetes perdidos:** `max(0, esperados − secuencias únicas recibidas)`.
- **Intervalo de muestreo:** mínimo, máximo y media de diferencias de `t_ms` entre
  filas cronológicamente consecutivas.
- **Voltaje de batería:** mínimo y máximo de `vbat`. Si la diferencia entre ambos
  es menor a `0,01 V`, se marca para revisión como prácticamente constante.
- **Flags:** cuenta filas por valor exacto de la máscara y describe los bits
  conocidos.
- **Limitaciones detectadas:** se señala si la última muestra no está en estado
  ATERRIZADO, si `vbat` es casi constante, si el módulo de la aceleración media
  de reposo se desvía más de `0,1 g` de `1 g`, o si faltan secuencias. Son
  indicadores heurísticos, no diagnósticos del hardware.

### Altura durante el vuelo

- Altura e instante del apogeo: máximo de `alt_m` y tiempo de esa muestra.
- Inicio del ascenso y tiempo de ascenso: primera fase `ASCENSO` y diferencia
  entre ese tiempo y el tiempo del apogeo.
- Velocidad media de descenso: `(altura del apogeo − altura de la última muestra)
  / (tiempo de la última muestra − tiempo del apogeo)`. Se muestra como magnitud
  positiva hacia abajo; si no hay tiempo de descenso, aparece `—`.

### Aceleración durante despegue

Usa las filas con estado `IMPULSO` y la magnitud `√(ax² + ay² + az²)`:

- inicio: tiempo de la primera muestra de impulso;
- duración: tiempo de la última menos el de la primera;
- pico y tiempo del pico durante impulso;
- media de la magnitud durante impulso;
- pico global de aceleración y estado de vuelo correspondiente.

Si no hay muestras `IMPULSO`, el módulo lo indica.

### Velocidad en ascenso: dos cálculos independientes

Ambos módulos usan como intervalo la primera muestra en estado `ASCENSO` y la
muestra de altitud máxima (`APOGEO`). El tiempo `t` es la diferencia entre sus
tiempos relativos.

1. **Velocidad inicial de lanzamiento vertical.** Despeja directamente `v₀` de
   `h_f = h_0 + v_0 t − ½ g t²`:

   ```text
   v₀ = (h_f − h_0 + ½ g t²) / t
   ```

   Usa `g = 9,81 m/s²`, positivo como magnitud; la aceleración vertical es `−g`
   porque se toma la altura positiva hacia arriba. Supone aceleración constante,
   sin resistencia del aire. Es una estimación del tramo registrado entre el
   inicio de ASCENSO y el apogeo; si el motor todavía aporta empuje en ese tramo,
   el supuesto de caída/lanzamiento balístico no representa la dinámica real.
   No equivale necesariamente a la velocidad al encender el motor.

2. **Velocidad promedio.** Se calcula por separado, sin usar la gravedad:

   ```text
   v_promedio = (h_f − h_0) / t
   ```

   Es el desplazamiento vertical neto dividido por el tiempo transcurrido. Con
   altura positiva hacia arriba, un resultado positivo representa ascenso.

Ambos módulos muestran las alturas inicial y final y el tiempo empleados. Si no
hay una muestra de ASCENSO o el tiempo hasta el apogeo no es positivo, el
resultado no se calcula.

### Calibración en reposo y giroscopio

- **Calibración en reposo:** media, mínimo y máximo de `ax`, `ay` y `az` usando
  las muestras con estado `ARMADO` (`estado = 0`). Si no las hay, se informa.
- **Giroscopio durante ascenso:** máximos de `|gx|`, `|gy|`, `|gz|` y de
  `√(gx² + gy² + gz²)` en muestras `ASCENSO`. Si no hay muestras, se informa.

## Archivo de expediciones

La aplicación pide permiso para una carpeta elegida por el usuario. Guarda una
copia sin modificar del CSV en una subcarpeta `AAAA-MM-DD`. La fecha se toma,
por orden, de:

1. Un patrón `YYYYMMDD`, opcionalmente seguido por hora `HHMMSS`, en el nombre
   del archivo (por ejemplo, `vuelo_20261028_071322.csv`).
2. La fecha/hora de `hora_pc` en la primera fila del CSV.
3. La fecha de última modificación del archivo, si no hay fecha de telemetría.

Si ya existe un archivo con el mismo nombre en esa carpeta, se añade un sufijo
como `__2` para no sobrescribirlo. El historial busca archivos CSV en las
subcarpetas directas de la carpeta elegida y muestra la fecha extraída, carpeta
y tamaño. Al seleccionar **ABRIR**, vuelve a parsear y analizar el CSV guardado.

## Alcance e interpretación

Los resultados dependen de la calidad, las unidades y la calibración del CSV. El
dashboard no corrige offsets de sensores, no interpola paquetes perdidos y no
estima resistencia aerodinámica. Las velocidades verticales calculadas a partir
de la altitud no sustituyen una medición directa de velocidad ni una validación
del sistema de navegación.

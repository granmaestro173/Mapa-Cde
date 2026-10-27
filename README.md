# Mapa Ciudadano CDE: guía para publicarlo

Esta guía es para dejar el mapa funcionando en internet **sin pagar nada**. Lleva unos 20 a 30 minutos. No hace falta saber programar: son pasos de copiar, pegar y tocar botones.

Vas a usar tres servicios gratuitos:

| Servicio | Para qué | Costo |
|---|---|---|
| **Supabase** | Guarda las denuncias, las fotos y las cuentas, y avisa en tiempo real | Gratis |
| **GitHub** | Guarda los archivos de la página | Gratis |
| **Vercel** | Publica la página en una dirección como `mapa-cde.vercel.app` | Gratis |
| Anthropic (opcional) | El botón "Explicar con IA" | Centavos de dólar por mes, con el tope que vos elijas |

> **¿Querés verla antes de configurar nada?** Abrí `index.html` con un servidor local (`npm run local`) o subila tal cual a Vercel. Sin datos de Supabase, la página arranca en **modo de prueba**: muestra los datos de ejemplo, deja entrar como "municipalidad (prueba)" y no guarda nada.

---

## Qué hay en la carpeta

```
index.html            la página (diseño minimalista, mapa satelital)
app.js                todo lo que hace la página
store.js              la conexión con Supabase (y el modo de prueba)
config.js             ← acá pegás los 2 datos de tu Supabase
datos-ejemplo.json    datos del modo de prueba
sat-lite.jpg, sat-hd.jpg   imagen satelital de respaldo si Esri no responde
vendor/               Leaflet (mapa) y Supabase, incluidos para no depender de otros sitios
api/ia.js             función del servidor para "Explicar con IA" (la clave nunca llega al navegador)
supabase/01-esquema.sql         tablas, reglas de seguridad, fotos e historial
supabase/02-datos-ejemplo.sql   145 denuncias y 10 obras de ejemplo para el jurado
supabase/03-borrar-ejemplos.sql para sacar los ejemplos cuando pase a uso real
scripts/generar-ejemplos.mjs    regenera los datos de ejemplo (opcional)
```

---

## Paso 1 · Crear la base de datos en Supabase (10 min)

1. Entrá a **[supabase.com](https://supabase.com)** → *Start your project* → registrate con GitHub o con tu email.
2. Tocá **New project**:
   - *Name*: `mapa-cde`
   - *Database Password*: inventá una y guardala (no la vas a usar en la página).
   - *Region*: **South America (São Paulo)**, la más cercana a Ciudad del Este.
   - Plan **Free**. Tocá *Create new project* y esperá 1 o 2 minutos.
3. En el menú de la izquierda abrí **SQL Editor** → *New query*.
   - Abrí `supabase/01-esquema.sql`, copiá **todo**, pegalo y tocá **Run**. Tiene que decir *Success. No rows returned*.
   - Hacé otra *New query* con `supabase/02-datos-ejemplo.sql` y tocá **Run**. Así cargás los datos de ejemplo para la presentación.
4. Dejá que los vecinos denuncien sin registrarse: **Authentication → Sign In / Providers** (en algunos paneles figura como *Providers* o *Settings*) → activá **Allow anonymous sign-ins** → *Save*.
   - Si preferís que todos se registren, dejalo apagado: la página le va a pedir el email a quien quiera denunciar.
5. Copiá tus dos datos: **Project Settings → Data API** (o *API*):
   - **Project URL**, por ejemplo `https://abcdefghijk.supabase.co`
   - **anon public key** (o *publishable key*), una clave larga.
6. Abrí `config.js` y pegalos entre las comillas:

```js
window.CDE_CONFIG = {
  supabaseUrl: "https://abcdefghijk.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
  google: false,
  ia: true,
  originales: true
};
```

> Esa clave es **pública** a propósito: va dentro de la página. Lo que protege los datos son las reglas del paso 3 (por ejemplo, un vecino no puede marcar su denuncia como resuelta ni borrar nada). **Nunca** pegues en `config.js` la clave `service_role` / *secret*.

---

## Paso 2 · Subir la página a GitHub y publicarla en Vercel (10 min)

1. Entrá a **[github.com](https://github.com)**, creá una cuenta si no tenés y tocá **New repository**:
   - *Repository name*: `mapa-cde`, *Public*. Tocá *Create repository*.
2. En el repositorio nuevo tocá **uploading an existing file** y **arrastrá todo el contenido de esta carpeta**, incluidas las carpetas `api`, `vendor`, `supabase` y `scripts`. Tocá **Commit changes**.
3. Entrá a **[vercel.com](https://vercel.com)** → *Sign Up* → **Continue with GitHub**. Elegí el plan **Hobby** (gratis).
4. Tocá **Add New… → Project**, buscá `mapa-cde` y tocá **Import**.
   - *Framework Preset*: **Other**. No cambies nada más.
   - Tocá **Deploy**. En menos de un minuto te da la dirección, por ejemplo `https://mapa-cde.vercel.app`.
5. Volvé a Supabase → **Authentication → URL Configuration**:
   - *Site URL*: tu dirección de Vercel (`https://mapa-cde.vercel.app`).
   - *Redirect URLs*: agregá la misma dirección con `/**` al final (`https://mapa-cde.vercel.app/**`). Así funcionan los enlaces para ingresar por email.

¡Listo! Abrí la dirección en el celular: tenés que ver "En vivo" arriba y las denuncias de ejemplo.

> **Para cambiar algo después:** editá el archivo en GitHub (el lápiz) y guardá. Vercel publica la versión nueva solo, en unos segundos.

---

## Paso 3 · Darte permisos de municipalidad (3 min)

Los roles son: **vecino** (todos), **moderador** (verifica o descarta denuncias falsas) y **municipal** (además cambia estados, carga obras y ajusta precios).

### Opción A, recomendada: usuario con contraseña

Por defecto, Supabase solo manda correos a los miembros de tu cuenta y como mucho unos pocos por hora ([detalle](https://supabase.com/docs/guides/auth/auth-smtp)). Para la municipalidad conviene crear usuarios con contraseña:

1. Supabase → **Authentication → Users → Add user → Create new user**: email, contraseña y tildá *Auto Confirm User*.
2. **SQL Editor**, cambiando el email y el nombre:

```sql
update public.perfiles
   set rol = 'municipal', nombre = 'Dirección de Obras Públicas'
 where id = (select id from auth.users where email = 'obras@ejemplo.com');
```

   Para un moderador, usá `rol = 'moderador'`.
3. En el mapa: menú ☰ → **Ingresar** → email y contraseña → **Entrar**. Ya ves los botones de moderación y el panel municipal habilitado.

### Opción B: enlace por email

Escribí solo el email en **Ingresar** y tocá el enlace que te llega. Con la configuración básica de Supabase funciona para los emails de los miembros de tu cuenta de Supabase. Para cualquier email, configurá un SMTP gratuito (Brevo o Resend) en **Authentication → Emails → SMTP Settings**. Después ejecutá el mismo `update` de arriba.

### Opción C: Google (opcional)

Supabase → **Authentication → Sign In / Providers → Google** te explica cómo crear el "Client ID" en Google Cloud. Cuando esté activo, poné `google: true` en `config.js`.

---

## Paso 4 · "Explicar con IA" (opcional, 5 min)

Sin este paso todo funciona igual: la zona de riesgo y el informe se calculan solos. Con la IA, Claude Haiku los explica con sus palabras.

1. Entrá a **[console.anthropic.com](https://console.anthropic.com)**, creá la cuenta y cargá crédito (el mínimo alcanza para meses de demo).
2. **Settings → Limits**: poné un **tope de gasto mensual**, por ejemplo USD 5. Es lo que garantiza que nunca gastes de más.
3. **API Keys → Create Key**: copiala.
4. Vercel → tu proyecto → **Settings → Environment Variables**. Agregá:
   - `ANTHROPIC_API_KEY` = la clave de Anthropic
   - `SUPABASE_URL` = la misma URL de `config.js`
   - `SUPABASE_ANON_KEY` = la misma clave pública de `config.js`
   - Opcional: `IA_LIMITE_HORA` = `20`, las consultas por persona por hora.
5. **Deployments** → los tres puntitos del último → **Redeploy**.

En el mapa, activá *Mapa de riesgo*, tocá una zona naranja o roja y vas a ver **✦ Explicar con IA**. En *Estadísticas*, el informe pasa a decir "Redactado por Claude". Cada consulta cuesta una fracción de centavo.

---

## Antes de usarlo de verdad

- **Sacar los datos de ejemplo:** ejecutá `supabase/03-borrar-ejemplos.sql` en el SQL Editor. También podés ocultarlos sin borrarlos con *Capas → Datos de ejemplo*.
- **El plan gratis de Supabase se pausa tras 7 días sin uso.** Si el mapa no se abre durante una semana, entrá a Supabase y tocá *Restore project* (los datos no se pierden). **Abrilo unos días antes de la presentación.** ([precios y límites](https://supabase.com/pricing))
- **Límites gratis:** 500 MB de base (cientos de miles de denuncias), 1 GB de fotos y 2 proyectos. La copia liviana pesa unos 150 KB, pero el original de un celular ronda los 3 MB: con originales entran unas 300 denuncias con foto, y sin ellos unas 6.000. Si se llena, poné `originales: false` en `config.js` para guardar solo la copia liviana.
- **Vercel Hobby** es para proyectos no comerciales; una demo universitaria entra perfecto.
- **Imágenes satelitales:** se cargan de Esri World Imagery con su atribución. Si Esri no responde, la página usa sola la imagen incluida.

---

## Cómo está protegido

- Cualquiera puede **ver** las denuncias, obras, precios e historial: es un mapa de transparencia.
- Un vecino solo puede **crear** denuncias: la base fuerza que nazcan como "Recibida", sin votos ni marcas, con un tope de 10 por hora por persona.
- "Yo también lo vi" y "Parece falsa" valen **uno por persona**, aunque se borre el navegador.
- Las fotos: la **copia liviana** es pública; el **original** queda en un almacén privado que solo abre la moderación con un enlace que vence en 10 minutos. Solo el autor de la denuncia puede subir su foto, y una sola vez.
- Las denuncias marcadas como **falsas** desaparecen para el público, pero la moderación las sigue viendo.
- El **historial** lo escribe la base sola (estados, moderación, obras, precios), con huella SHA-256 encadenada. Desde la página nadie puede editarlo ni borrarlo, y el botón **Verificar integridad** comprueba toda la cadena.
- La clave de la IA vive solo en Vercel, la función exige una sesión del mapa y tiene un tope de consultas por persona.

---

## Preguntas frecuentes

**Dice "Modo de prueba" en vez de "En vivo".** Falta completar `config.js` o quedó mal pegado. Fijate que la URL empiece con `https://` y que la clave esté completa, entre comillas.

**Al denunciar dice "Para participar, ingresá con tu email".** Falta activar *Allow anonymous sign-ins* (paso 1.4).

**Ingresé pero no veo los botones de la municipalidad.** Falta el `update ... set rol = 'municipal'` del paso 3, o el email no coincide. Después de ejecutarlo, recargá la página.

**El enlace del email no llega.** Mirá en spam y revisá el paso 3, opción B. Para el equipo municipal usá la opción A, con contraseña.

**Quiero otro nombre de dirección.** Vercel → *Settings → Domains*: podés cambiar el `.vercel.app` gratis o conectar un dominio propio.

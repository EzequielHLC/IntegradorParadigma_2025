# Guía rápida para lanzar el proyecto

![Alt text](/MD/1699039998-107579-hamster-dance.gif "Optional Title")

---

## Comanditos necesarios

La secuencia paso a paso que vamos a usar para hacer funcionar esta cosa :D

![Alt text](/MD/cat-dynamic-programming.gif "Optional Title")

---

### Paso 1: Crear el proyecto

```bash
npm create vite@latest proyecto_final_paradigma -- --template react
```

1. Seleccionar la Opción `React`
2. Seleccionar la Opción `JavaScript + SWC`
3. Le dan que si a `install npm`
4. Se mueven a la carpeta creada

![Alt text](/MD/giphy.webp "Optional Title")

---

### Paso 2: Instalarle los extras del BASEDEFUEGO

```bash
npm install firebase lucide-react
```

Acá solo hay que esperar a que se termine de instalar. No es tan dificil loco...

![Alt text](/MD/291c5593304891ff1607d696f9f3b7a6-1.gif "Optional Title")

---

### Paso 3: Instalar lo necesario para que funcione el CSS y se vea lindo y por ende no parezca una página web de los años 80 creada por un ingeniero de software al que le pagaban muy poco y por ende pocas ganas de laburar tenia y que al final cayo en depresion y antes de dejar su laburo creo esta pagina como vengaza y su espiritu ronda para atormentar a cualquiera que entre a este dominio

![Alt text](/MD/meme-gif-pfp-19.gif "Optional Title")

```bash
npm install -D tailwindcss postcss autoprefixer
```

```bash
npm install -D @tailwindcss/postcss
```

Después, tienen que crear dos archivos en la raíz llamados `postcss.config.js` y `tailwind.config.js`

Dentro del archivo de `postcss.config.js` pegar el siguiente código:

```bash
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

Dentro del archivo de `tailwind.config.js` pegar el siguiente código:

```bash
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Y finalmente solo queda actualizar los archivos `App.css` e `index.css`, donde tienen que pegar este mismo código en ambos archivos:

```bash
@import "tailwindcss";
```

![Alt text](/MD/O39E2ml.gif "Optional Title")

---

Y con esto y un bizcocho (Ahre, se hacía el españolete) hemos acabado.

Teóricamente debería funcionar, y si no...

![Alt text](/MD/f20ba584b9f2a9d1c2360273f62181e0.jpg "Optional Title")

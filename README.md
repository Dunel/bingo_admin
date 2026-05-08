# Documentacion - IA Administracion de Bingo

Proyecto para administrar usuarios y cartas de bingo.

## Objetivo

Construir un panel de administracion donde un usuario:

1. Inicia sesion.
2. Registra su carta subiendo una imagen en formato `jpg`, `jpeg` o `png`.
3. Genera automaticamente la carta a partir de la imagen.
4. Llena la carta por medio de un input de numeros cantados.

## Alcance Funcional

### 1) Login de usuarios

- Formulario con email/usuario y contrasena.
- Validacion de campos obligatorios.
- Manejo de errores comunes:
	- Credenciales invalidas.
	- Usuario inactivo.
	- Sesion expirada.
- Redireccion al panel principal al autenticar correctamente.

### 2) Registro de carta por imagen

- El usuario puede cargar un archivo de imagen.
- Tipos permitidos: `image/jpeg`, `image/jpg`, `image/png`.
- Restricciones recomendadas:
	- Tamano maximo: 5 MB.
	- Una carta por carga.
	- Rechazar formatos distintos.
- Vista previa de la imagen antes de procesar.

### 3) Generacion de carta desde imagen (IA)

- El sistema procesa la imagen y detecta la estructura de la carta.
- Se extraen los numeros por casilla.
- Se construye una representacion estructurada de la carta (matriz/tabla).
- Se muestra la carta generada para confirmacion del usuario.
- Si la IA falla en alguna casilla, permitir correccion manual.

### 4) Llenado de carta por numero

- Input para escribir el numero cantado.
- Al enviar el numero:
	- Se busca en la carta.
	- Si existe, se marca la casilla correspondiente.
	- Si no existe, se notifica al usuario.
- Validaciones del input:
	- Solo numeros enteros.
	- Rango definido por reglas del bingo (ejemplo: 1 a 75).
	- Evitar marcar dos veces el mismo numero.

## Requerimientos Funcionales (RF)

- RF-01: El sistema debe autenticar usuarios mediante login.
- RF-02: El sistema debe permitir subir imagenes `jpg`, `jpeg` o `png`.
- RF-03: El sistema debe rechazar archivos no validos.
- RF-04: El sistema debe generar una carta digital desde la imagen cargada.
- RF-05: El sistema debe permitir editar manualmente resultados detectados por IA.
- RF-06: El sistema debe aceptar numeros cantados y marcar coincidencias en la carta.
- RF-07: El sistema debe mantener estado de casillas marcadas durante la sesion.

## Requerimientos No Funcionales (RNF)

- RNF-01: Interfaz clara para desktop y movil.
- RNF-02: Tiempo de respuesta de marcado menor a 1 segundo en condiciones normales.
- RNF-03: Seguridad basica de autenticacion y manejo de sesion.
- RNF-04: Mensajes de error entendibles para el usuario final.

## Flujo de Usuario

1. Usuario abre la app.
2. Usuario inicia sesion.
3. Usuario entra al modulo "Registrar carta".
4. Usuario sube imagen `jpg`, `jpeg` o `png`.
5. IA procesa imagen y genera la carta.
6. Usuario confirma o corrige la carta generada.
7. Usuario ingresa numeros cantados en el input.
8. Sistema marca numeros en la carta en tiempo real.

## Estructura de Datos Sugerida

```ts
type BingoCell = {
	value: number | null;
	marked: boolean;
};

type BingoCard = {
	id: string;
	userId: string;
	grid: BingoCell[][];
	sourceImageUrl: string;
	createdAt: string;
};
```

## API Sugerida

- `POST /api/auth/login`
	- Entrada: credenciales.
	- Salida: sesion/token.

- `POST /api/cards/upload`
	- Entrada: archivo de imagen.
	- Salida: URL temporal de la imagen.

- `POST /api/cards/generate`
	- Entrada: referencia de imagen subida.
	- Salida: carta estructurada detectada por IA.

- `POST /api/cards/:id/mark-number`
	- Entrada: numero cantado.
	- Salida: carta actualizada con marcas.

## Criterios de Aceptacion

- CA-01: Si el usuario sube un `png`, la imagen se acepta y se procesa.
- CA-02: Si el usuario sube un `pdf`, el sistema rechaza con mensaje claro.
- CA-03: Al ingresar un numero existente en la carta, la casilla queda marcada.
- CA-04: Al ingresar un numero inexistente, se informa "numero no encontrado".
- CA-05: Si la deteccion de IA es incompleta, el usuario puede corregirla y guardar.

## Puesta en marcha del proyecto

Instalar dependencias:

```bash
npm install
```

Iniciar entorno de desarrollo:

```bash
npm run dev
```

Abrir en navegador:

- `http://localhost:3000`

## Configuracion inicial de Prisma con PostgreSQL

Este proyecto usa Prisma como ORM para conectarse a PostgreSQL.

### 1) Configurar variable de entorno

En el archivo `.env`, define la conexion real de tu base de datos:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/bingo_admin?schema=public"
```

### 2) Generar Prisma Client

```bash
npm run prisma:generate
```

### 3) Aplicar esquema en desarrollo

Si ya tienes modelos en `prisma/schema.prisma`, puedes usar:

```bash
npm run prisma:migrate -- --name init
```

o para sincronizar rapido sin migracion:

```bash
npm run prisma:push
```

### 4) Abrir Prisma Studio (opcional)

```bash
npm run prisma:studio
```

### 5) Uso del cliente Prisma en el proyecto

Se creo un cliente reutilizable en `src/lib/prisma.ts` para evitar multiples conexiones en desarrollo.

## Estado actual

Este repositorio contiene la base del proyecto con Next.js.
La documentacion define el comportamiento esperado para implementar el modulo de administracion de bingo con IA.

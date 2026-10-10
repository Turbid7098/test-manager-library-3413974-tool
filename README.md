# test-manager-library-3413974-tool

> **Prueba técnica · Ficha ADSO 3413974**
> Horario: de **9:15 a. m. a 3:00 p. m.** (15:00). Después, **feria de presentación** de cada proyecto.

Este repositorio guarda las **utilidades** de *Manager Library*: el sembrador de datos de demostración, que usa la API. **Empieza vacío a propósito**: se construye en el fork de cada aprendiz.

## Instrucciones

Cada aprendiz debe **crear el fork** de los seis repositorios del proyecto y **resolver el proyecto
con el spec planteado**.

1. Hacer fork, a su cuenta de GitHub, de cada repositorio de la tabla del final.
2. Leer el spec en [`test-manager-library-3413974-docs`](https://github.com/code-sena/test-manager-library-3413974-docs).
   Se entrega en dos versiones: `spec-python/` y `spec-.net/`.
3. Desarrollar en los forks.

## El reto se desarrolla con React y PHP (Laravel)

El spec está escrito para Python y para .NET, pero el reto **no** se hace en esos lenguajes:

| Capa | Tecnología del reto |
|---|---|
| Frontend | React |
| Backend | PHP con Laravel |

Lo que el spec define sobre el negocio —historias, criterios de aceptación, reglas, contrato de la
API, modelo de datos— se respeta. Lo que define sobre la tecnología se traduce a React y Laravel.

## La prueba no consiste en escribir el código

El propósito principal es ver la **capacidad de desempeño con SDD** (*Spec-Driven Development*,
desarrollo guiado por especificación): cómo se lee, se interpreta y se aplica una especificación
para llevarla a un stack distinto. El código es el medio, no el fin.

## Feria de presentación

Al cerrar la prueba (3:00 p. m.) cada aprendiz **presenta su proyecto** al grupo: qué construyó del spec, qué dejó fuera y por qué,
y una demostración corta de lo que funciona (la aplicación y el sitio público). Lo que se presenta es lo que quedó **subido a los forks
antes de las 3:00 p. m.**: no se presenta nada que no esté en GitHub.

## Los seis repositorios

| Repositorio | Qué va ahí |
|---|---|
| [`test-manager-library-3413974-docs`](https://github.com/code-sena/test-manager-library-3413974-docs) | El spec: `spec-python/` y `spec-.net/` |
| [`test-manager-library-3413974-api`](https://github.com/code-sena/test-manager-library-3413974-api) | Backend en PHP (Laravel) |
| [`test-manager-library-3413974-app`](https://github.com/code-sena/test-manager-library-3413974-app) | Frontend en React |
| [`test-manager-library-3413974-page`](https://github.com/code-sena/test-manager-library-3413974-page) | Sitio público estático de presentación |
| [`test-manager-library-3413974-infra`](https://github.com/code-sena/test-manager-library-3413974-infra) | Contenedores, red, volúmenes y motor de base de datos vacío |
| [`test-manager-library-3413974-tool`](https://github.com/code-sena/test-manager-library-3413974-tool) | Utilidades: sembrador de datos de demostración |
## Sembrador de demostración

`seed.mjs` crea los datos exclusivamente mediante la API autenticada: 40 libros, 10 socios y 15 préstamos, incluidos 3 vencidos. Requiere Node.js 22 (usa `fetch` nativo, sin dependencias) y una API ya migrada y accesible.

En PowerShell, configura las variables localmente con las credenciales del administrador definidas en el `.env` ignorado de `infra` y ejecuta:

```powershell
$env:API_BASE_URL = 'http://localhost:8000/api/v1/'
$env:ADMIN_USERNAME = '<administrador local>'
$env:ADMIN_PASSWORD = '<contraseña local>'
node .\seed.mjs
```

El proceso usa un identificador aleatorio por ejecución para no colisionar con registros anteriores. Guarda ese `run_id` del mensaje de error para repetir una ejecución interrumpida con `$env:SEED_RUN_ID = '<run_id>'`; libros, socios y préstamos de ese lote se detectan antes de crear nuevos. Las fechas de los tres préstamos vencidos se controlan con `X-Test-Time`; la API solo atiende ese encabezado en solicitudes autenticadas de entornos `local`/`testing`. Las solicitudes normales siguen usando el reloj del sistema. El resultado informa cuántas líneas vencidas del lote aparecen en el endpoint, cuántas filas reporta la API y el progreso en caso de error. No guarda credenciales ni tokens.

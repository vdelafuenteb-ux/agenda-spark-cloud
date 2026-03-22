

## Plan: Subdividir tablas del PDF por departamento, ordenar por responsable

### Qué se hará
En las tres secciones de tablas del PDF (Logros, Activos, Pausados), en vez de una tabla plana, se agrupan los temas por departamento. Cada departamento tiene un subtítulo y su propia tabla. Dentro de cada tabla, los temas se ordenan por responsable. Los temas sin departamento van al final bajo "Sin Departamento".

### Cambios

#### 1. `PdfOptions` — agregar departments
- Agregar `departments?: { id: string; name: string }[]` al interface `PdfOptions`

#### 2. Helper: agrupar y ordenar
- Crear función `groupByDepartment(topics, departments)` que retorna `{ deptName: string, topics: TopicWithSubtasks[] }[]`
- Ordena los grupos alfabéticamente por nombre de departamento
- "Sin Departamento" va al final
- Dentro de cada grupo, ordena por `assignee`

#### 3. Secciones Logros, Activos, Pausados
- Para cada sección, en vez de renderizar una sola `autoTable`, iterar por departamento:
  - Subtítulo con el nombre del departamento (texto `fontSize: 9`, bold, con fondo `PURPLE_100`)
  - Tabla con los temas de ese departamento (mismas columnas que ahora)
  - Espaciado entre departamentos

#### 4. `ReportModal.tsx` — pasar departments
- Importar `useDepartments` y pasar `departments` en las opciones del PDF

### Archivos a modificar
- `src/lib/generateReportPdf.ts` — grouping logic + render por departamento
- `src/components/ReportModal.tsx` — pasar departments a `downloadReportPdf`




## Plan: Agregar selector de Tema (sección) en el editor de notas

### Problema
Dentro del editor de notas solo se puede seleccionar la libreta, pero no el tema/sección dentro de esa libreta. Si la nota está dentro de un libro, no hay forma de asignarle un tema.

### Cambios

#### 1. `NoteEditor.tsx` - Agregar props y selector de sección
- Agregar `sections: NoteSection[]` a las props
- Ampliar el tipo de `onUpdate` para incluir `section_id`
- Después del selector de libreta, agregar un segundo `<Select>` para elegir tema, filtrado por el `notebook_id` actual de la nota
- Si no hay libreta seleccionada, el selector de tema no aparece
- Si se cambia de libreta, resetear el `section_id` a null

#### 2. `NotesView.tsx` - Pasar secciones al editor
- Pasar `sections={sections}` como prop al `NoteEditor`
- Actualizar el `onUpdate` para que también acepte `section_id`

### Archivos a modificar
- **`src/components/NoteEditor.tsx`**: Agregar prop `sections`, selector de tema junto al de libreta
- **`src/components/NotesView.tsx`**: Pasar `sections` como prop al editor


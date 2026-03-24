

## Agregar tema rápido desde el editor de notas

**Problema**: En el selector de "tema" (sección) del editor de notas, solo se pueden elegir temas existentes. No hay forma de crear uno nuevo sin salir del editor.

**Solución**: Agregar una opción "Crear tema..." al final del dropdown de secciones que permita escribir el nombre del nuevo tema inline y crearlo al instante, asignándolo automáticamente a la nota.

### Cambios

**1. `src/components/NoteEditor.tsx`**
- Agregar prop `onCreateSection` al componente para poder crear secciones desde aquí.
- Reemplazar el `Select` de temas por un `Popover` personalizado (o agregar un item especial al final del select) que incluya:
  - Las opciones existentes ("Sin tema", temas del notebook actual).
  - Un separador.
  - Un mini-formulario inline con un `Input` y botón "Crear" para agregar un tema nuevo rápidamente.
- Al crear el tema, llamar `onCreateSection({ notebook_id, name })`, luego asignar el nuevo `section_id` a la nota con `onUpdate`.

**2. `src/components/NotesView.tsx`**
- Pasar la función `createSection` del hook `useNotes()` como prop `onCreateSection` al `NoteEditor`.

### Flujo del usuario
1. Abre el dropdown de tema en la barra superior de la nota.
2. Ve los temas existentes + opción "Crear tema..." al final.
3. Escribe el nombre del nuevo tema y confirma.
4. El tema se crea y se asigna automáticamente a la nota actual.


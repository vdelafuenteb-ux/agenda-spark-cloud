

## Plan: Redimensionado libre y arrastre de imágenes en el editor de notas

### Qué se hará

1. **Resize desde las esquinas**: Al seleccionar una imagen, se renderiza un overlay con 4 handles en las esquinas. El usuario arrastra cualquier handle para cambiar el tamaño libremente (manteniendo proporción).

2. **Arrastrar imagen (mover)**: Al hacer click y arrastrar la imagen (no desde un handle), se puede reposicionar dentro del editor. La imagen se convierte a `position: relative` con offsets, o se reinserta en la posición del cursor más cercana al punto de drop.

### Cambios técnicos

**`src/components/NoteEditor.tsx`**:

- **Overlay de resize**: Cuando una imagen está seleccionada (`resizingImage` state), renderizar un `div` posicionado absolutamente sobre la imagen con 4 handles circulares en las esquinas.
- **Drag-to-resize**: `onMouseDown` en un handle inicia tracking. En `mousemove`, calcula el nuevo ancho basado en delta del mouse, mantiene aspect ratio, y aplica `style.width` a la imagen. En `mouseup`, detiene y guarda.
- **Drag-to-move**: `onMouseDown` directamente en la imagen (no en handle) permite arrastrarla. Al soltar, se usa `document.caretRangeFromPoint` para encontrar la posición más cercana en el editor y reinsertar la imagen ahí.
- **Eliminar barra de resize fija** (25/50/75/100%) y reemplazarla por los handles visuales directamente sobre la imagen.
- **CSS**: Agregar estilos para los handles (círculos pequeños en esquinas, cursor `nwse-resize` etc.) y cursor `move` en la imagen seleccionada.

### Flujo del usuario
1. Click en imagen → aparecen 4 puntos en las esquinas + borde azul.
2. Arrastrar un punto → la imagen cambia de tamaño en tiempo real.
3. Click y arrastrar la imagen → se mueve a donde se suelte dentro del texto.
4. Click fuera → se deselecciona.


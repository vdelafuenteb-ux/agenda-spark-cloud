

## Plan: Botón "Guardar comentario" por tema + indicador visual verde

### Cambio

En `src/pages/UpdateTopics.tsx`:

1. **Nuevo estado `savedTopics`** (`Set<string>`) para rastrear qué temas tienen comentario guardado
2. **Botón "Guardar comentario"** debajo del textarea de cada tema. Al presionar, agrega el `topic_id` al set `savedTopics`, colapsa el tema, y lo marca visualmente
3. **Indicador verde** en temas guardados: borde verde (`ring-emerald-400`), fondo suave verde en el header, y un icono de check verde junto al titulo
4. **Editable**: al expandir un tema guardado, puede modificar el comentario y volver a guardar. El estado se quita solo si borra todo el comentario
5. **Contador en header**: mostrar "X de Y temas actualizados" para que vea progreso

### Flujo
```text
1. Usuario abre tema → escribe comentario → presiona "Guardar comentario"
2. Tema se colapsa, borde cambia a verde + check ✓ junto al título
3. Puede re-abrir, editar, y guardar de nuevo
4. Al final presiona "Enviar actualización" para enviar todo
```

### Detalle tecnico

- `savedTopics: Set<string>` — se agrega al hacer click en "Guardar"
- Al guardar: si hay comentario o subtasks cambiadas, marca como saved y colapsa
- Card class: si saved → `ring-2 ring-emerald-400 bg-emerald-50/30` en vez del default
- Check icon verde al lado del titulo cuando está saved
- Botón "Guardar" solo habilitado si hay comentario escrito o subtasks modificadas

### Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/pages/UpdateTopics.tsx` | Agregar estado `savedTopics`, botón guardar, indicador verde, contador progreso |


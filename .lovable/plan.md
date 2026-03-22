

## Plan: Limitar bitácora visible a ~4-5 mensajes con scroll tipo chat

### Cambios en `src/components/ProgressLog.tsx`

1. **ScrollArea con altura fija**: Cambiar `max-h-[200px]` a `max-h-[180px]` (aprox 4-5 mensajes visibles) y asegurar que el scroll empiece desde abajo (últimos mensajes visibles primero).

2. **Auto-scroll al fondo**: El `useEffect` con `bottomRef` ya existe — verificar que funcione correctamente para que al abrir siempre se vean los mensajes más recientes (como WhatsApp).

3. **Scroll hacia arriba para ver historial**: El `ScrollArea` ya permite esto nativamente, solo ajustar la altura para que quede compacto.

Cambio mínimo: ajustar el `max-h` del `ScrollArea` y confirmar que el auto-scroll al fondo funciona al montar el componente (no solo cuando cambia `entries.length`).


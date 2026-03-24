
Objetivo: corregir la bitácora para que un mensaje muy largo sí se pueda recorrer completo con scroll interno, tanto en la bitácora principal como en la de cada subtarea.

Qué encontré
- Ambas vistas usan el mismo componente compartido: `src/components/ProgressLog.tsx`.
- Hoy la lista de mensajes está dentro de `ScrollArea` con `className="max-h-[180px]"`.
- El `ScrollArea` compartido (`src/components/ui/scroll-area.tsx`) monta un `Viewport` con `h-full`, o sea funciona mejor cuando el contenedor tiene altura explícita. Con `max-h` + mensajes muy largos, el viewport no queda tan confiable y por eso el scroll interno no siempre aparece o no deja recorrer bien todo el contenido.
- Por eso el problema se replica en los dos lugares: tema principal y subtarea.

Plan de implementación
1. Ajustar `ProgressLog` para que el contenedor de mensajes tenga un viewport de altura real y scroll vertical garantizado.
   - Opción más segura: usar un contenedor nativo con `overflow-y-auto` y una altura definida/limitada.
   - Mantener el alto compacto, pero asegurando que cuando el contenido exceda ese espacio, aparezca scroll siempre.

2. Reemplazar el autoscroll actual basado en `bottomRef.scrollIntoView(...)` por scroll sobre el contenedor mismo.
   - Usar un ref al viewport de mensajes.
   - Al agregar una entrada nueva, mover `scrollTop` al final.
   - Evitar que ese autoscroll interfiera con la lectura manual del usuario.

3. Conservar lo que ya funciona en la bitácora:
   - separadores entre mensajes,
   - edición/eliminación,
   - formato básico (`negrita`, `cursiva`, `viñetas`),
   - timestamps,
   - textarea inferior.

4. Revisar el comportamiento visual para mensajes largos.
   - Asegurar buen wrap de texto dentro del mensaje.
   - Dejar padding derecho suficiente para que el texto no choque con la barra de scroll.
   - Si hace falta, hacer la barra un poco más visible para que se entienda que se puede desplazar.

Archivos a tocar
- `src/components/ProgressLog.tsx` — cambio principal.
- `src/components/ui/scroll-area.tsx` — solo si conviene mejorar el componente compartido; si no, prefiero dejar el arreglo aislado en `ProgressLog` para no arriesgar otros scrolls del sistema.

Validación que haré al implementarlo
- Un solo mensaje muy largo en la bitácora principal.
- Un solo mensaje muy largo en la bitácora de subtarea.
- Varios mensajes cortos para confirmar que sigue autoscrolleando al último.
- Edición de un mensaje largo para comprobar que no rompe el scroll.
- Vista angosta como la de tu captura, para asegurar que funcione también en ese tamaño.

Resultado esperado
- Si un mensaje ocupa más espacio que la ventana de la bitácora, vas a poder desplazarte dentro de la bitácora y ver el mensaje completo sin que quede cortado.
- El arreglo aplicará en ambos lugares porque ambos dependen del mismo componente.

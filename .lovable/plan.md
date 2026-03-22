

## Plan: Rediseñar header de TopicCard — limpio y funcional

### Problema
El header actual muestra demasiados badges en línea (prioridad, sin fecha, seguimiento, responsable, departamento, tags, subtareas alertas) creando un efecto "arcoíris" sobrecargado.

### Propuesta: Layout en dos líneas

Reorganizar la información en dos niveles visuales claros:

```text
Línea 1: 📌 > Título del tema                    0/5  31 mar
Línea 2: 🔴 2 atrasadas · Lucas Beltrami · Transit   [Seguimiento]
```

**Línea 1 (principal):** Pin, chevron, título, progreso (X/Y), fecha.

**Línea 2 (metadata sutil):** Solo lo que aplica, como texto pequeño gris separado por `·`, sin badges coloridos excepto:
- Alertas (atrasadas/hoy) en texto rojo/naranja sin badge
- Responsable como texto simple
- Departamento como texto simple  
- Status solo si no es "activo" (como badge discreto al final)
- "Sin fecha" como texto rojo discreto (sin badge)
- Prioridad: solo mostrar si es Alta o Urgente (como indicador de color en el borde izquierdo, no como badge)
- Tags: puntos de color pequeños en vez de badges con texto

**Se eliminan como badges:** Prioridad Media/Baja, "Continuo", tags con texto completo.

### Cambios en `src/components/TopicCard.tsx`

1. **Reestructurar el header** en dos `div` rows dentro del botón expandible
2. **Prioridad** → borde izquierdo coloreado (rojo=urgente, naranja=alta, sin borde=media/baja) en vez de badge
3. **Alertas de subtareas** → texto pequeño con color, sin badge ni emoji
4. **Responsable + Departamento** → texto `text-[11px] text-muted-foreground` separados por `·`
5. **Tags** → dots de color (`w-2 h-2 rounded-full`) con tooltip en hover
6. **Status** → solo badge discreto si no es "activo"
7. **Sin fecha** → texto rojo pequeño en la zona de fecha (derecha)

### Archivo a modificar
- `src/components/TopicCard.tsx` — reestructurar líneas ~140-310


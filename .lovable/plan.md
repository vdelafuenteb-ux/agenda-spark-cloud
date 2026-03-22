

## Plan: Garantizar cierre automático de subtareas con trigger de base de datos

### Diagnóstico
La base de datos ya tiene todas las subtareas de temas cerrados marcadas como completadas. Lo que ves puede ser caché del navegador. Sin embargo, la lógica actual depende solo del frontend (Index.tsx línea 324-328), lo que significa que si alguien cierra un tema desde otro lugar o si el frontend falla, las subtareas podrían quedar abiertas.

### Solución: Trigger en base de datos (a prueba de fallos)

**1. Migración SQL** — Crear un trigger `on UPDATE` en `topics` que cuando `status` cambie a `'completado'`, automáticamente marque todas las subtareas pendientes como completadas:

```sql
CREATE OR REPLACE FUNCTION public.auto_complete_subtasks_on_topic_close()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completado' AND (OLD.status IS DISTINCT FROM 'completado') THEN
    UPDATE public.subtasks 
    SET completed = true, completed_at = now() 
    WHERE topic_id = NEW.id AND completed = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_complete_subtasks
AFTER UPDATE ON public.topics
FOR EACH ROW
EXECUTE FUNCTION public.auto_complete_subtasks_on_topic_close();
```

**2. Re-ejecutar fix de datos existentes** — Por seguridad, incluir en la misma migración:
```sql
UPDATE public.subtasks SET completed = true, completed_at = now()
WHERE topic_id IN (SELECT id FROM public.topics WHERE status = 'completado')
AND completed = false;
```

**3. Mantener lógica frontend** — El código en `Index.tsx` (líneas 324-328) se mantiene para actualización optimista inmediata en la UI, pero el trigger garantiza consistencia a nivel de base de datos.

### Archivos a modificar
1. **Migración SQL** — Trigger + fix de datos

### Detalle técnico
- El trigger usa `AFTER UPDATE` para no interferir con la transacción principal
- La condición `OLD.status IS DISTINCT FROM 'completado'` evita re-ejecutar si ya estaba cerrado
- No se modifican archivos de código, solo base de datos


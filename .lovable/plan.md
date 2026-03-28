

## Plan: Mover columna "Revisado" junto a "Confirmado" + optimizar velocidad + filtro por defecto

### Problemas identificados

1. **Columna "Revisado" está al final** de la tabla, lejos de "Confirmado". Hay que moverla justo después.
2. **Lentitud al marcar "Revisado"**: el batch checkbox ejecuta N mutaciones individuales (`batchIds.forEach(id => toggleReviewed.mutate(...))`), una por cada correo. Esto causa N requests independientes.
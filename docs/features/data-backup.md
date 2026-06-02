# Datos / Respaldo

Exportar todos los datos como JSON, importar un respaldo y resetear la app.

## Ubicación en la UI

- **Panel** `<app-data-backup>` colapsable al final de la columna izquierda.

Archivos:
- Componente: `src/app/components/data-backup/`
- Servicio: `TransactionsService.exportData()`, `.importData()`, `.validateImportFile()`, `.clearAllData()`, `.dataCounts()`

## Resumen actual

Cuando se expande el panel se muestra un resumen como:

> 47 movimientos manuales · 12 plantillas de fijos · 2 tarjetas · 8 compras con cuotas · 3 suscripciones · 156 cotizaciones cacheadas

Lo calcula `dataCounts()`:

```ts
dataCounts() {
  return {
    transactions: this._transactions().length,
    templates: this._templates().length,
    cards: this._cards().length,
    purchases: this._purchases().length,
    subscriptions: this._subscriptions().length,
    rates: Object.keys(this._rates()).length,
  };
}
```

## Exportar

Click en "Exportar respaldo" → llama a `exportData()` que devuelve un `ExportFile`:

```ts
interface ExportFile {
  app: 'control-gastos';
  schemaVersion: number;
  exportedAt: string;
  data: {
    transactions: Transaction[];
    templates: RecurringTemplate[];
    cards: CreditCard[];
    purchases: CardPurchase[];
    subscriptions: Subscription[];
    rates: Record<string, number>;
  };
}
```

El componente serializa a JSON, lo envuelve en un `Blob` y dispara una descarga con `<a download>` programático. Nombre del archivo: `control-gastos-YYYY-MM-DD.json`.

NO se incluyen las preferencias de UI (paneles abiertos/cerrados, tema activo, filtros). Son específicas del dispositivo/navegador.

## Importar

Click en "Importar respaldo" → abre `<input type="file" accept=".json">` programáticamente. Cuando el usuario elige archivo:

1. Se lee con `file.text()` y se parsea con `JSON.parse()`.
2. Si falla el parse → modal de error.
3. Se valida con `validateImportFile(raw)`:
   - `raw.app === 'control-gastos'`
   - `typeof raw.schemaVersion === 'number'`
   - `raw.schemaVersion <= 1` (versión actual soportada)
   - `raw.data` existe
4. Si falla la validación → modal de error con el motivo.
5. Si pasa, se muestra un modal de confirmación con un resumen del archivo: "El archivo contiene: 47 movimientos, 12 plantillas, ..."
6. El usuario confirma → `importData(file)` reemplaza TODOS los datos:

```ts
importData(file: ExportFile): void {
  this._transactions.set(file.data.transactions ?? []);
  this._templates.set(file.data.templates ?? []);
  this._cards.set(file.data.cards ?? []);
  this._purchases.set(file.data.purchases ?? []);
  this._subscriptions.set(file.data.subscriptions ?? []);
  this._rates.set(file.data.rates ?? {});
  // Persiste cada uno
}
```

Estrategia: **reemplazo completo, no merge**. Hacer merge sería complejo (¿qué pasa con IDs duplicados? ¿cómo se unen historiales de precios?). El reemplazo es predecible y honesto.

Si querés "agregar a lo existente", la opción es: exportar lo actual, luego importar el nuevo archivo. Los datos viejos se pierden, así que es un trade-off.

## Borrar todos los datos

Click en "Borrar todos los datos" → primera confirmación. Si se confirma, segunda confirmación reforzada que sugiere exportar antes. Al confirmar la segunda:

```ts
clearAllData(): void {
  this._transactions.set([]);
  this._templates.set([]);
  this._cards.set([]);
  this._purchases.set([]);
  this._subscriptions.set([]);
  this._rates.set({});
  // Persiste arrays vacíos en localStorage
}
```

Las preferencias de UI (tema, paneles colapsados, etc.) NO se borran. Si querés reset total, hay que limpiar `localStorage` desde DevTools del navegador.

## Versionado

`schemaVersion: 1` es la versión actual del formato. Si en el futuro cambia el modelo:

- Versiones más viejas: agregar lógica de migración en `importData`.
- Versiones más nuevas: rechazar con error claro ("El archivo fue creado con una versión más nueva. Actualizá la app").

Por ahora no hay migraciones porque sólo existe la versión 1.

## Casos de uso típicos

- **Backup periódico**: exportar cada cierto tiempo a Drive/Dropbox/etc.
- **Mover entre dispositivos**: exportar en una compu, importar en otra.
- **Cambiar de navegador**: localStorage no se comparte entre Chrome y Firefox; export/import resuelve.
- **Reset para empezar de cero**: "Borrar todos los datos" después de exportar como precaución.

## Seguridad

El archivo JSON contiene **información financiera personal**: tarjetas, gastos, ingresos. Tratarlo como sensible:

- No subirlo a repositorios públicos.
- Si lo guardás en cloud, considerá cifrarlo antes (la app no lo cifra).
- No compartirlo casualmente.

La app no cifra el export porque sumaría complejidad y el archivo se maneja localmente; el usuario es responsable del archivo.

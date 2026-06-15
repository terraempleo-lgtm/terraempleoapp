# Deep link de vacantes — qué falta (para Vero)

Los links que manda el bot de WhatsApp son `https://app.terrampleo.com/app/vacantes/:id`.
Para que **abran la app** (si está instalada) en la vacante exacta, ya dejé listos los cambios en el repo:

- `app.json`: `"scheme": "terraempleo"`, Android `intentFilters` (App Links con `autoVerify` para
  `https://app.terrampleo.com/app/vacantes/*`) y iOS `associatedDomains: applinks:app.terrampleo.com`.
- `App.js`: handler que, al abrir un link de vacante, navega a `DetalleVacante` (defensivo: si no hay
  sesión, la app abre igual; cuando el usuario entra, navega).
- `assetlinks.json` (Android) y `apple-app-site-association` (iOS) ya están publicados en `/.well-known/`.

## Lo que TÚ debes hacer (requiere build nativo, no OTA)

1. Subir `android.versionCode` (7 → 8) y, si quieres, `version` (1.2.0 → 1.2.1) en `app.json`.
2. Build + submit:
   ```bash
   EXPO_TOKEN=<token> npx eas build --platform android --profile production
   EXPO_TOKEN=<token> npx eas build --platform ios --profile production   # opcional
   # subir a stores (eas submit o manual)
   ```
3. Verificar en un Android con la app instalada: tocar un link de vacante desde WhatsApp → debe abrir
   la app en esa vacante. Sin la app → abre la web. (En Android la verificación de App Links puede tardar
   unos minutos tras instalar.)

> Nota: la navegación exacta a la vacante la hice según el patrón actual
> (`navigate('DetalleVacante', { vacante: { id } })`). Si en tu navegador por rol cae en otra ruta,
> ajústalo en el handler de `App.js` (busca `pendingVacante`).

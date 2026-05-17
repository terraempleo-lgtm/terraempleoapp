import React, { useEffect, useState, useRef } from 'react';
import { Image } from 'expo-image';
import { resolverFuente, tieneCacheLocal } from '../../utils/mediaCache';

/**
 * Drop-in replacement de <Image> de expo-image que cachea al disco persistente
 * vía mediaCache. La diferencia clave con expo-image solo es que usa la
 * "stableKey" (path S3 sin firma) para idempotencia y guarda en una carpeta
 * propia de la app, lo que permite ver la imagen offline aunque la URL firmada
 * de S3 haya expirado.
 *
 * Props:
 * - source: { uri, entity, entityId, autoDescargar=true } o string
 * - resto: cualquier prop de <Image>
 */
const MediaCacheada = React.forwardRef((props, ref) => {
  const {
    source,
    placeholder,
    contentFit = 'cover',
    contentPosition = 'center',
    ...rest
  } = props;

  const url = typeof source === 'string' ? source : source?.uri;
  const entity = typeof source === 'object' ? source?.entity : null;
  const entityId = typeof source === 'object' ? source?.entityId : null;
  const autoDescargar = typeof source === 'object'
    ? (source?.autoDescargar ?? true)
    : true;

  const [resolved, setResolved] = useState(url);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    // Pintamos con la URL original al instante; en paralelo intentamos local
    setResolved(url);
    if (!url) return;
    if (url.startsWith('file://')) return;

    (async () => {
      // Primero chequeo rápido si ya está local (sin red)
      const local = await tieneCacheLocal(url);
      if (local && !cancelled && mounted.current) {
        setResolved(local);
        return;
      }
      // Si no, intentamos resolver (descargará si hay internet)
      if (!autoDescargar) return;
      const fresh = await resolverFuente(url, { entity, entityId, autoDescargar });
      if (!cancelled && mounted.current && fresh && fresh !== url) {
        setResolved(fresh);
      }
    })();

    return () => { cancelled = true; mounted.current = false; };
  }, [url, entity, entityId, autoDescargar]);

  return (
    <Image
      ref={ref}
      source={resolved}
      placeholder={placeholder}
      contentFit={contentFit}
      contentPosition={contentPosition}
      cachePolicy="memory-and-disk"
      {...rest}
    />
  );
});

MediaCacheada.displayName = 'MediaCacheada';

export default MediaCacheada;
export { MediaCacheada };

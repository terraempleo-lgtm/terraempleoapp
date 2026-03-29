import { useWindowDimensions, Platform } from 'react-native';
import { SPACING } from '../theme';

export function useDisenoResponsive() {
  const { width } = useWindowDimensions();
  const esWeb = Platform.OS === 'web';
  const esTablet = width >= 768;
  const esDesktop = width >= 1024;
  const esWide = width >= 1440;

  const contenedorMaxAncho = esWeb
    ? (esWide ? 1200 : esDesktop ? 960 : esTablet ? 720 : width)
    : width;

  const paddingHorizontal = esWeb
    ? (esDesktop ? SPACING.xl : SPACING.lg)
    : SPACING.lg;

  const columnas = width >= 1280 ? 3 : width >= 900 ? 2 : 1;

  return {
    esWeb,
    esTablet,
    esDesktop,
    contenedorMaxAncho,
    paddingHorizontal,
    columnas,
  };
}

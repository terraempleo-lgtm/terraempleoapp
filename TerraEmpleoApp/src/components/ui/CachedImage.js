import React from 'react';
import { Image } from 'expo-image';

/**
 * Wrapper around expo-image for automatic caching and blur placeholders.
 * - Automatic disk cache for all images
 * - Blur placeholder support for better perceived performance
 * - Better handling of S3 pre-signed URLs
 */
export const CachedImage = React.forwardRef((props, ref) => {
  const {
    source,
    placeholder,
    contentFit = 'cover',
    contentPosition = 'center',
    ...rest
  } = props;

  // Convert source format if needed
  const imageSource = typeof source === 'string' ? source : source?.uri || source;
  const blurHash = source?.blurHash;

  return (
    <Image
      ref={ref}
      source={imageSource}
      placeholder={blurHash || placeholder}
      contentFit={contentFit}
      contentPosition={contentPosition}
      cachePolicy="memory-and-disk"
      priority="high"
      {...rest}
    />
  );
});

CachedImage.displayName = 'CachedImage';

// For backwards compatibility, if you want to use it directly
export default CachedImage;

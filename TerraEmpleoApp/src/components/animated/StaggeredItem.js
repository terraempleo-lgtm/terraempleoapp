import React from 'react';
import { MotiView } from 'moti';
import { ANIMATION } from '../../theme';

const StaggeredItem = ({
  children,
  index = 0,
  delay: delayOverride,
  disabled = false,
  style,
}) => {
  if (disabled || index > 15) {
    return <>{children}</>;
  }

  const delay = delayOverride ?? index * ANIMATION.duration.stagger;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        type: 'timing',
        duration: ANIMATION.duration.entrance,
        delay,
      }}
      style={style}
    >
      {children}
    </MotiView>
  );
};

export default StaggeredItem;

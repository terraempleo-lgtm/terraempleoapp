import React from 'react';
import { MotiView } from 'moti';
import { ANIMATION } from '../../theme';

const FadeInView = ({
  children,
  delay = 0,
  translateY = 12,
  duration = ANIMATION.duration.normal,
  style,
}) => (
  <MotiView
    from={{ opacity: 0, translateY }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={{
      type: 'timing',
      duration,
      delay,
    }}
    style={style}
  >
    {children}
  </MotiView>
);

export default FadeInView;

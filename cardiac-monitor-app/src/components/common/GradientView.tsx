import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

interface GradientViewProps extends ViewProps {
  colors: [string, string];
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

let gradientId = 0;

const GradientView: React.FC<GradientViewProps> = ({ colors, style, children, ...rest }) => {
  const [id] = React.useState(() => `grad-${gradientId++}`);

  return (
    <View style={style} {...rest}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} stopOpacity={1} />
            <Stop offset="1" stopColor={colors[1]} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
};

export default GradientView;

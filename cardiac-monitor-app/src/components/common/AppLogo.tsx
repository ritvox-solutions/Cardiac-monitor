import React from 'react';
import { View, Image, StyleSheet, ViewStyle, ImageStyle, Text } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../../theme';

export interface AppLogoProps {
  /** Diameter or size in pixels (default: 64) */
  size?: number;
  /** Custom image style */
  style?: ImageStyle;
  /** Custom container style */
  containerStyle?: ViewStyle;
  /** Add a subtle luminous glow effect */
  withGlow?: boolean;
  /** Whether corners are rounded (default: true) */
  rounded?: boolean;
  /** Display title and subtitle alongside or beneath */
  showText?: boolean;
  /** Text placement relative to the icon */
  textPlacement?: 'bottom' | 'right';
}

const AppLogo: React.FC<AppLogoProps> = ({
  size = 64,
  style,
  containerStyle,
  withGlow = true,
  rounded = true,
  showText = false,
  textPlacement = 'bottom',
}) => {
  const borderRadius = rounded ? Math.round(size * 0.22) : 0;

  return (
    <View
      style={[
        styles.wrapper,
        textPlacement === 'right' && styles.rowWrapper,
        containerStyle,
      ]}
    >
      <View
        style={[
          styles.imageContainer,
          {
            width: size,
            height: size,
            borderRadius,
          },
          withGlow && styles.glow,
        ]}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius,
            },
            style,
          ]}
          resizeMode="cover"
        />
      </View>

      {showText && (
        <View
          style={[
            styles.textContainer,
            textPlacement === 'right' ? styles.textRight : styles.textBottom,
          ]}
        >
          <Text style={styles.title}>Cardiac Monitor</Text>
          <Text style={styles.subtitle}>Wearable Health Intelligence</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    overflow: 'hidden',
    backgroundColor: '#070D1B',
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
  },
  textBottom: {
    marginTop: Spacing.sm,
  },
  textRight: {
    marginLeft: Spacing.md,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

export default AppLogo;

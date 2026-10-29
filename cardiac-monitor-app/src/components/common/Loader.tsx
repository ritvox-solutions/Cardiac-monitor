import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, FontSize, Spacing } from '../../theme';

interface LoaderProps {
  message?: string;
  size?: 'small' | 'large';
  inline?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ message, size = 'large', inline = false }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spinAnim.setValue(0);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const containerStyle = inline ? styles.inlineContainer : styles.container;

  return (
    <Animated.View style={containerStyle}>
      <Animated.View
        style={[
          styles.spinnerWrapper,
          {
            transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          },
        ]}
      >
        <ActivityIndicator size={size} color={Colors.primary} />
      </Animated.View>
      {message && <Text style={styles.message}>{message}</Text>}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  inlineContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  spinnerWrapper: {
    // Wrapper for potential custom spinner animations
  },
  message: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: '80%',
  },
});

export default Loader;
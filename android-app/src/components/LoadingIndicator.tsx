import React, { Component } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

interface Props {
  isLoading: boolean;
  children: React.ReactNode;
}

export const LoadingIndicator: React.FC<Props> = ({ isLoading, children }) => {
  if (!isLoading) return <>{children}</>;

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#4facfe" />
      <Text style={styles.loadingText}>加载中...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

// HOC for screens that need loading state
export function withLoading<P>(Component: React.ComponentType<P>) {
  return (props: P & { isLoading?: boolean }) => {
    const { isLoading, ...rest } = props;
    return (
      <LoadingIndicator isLoading={isLoading || false}>
        <Component {...rest} />
      </LoadingIndicator>
    );
  };
}

export default LoadingIndicator;

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <AlertTriangle size={48} color="#ef4444" />
          <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 16, color: '#fafafa' }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, color: '#a1a1aa', marginTop: 8, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Pressable
            onPress={this.handleReset}
            style={{
              marginTop: 24,
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: '#d4af37',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <Text style={{ color: '#09090b', fontFamily: 'Inter_600SemiBold' }}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

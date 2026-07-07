import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e, i) { console.error('ErrorBoundary:', e, i); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={s.c}>
          <Text style={s.t}>Something went wrong</Text>
          <Text style={s.sub}>Please restart the app.</Text>
          <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false })}>
            <Text style={s.btnT}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
const s = StyleSheet.create({
  c:    { flex: 1, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', padding: 32 },
  t:    { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  sub:  { color: '#aaa', fontSize: 15, textAlign: 'center', marginBottom: 32 },
  btn:  { backgroundColor: '#FFA100', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  btnT: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

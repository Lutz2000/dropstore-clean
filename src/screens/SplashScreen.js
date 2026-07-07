import React from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image source={require('../../logo/logo crisp.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.tagline}>Your marketplace, delivered.</Text>
      <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, alignItems: 'center', justifyContent: 'center' },
  logo     : { width: 360, height: 197 },
  tagline  : { color: '#aaa', fontSize: 16, marginTop: 16 },
});

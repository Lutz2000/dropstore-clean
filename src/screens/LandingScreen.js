import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { COLORS, SIZES, FONTS } from '../constants/theme';

export default function LandingScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.hero}>
        <Image source={require('../../logo/logo crisp.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>Shop from verified vendors.{'\n'}Delivered to your door.</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.btnPrimaryText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.btnOutlineText}>I already have an account</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('MainTabs')} style={styles.btnGuest}>
          <Text style={styles.guestLink}>Browse as Guest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container     : { flex: 1, backgroundColor: COLORS.black },
  hero          : { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logo          : { width: 280, height: 153 },
  tagline       : { color: '#ccc', fontSize: 18, textAlign: 'center', marginTop: 20, lineHeight: 28 },
  actions       : { padding: 24, paddingBottom: 32, gap: 12 },
  btnPrimary    : { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  btnPrimaryText: { color: COLORS.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  btnOutline    : { borderWidth: 2, borderColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnOutlineText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  btnGuest      : { borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: '#1e1e1e' },
  guestLink     : { color: '#aaa', textAlign: 'center', fontSize: 14, fontWeight: '500' },
});

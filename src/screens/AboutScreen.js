import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, Linking, StatusBar,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { COLORS } from '../constants/theme';

const HERO_IMG = 'https://images.pexels.com/photos/35472471/pexels-photo-35472471.jpeg?auto=compress&cs=tinysrgb&w=800&dpr=1';
const MARKET_IMG = 'https://images.pexels.com/photos/6193209/pexels-photo-6193209.jpeg?auto=compress&cs=tinysrgb&w=800&dpr=1';

const CONTACT_ITEMS = [
  { icon: 'phone-outline', label: 'Phone', value: '+256 200 907 146', action: () => Linking.openURL('tel:+256200907146'), color: '#FFA100', bg: '#fff8ed' },
  { icon: 'email-outline', label: 'Email', value: 'info@dropstore.click', action: () => Linking.openURL('mailto:info@dropstore.click'), color: '#2563eb', bg: '#eff6ff' },
  { icon: 'map-marker-outline', label: 'Location', value: 'Wandegeya, Kampala, Uganda', action: null, color: '#dc2626', bg: '#fef2f2' },
  { icon: 'whatsapp', label: 'WhatsApp', value: '+256 759 625 728', action: () => Linking.openURL('https://wa.me/256759625728'), color: '#16a34a', bg: '#f0fdf4' },
];

const VALUES = [
  { icon: 'shield-check-outline', title: 'Trust & Safety', desc: 'Every vendor is verified by our admin team before going live. We review applications and documents to protect both buyers and sellers.', bg: '#fff8ed' },
  { icon: 'earth', title: 'Local First', desc: 'We are proudly Ugandan. Our mission is to strengthen the local economy by giving Ugandan businesses a world-class platform to grow.', bg: '#f0fdf4' },
  { icon: 'lightning-bolt', title: 'Speed & Simplicity', desc: 'Shopping should be fast and effortless. We constantly improve so that finding and buying products takes seconds, not minutes.', bg: '#eff6ff' },
  { icon: 'handshake', title: 'Fairness', desc: 'We offer free accounts so anyone can start selling. Paid plans unlock more features but we never lock buyers out of great deals.', bg: '#f5f3ff' },
  { icon: 'heart-outline', title: 'Community', desc: 'DropStore is more than a marketplace — it is a community. We listen to feedback and build features that truly matter to real users.', bg: '#fdf2f8' },
  { icon: 'package-variant-closed', title: 'Reliable Delivery', desc: 'We partner with dependable delivery networks across Uganda to ensure every order arrives on time and in perfect condition.', bg: '#f0fdfa' },
];

const STATS = [
  { num: '10K+', label: 'Registered Users' },
  { num: '500+', label: 'Active Vendors' },
  { num: '50+', label: 'Categories' },
  { num: '24/7', label: 'Support' },
];

export default function AboutScreen({ navigation }) {
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* Hero */}
        <View style={s.hero}>
          <Image source={{ uri: HERO_IMG }} style={s.heroImg} resizeMode="cover" />
          <View style={s.heroOverlay} />
          <View style={s.heroContent}>
            <View style={s.heroBadge}>
              <MaterialCommunityIcons name="earth" size={13} color={COLORS.primary} />
              <Text style={s.heroBadgeText}>Made in Uganda</Text>
            </View>
            <Text style={s.heroTitle}>About <Text style={{ color: COLORS.primary }}>DropStore</Text></Text>
            <Text style={s.heroSub}>
              Connecting Uganda's local sellers and buyers through a safe, fast and affordable digital marketplace.
            </Text>
          </View>
        </View>

        <View style={s.body}>

          {/* Who We Are */}
          <View style={s.section}>
            <Image source={{ uri: MARKET_IMG }} style={s.storyImg} resizeMode="cover" />
            <View style={s.storyBadge}>
              <MaterialCommunityIcons name="map-marker" size={13} color="#dc2626" />
              <Text style={s.storyBadgeText}>Uganda</Text>
            </View>
            <Text style={s.sectionTitle}>Who We <Text style={{ color: COLORS.primary }}>Are</Text></Text>
            <Text style={s.bodyText}>
              <Text style={{ fontWeight: '700' }}>DropStore</Text> is Uganda's trusted multi-vendor marketplace. We connect local sellers and buyers so you get quality products with fast, reliable delivery across the country. Our goal is simple: make shopping easy, safe, and affordable for every Ugandan.
            </Text>
            <Text style={s.bodyText}>
              We believe every Ugandan seller — from the market vendor in Owino to the boutique on Kampala Road — deserves a powerful digital storefront. DropStore gives vendors the tools to reach thousands of buyers while giving shoppers a trustworthy, organised place to find anything they need.
            </Text>
            <Text style={s.bodyText}>
              Founded with a deep commitment to supporting the local economy, DropStore continues to grow by empowering communities one transaction at a time. Every purchase you make here goes directly to a real Ugandan business.
            </Text>
          </View>

          {/* Stats */}
          <View style={s.statsBox}>
            <View style={s.statsGrid}>
              {STATS.map(st => (
                <View key={st.label} style={s.statItem}>
                  <Text style={s.statNum}>{st.num}</Text>
                  <Text style={s.statLabel}>{st.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Values */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Our Core <Text style={{ color: COLORS.primary }}>Values</Text></Text>
            <Text style={s.sectionSub}>Everything we build is guided by these principles.</Text>
            <View style={s.valuesGrid}>
              {VALUES.map(v => (
                <View key={v.title} style={[s.valueCard, { backgroundColor: v.bg }]}>
                  <MaterialCommunityIcons name={v.icon} size={28} color={COLORS.primary} />
                  <Text style={s.valueTitle}>{v.title}</Text>
                  <Text style={s.valueDesc}>{v.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Contact */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Get In <Text style={{ color: COLORS.primary }}>Touch</Text></Text>
            <Text style={s.sectionSub}>
              Our team is always here to help. Reach out through any channel below.
            </Text>
            {CONTACT_ITEMS.map(item => (
              <TouchableOpacity
                key={item.label}
                style={s.contactCard}
                onPress={item.action}
                activeOpacity={item.action ? 0.7 : 1}
              >
                <View style={[s.contactIcon, { backgroundColor: item.bg }]}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={s.contactBody}>
                  <Text style={s.contactLabel}>{item.label}</Text>
                  <Text style={[s.contactValue, item.action && { color: item.color }]}>{item.value}</Text>
                </View>
                {item.action && <Text style={{ color: '#94a3b8', fontSize: 13 }}>›</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* Policies CTA */}
          <TouchableOpacity style={s.policyCta} onPress={() => navigation.navigate('Policies')} activeOpacity={0.8}>
            <MaterialCommunityIcons name="shield-check-outline" size={24} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.policyCtaTitle}>View Our Policies</Text>
              <Text style={s.policyCtaSub}>Shipping, returns &amp; privacy policy</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 18 }}>›</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // Hero
  hero: { height: 260, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.62)' },
  heroContent: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  heroBadge: { backgroundColor: 'rgba(255,161,0,0.22)', borderWidth: 1, borderColor: 'rgba(255,161,0,0.5)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 30, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 10 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 20 },

  // Body
  body: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 36 },
  sectionTitle: { fontSize: 21, fontWeight: '800', color: '#0f172a', marginBottom: 8, marginTop: 8 },
  sectionSub: { fontSize: 13.5, color: '#64748b', lineHeight: 20, marginBottom: 20 },
  bodyText: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 14 },

  // Story image
  storyImg: { width: '100%', height: 200, borderRadius: 16, marginBottom: 8 },
  storyBadge: { backgroundColor: COLORS.primary, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  storyBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Stats
  statsBox: { backgroundColor: '#0f172a', borderRadius: 20, padding: 24, marginBottom: 32 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: { width: '50%', alignItems: 'center', paddingVertical: 12 },
  statNum: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: '500' },

  // Values
  valuesGrid: { gap: 12 },
  valueCard: { borderRadius: 16, padding: 20, marginBottom: 0, alignItems: 'flex-start' },
  valueIcon: { fontSize: 26, marginBottom: 10 },
  valueTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  valueDesc: { fontSize: 13, color: '#475569', lineHeight: 20 },

  // Contact
  contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#f0f4f8', borderRadius: 14, padding: 16, marginBottom: 12, gap: 14 },
  contactIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactBody: { flex: 1 },
  contactLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  contactValue: { fontSize: 14.5, fontWeight: '600', color: '#0f172a' },

  // Policies CTA
  policyCta: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#0f172a', borderRadius: 16, padding: 20, marginTop: 8 },
  policyCtaIcon: { fontSize: 26 },
  policyCtaTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 3 },
  policyCtaSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.6)' },
});

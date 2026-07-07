import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, Linking, StatusBar,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { COLORS } from '../constants/theme';

const HERO_IMG = 'https://images.pexels.com/photos/6169665/pexels-photo-6169665.jpeg?auto=compress&cs=tinysrgb&w=800&dpr=1';

const POLICIES = [
  {
    key: 'shipping',
    icon: 'truck-outline',
    title: 'Shipping Policy',
    color: '#FFA100',
    bg: '#fff8ed',
    content: [
      {
        type: 'text',
        text: 'We deliver across Uganda within 3 to 7 business days. Orders placed before 2:00 PM are processed the same day. The delivery fee is clearly shown at checkout before you complete your order — no hidden charges, ever.',
      },
      {
        type: 'highlight',
        text: 'Orders placed after 2:00 PM will be processed the following business day. Delivery timelines may vary slightly during public holidays or peak seasons.',
      },
      {
        type: 'text',
        text: 'Our delivery network covers major towns and districts across Uganda including Kampala, Entebbe, Jinja, Mbarara, Gulu, Fort Portal, Mbale, Masaka and many more.',
      },
      {
        type: 'list',
        items: [
          'Delivery fee is calculated based on your location and displayed before payment.',
          'You will receive a notification when your order has been dispatched.',
          'Fragile items are specially packaged for safe delivery.',
          'Same-day delivery may be available in select Kampala areas subject to vendor confirmation.',
        ],
      },
      {
        type: 'cta',
        icon: 'whatsapp',
        title: 'Need delivery support?',
        text: 'WhatsApp us at +256 759 625 728 for any delivery-related queries.',
        action: () => Linking.openURL('https://wa.me/256759625728'),
        actionText: 'WhatsApp Us',
      },
    ],
  },
  {
    key: 'returns',
    icon: 'undo',
    title: 'Returns Policy',
    color: '#2563eb',
    bg: '#eff6ff',
    content: [
      {
        type: 'text',
        text: "If you're not happy with your item, you can return it within 7 days of delivery for a full refund or exchange. Just contact us on WhatsApp and we'll guide you. Products must be unused and in their original packaging.",
      },
      {
        type: 'highlight',
        text: 'Returns are accepted within 7 calendar days from the date of delivery. Items that have been used, damaged by the buyer, or are missing original packaging may not qualify.',
      },
      {
        type: 'text',
        text: 'We process refunds within 3 to 5 business days once the returned item has been received and inspected. Your satisfaction is our priority.',
      },
      {
        type: 'list',
        items: [
          'Contact us on WhatsApp within 7 days of receiving your order.',
          'Take clear photos of the item and any damage before sending it back.',
          'Refunds are issued to your original payment method or as store credit.',
          'Return shipping costs are covered by DropStore if the item was damaged or incorrect.',
          'Perishable goods (food, fresh produce) must be reported within 24 hours.',
        ],
      },
      {
        type: 'cta',
        icon: 'whatsapp',
        title: 'Start a return request',
        text: 'WhatsApp us with your order details and we will guide you step by step.',
        action: () => Linking.openURL('https://wa.me/256759625728'),
        actionText: 'WhatsApp Us',
      },
    ],
  },
  {
    key: 'privacy',
    icon: 'lock-outline',
    title: 'Privacy Policy',
    color: '#16a34a',
    bg: '#f0fdf4',
    content: [
      {
        type: 'text',
        text: 'We respect your privacy. We collect only the information needed to process your orders — your name, contact details, and delivery address. We never share or sell your data to third parties. Your payment details are handled securely by our trusted payment partners.',
      },
      {
        type: 'highlight',
        text: 'Your data is stored securely on encrypted servers. We never sell, rent or share your personal information with third parties for marketing purposes.',
      },
      {
        type: 'list',
        items: [
          'What we collect: Name, email, phone number, delivery address and order history.',
          'Why we collect it: To process orders, verify vendors, send delivery updates and provide support.',
          'Payment security: Card and mobile money payments are processed by certified payment gateways. DropStore never stores your full payment credentials.',
          'Cookies: We use only essential cookies to keep you logged in and improve performance.',
          'Your rights: You may request to view, update or delete your personal data at any time.',
          'Data retention: Inactive accounts may be removed after 24 months.',
        ],
      },
      {
        type: 'cta',
        icon: 'email-outline',
        title: 'Privacy questions?',
        text: 'Email us at info@dropstore.click and we will respond within 24 hours.',
        action: () => Linking.openURL('mailto:info@dropstore.click'),
        actionText: 'Email Us',
      },
    ],
  },
];

function PolicyBlock({ block }) {
  if (block.type === 'text') {
    return <Text style={s.policyText}>{block.text}</Text>;
  }
  if (block.type === 'highlight') {
    return (
      <View style={s.highlight}>
        <MaterialCommunityIcons name="information-outline" size={20} color={COLORS.primary} />
        <Text style={s.highlightText}>{block.text}</Text>
      </View>
    );
  }
  if (block.type === 'list') {
    return (
      <View style={s.listWrap}>
        {block.items.map((item, i) => (
          <View key={i} style={s.listItem}>
            <View style={s.listDot} />
            <Text style={s.listText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (block.type === 'cta') {
    return (
      <TouchableOpacity style={s.ctaBox} onPress={block.action} activeOpacity={0.8}>
        <MaterialCommunityIcons name={block.icon} size={24} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.ctaTitle}>{block.title}</Text>
          <Text style={s.ctaText}>{block.text}</Text>
        </View>
        <View style={s.ctaBtn}>
          <Text style={s.ctaBtnText}>{block.actionText}</Text>
        </View>
      </TouchableOpacity>
    );
  }
  return null;
}

export default function PoliciesScreen({ navigation }) {
  const [expanded, setExpanded] = useState({ shipping: true, returns: false, privacy: false });

  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }));

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
              <MaterialCommunityIcons name="shield-check-outline" size={13} color={COLORS.primary} />
              <Text style={s.heroBadgeText}>Transparent & Fair</Text>
            </View>
            <Text style={s.heroTitle}>Our <Text style={{ color: COLORS.primary }}>Policies</Text></Text>
            <Text style={s.heroSub}>
              Everything you need to know about shipping, returns and how we handle your data.
            </Text>
          </View>
        </View>

        {/* Quick jump chips */}
        <View style={s.chipRow}>
          {POLICIES.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[s.chip, { borderColor: p.color }]}
              onPress={() => setExpanded(prev => ({ ...prev, [p.key]: true }))}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name={p.icon} size={14} color={p.color} />
                <Text style={s.chipText}>{p.title.replace(' Policy', '')}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.body}>
          {POLICIES.map((policy, idx) => (
            <View key={policy.key} style={[s.policyCard, idx < POLICIES.length - 1 && s.policyCardBorder]}>

              {/* Accordion header */}
              <TouchableOpacity
                style={s.policyHeader}
                onPress={() => toggle(policy.key)}
                activeOpacity={0.7}
              >
                <View style={[s.policyIconBox, { backgroundColor: policy.bg }]}>
                  <MaterialCommunityIcons name={policy.icon} size={24} color={policy.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.policyTitle}>{policy.title}</Text>
                  <Text style={[s.policySubtitle, { color: policy.color }]}>
                    {expanded[policy.key] ? 'Tap to collapse' : 'Tap to expand'}
                  </Text>
                </View>
                <Text style={[s.chevron, { color: policy.color }]}>
                  {expanded[policy.key] ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {/* Content */}
              {expanded[policy.key] && (
                <View style={s.policyContent}>
                  {policy.content.map((block, i) => (
                    <PolicyBlock key={i} block={block} />
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* About Us CTA */}
          <TouchableOpacity style={s.aboutCta} onPress={() => navigation.navigate('About')} activeOpacity={0.8}>
            <MaterialCommunityIcons name="information-outline" size={24} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.aboutCtaTitle}>Learn More About Us</Text>
              <Text style={s.aboutCtaSub}>Our story, values &amp; contact info</Text>
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
  hero: { height: 240, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.65)' },
  heroContent: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  heroBadge: { backgroundColor: 'rgba(255,161,0,0.22)', borderWidth: 1, borderColor: 'rgba(255,161,0,0.5)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 30, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 10 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 20 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 20, paddingBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5, backgroundColor: '#fff' },
  chipText: { fontSize: 12.5, fontWeight: '600', color: '#0f172a' },

  // Body
  body: { padding: 20, paddingTop: 12, paddingBottom: 40 },

  // Policy card
  policyCard: { marginBottom: 4 },
  policyCardBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f4f8', paddingBottom: 8, marginBottom: 16 },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  policyIconBox: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  policyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 3 },
  policySubtitle: { fontSize: 12, fontWeight: '500' },
  chevron: { fontSize: 12, fontWeight: '700' },

  // Policy content
  policyContent: { paddingBottom: 12 },
  policyText: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 16 },

  // Highlight box
  highlight: { flexDirection: 'row', gap: 10, backgroundColor: '#fff8ed', borderLeftWidth: 3.5, borderLeftColor: COLORS.primary, borderRadius: 10, padding: 14, marginBottom: 16, alignItems: 'flex-start' },
  highlightIcon: { fontSize: 16, marginTop: 1 },
  highlightText: { flex: 1, fontSize: 13.5, color: '#92400e', fontWeight: '500', lineHeight: 20 },

  // List
  listWrap: { marginBottom: 16 },
  listItem: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  listDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 7, flexShrink: 0 },
  listText: { flex: 1, fontSize: 13.5, color: '#475569', lineHeight: 20 },

  // CTA box
  ctaBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, padding: 16, marginTop: 8 },
  ctaIcon: { fontSize: 22 },
  ctaTitle: { fontSize: 13.5, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  ctaText: { fontSize: 12.5, color: '#64748b', lineHeight: 18, flex: 1 },
  ctaBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  ctaBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // About CTA
  aboutCta: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#0f172a', borderRadius: 16, padding: 20, marginTop: 20 },
  aboutCtaIcon: { fontSize: 26 },
  aboutCtaTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 3 },
  aboutCtaSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.6)' },
});

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import axios from 'axios';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';
import { API_URL } from '../api/client';
import client from '../api/client';

import SplashScreen              from '../screens/SplashScreen';
import SystemUnderReviewScreen   from '../screens/SystemUnderReviewScreen';
import LandingScreen             from '../screens/LandingScreen';
import LoginScreen               from '../screens/LoginScreen';
import RegisterScreen            from '../screens/RegisterScreen';
import HomeScreen                from '../screens/HomeScreen';
import ProductDetailScreen       from '../screens/ProductDetailScreen';
import CartScreen                from '../screens/CartScreen';
import WishlistScreen            from '../screens/WishlistScreen';
import DeliveriesScreen          from '../screens/DeliveriesScreen';
import ProfileScreen             from '../screens/ProfileScreen';
import VendorDashboardScreen     from '../screens/vendor/VendorDashboardScreen';
import VendorProductsScreen      from '../screens/vendor/VendorProductsScreen';
import VendorApplyScreen         from '../screens/vendor/VendorApplyScreen';
import VendorSubscriptionScreen  from '../screens/vendor/VendorSubscriptionScreen';
import VendorOffersScreen        from '../screens/vendor/VendorOffersScreen';
import VendorNotificationsScreen from '../screens/vendor/VendorNotificationsScreen';
import VendorPremiumPackagesScreen  from '../screens/vendor/VendorPremiumPackagesScreen';
import VendorPremiumDashboardScreen from '../screens/vendor/VendorPremiumDashboardScreen';
import OfferChatScreen           from '../screens/OfferChatScreen';
import BuyerOffersScreen         from '../screens/BuyerOffersScreen';
import ChatListScreen            from '../screens/ChatListScreen';
import ChatScreen                from '../screens/ChatScreen';
import AboutScreen               from '../screens/AboutScreen';
import PoliciesScreen            from '../screens/PoliciesScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// Professional Material Design Icons
const TAB_ICONS = {
  Home: 'home-outline',
  Wishlist: 'heart-outline',
  Cart: 'shopping-outline',
  Deliveries: 'truck-outline',
  Offers: 'tag-multiple-outline',
  Profile: 'account-outline',
  Chat: 'message-outline',
};

// ── Buyer bottom tabs (Chat tab has live red unread badge) ────────────────────
function BuyerTabs() {
  const [chatUnread, setChatUnread] = React.useState(0);
  const [offersUnread, setOffersUnread] = React.useState(0);

  React.useEffect(() => {
    const fetchUnread = async () => {
      try {
        const [chatRes, offersRes] = await Promise.all([
          client.get('/chat/unread-count').catch(() => ({ data: { count: 0 } })),
          client.get('/offers/unread-count').catch(() => ({ data: { count: 0 } })),
        ]);
        setChatUnread(chatRes.data.count || 0);
        setOffersUnread(offersRes.data.count || 0);
      } catch {}
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor  : COLORS.primary,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { borderTopWidth: 1, borderColor: '#eee', paddingBottom: 6, paddingTop: 4 },
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Chat') {
            return (
              <View style={{ position: 'relative' }}>
                <MaterialCommunityIcons name={TAB_ICONS[route.name]} size={size + 2} color={color} />
                {chatUnread > 0 && (
                  <View style={{
                    position: 'absolute', top: -6, right: -6,
                    backgroundColor: COLORS.danger, borderRadius: 9,
                    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center',
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </Text>
                  </View>
                )}
              </View>
            );
          }
          if (route.name === 'Offers') {
            return (
              <View style={{ position: 'relative' }}>
                <MaterialCommunityIcons name={TAB_ICONS[route.name]} size={size + 2} color={color} />
                {offersUnread > 0 && (
                  <View style={{
                    position: 'absolute', top: -6, right: -6,
                    backgroundColor: COLORS.danger, borderRadius: 9,
                    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center',
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                      {offersUnread > 99 ? '99+' : offersUnread}
                    </Text>
                  </View>
                )}
              </View>
            );
          }
          return <MaterialCommunityIcons name={TAB_ICONS[route.name]} size={size + 2} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"       component={HomeScreen} />
      <Tab.Screen name="Wishlist"   component={WishlistScreen} />
      <Tab.Screen name="Cart"       component={CartScreen} />
      <Tab.Screen name="Offers"     component={BuyerOffersScreen} />
      <Tab.Screen name="Chat"       component={ChatListScreen} />
      <Tab.Screen name="Deliveries" component={DeliveriesScreen} />
      <Tab.Screen name="Profile"    component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ── Root navigator ─────────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { user, loading } = useAuth();
  const [mobileStatus, setMobileStatus] = React.useState(null);
  const [statusChecked, setStatusChecked] = React.useState(false);

  React.useEffect(() => {
    axios.get(`${API_URL}/system-status`)
      .then(res => setMobileStatus(res.data.mobile))
      .catch(() => setMobileStatus('active'))
      .finally(() => setStatusChecked(true));
  }, []);

  if (loading || !statusChecked) return <SplashScreen />;
  if (mobileStatus === 'maintenance') return <SystemUnderReviewScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle     : { backgroundColor: COLORS.primary },
          headerTintColor : '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {/* ── Guest / unauthenticated ───────────────────────────────────── */}
        {!user ? (
          <>
            <Stack.Screen name="Landing"       component={LandingScreen}       options={{ headerShown: false }} />
            <Stack.Screen name="Login"         component={LoginScreen}         options={{ title: 'Sign In' }} />
            <Stack.Screen name="Register"      component={RegisterScreen}      options={{ title: 'Create Account' }} />
            <Stack.Screen name="MainTabs"      component={BuyerTabs}           options={{ headerShown: false }} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Product' }} />
            <Stack.Screen name="About"         component={AboutScreen}         options={{ title: 'About Us' }} />
            <Stack.Screen name="Policies"      component={PoliciesScreen}      options={{ title: 'Policies' }} />
          </>

        /* ── Vendor ─────────────────────────────────────────────────────── */
        ) : user.role === 'vendor' ? (
          <>
            <Stack.Screen name="VendorDashboard"    component={VendorDashboardScreen}    options={{ title: 'Dashboard', headerLeft: () => null }} />
            <Stack.Screen name="VendorProducts"     component={VendorProductsScreen}     options={{ title: 'My Products' }} />
            <Stack.Screen name="VendorApply"        component={VendorApplyScreen}        options={{ title: 'Apply for Store' }} />
            <Stack.Screen name="VendorSubscription" component={VendorSubscriptionScreen} options={{ title: 'Subscription' }} />
            <Stack.Screen name="VendorOffers"       component={VendorOffersScreen}       options={{ title: 'Price Offers' }} />
            <Stack.Screen name="VendorNotifications"component={VendorNotificationsScreen}options={{ title: 'Notifications' }} />
            <Stack.Screen name="VendorPremiumPackages"  component={VendorPremiumPackagesScreen}  options={{ title: 'Go Premium' }} />
            <Stack.Screen name="VendorPremiumDashboard" component={VendorPremiumDashboardScreen} options={{ title: 'Premium Dashboard' }} />
            <Stack.Screen name="OfferChat"          component={OfferChatScreen}          options={{ title: 'Offer Chat' }} />
            <Stack.Screen name="ChatList"           component={ChatListScreen}           options={{ title: 'Chat' }} />
            <Stack.Screen name="Chat"               component={ChatScreen}               options={{ title: 'Chat' }} />
            <Stack.Screen name="Deliveries"         component={DeliveriesScreen}         options={{ title: 'Deliveries' }} />
            <Stack.Screen name="Profile"            component={ProfileScreen}            options={{ title: 'Profile' }} />
            <Stack.Screen name="ProductDetail"      component={ProductDetailScreen}      options={{ title: 'Product' }} />
            <Stack.Screen name="Cart"               component={CartScreen}               options={{ title: 'Cart' }} />
            <Stack.Screen name="Wishlist"           component={WishlistScreen}           options={{ title: 'Wishlist' }} />
            <Stack.Screen name="About"              component={AboutScreen}              options={{ title: 'About Us' }} />
            <Stack.Screen name="Policies"           component={PoliciesScreen}           options={{ title: 'Policies' }} />
          </>

        /* ── Buyer ──────────────────────────────────────────────────────── */
        ) : (
          <>
            <Stack.Screen name="MainTabs"      component={BuyerTabs}           options={{ headerShown: false }} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Product' }} />
            <Stack.Screen name="MyOffers"      component={BuyerOffersScreen}   options={{ title: 'My Offers' }} />
            <Stack.Screen name="OfferChat"     component={OfferChatScreen}     options={{ title: 'Offer Chat' }} />
            <Stack.Screen name="Chat"          component={ChatScreen}          options={{ title: 'Chat' }} />
            <Stack.Screen name="VendorApply"   component={VendorApplyScreen}   options={{ title: 'Become a Vendor' }} />
            <Stack.Screen name="About"         component={AboutScreen}         options={{ title: 'About Us' }} />
            <Stack.Screen name="Policies"      component={PoliciesScreen}      options={{ title: 'Policies' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

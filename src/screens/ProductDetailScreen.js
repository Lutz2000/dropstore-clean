import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Dimensions, FlatList,
  Modal, TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import client, { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen({ route, navigation }) {
  const { id }         = route.params;
  const { user }       = useAuth();
  const [product, setProduct]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [mainImg, setMainImg]   = useState(0);
  const [inWishlist, setInWishlist] = useState(false);
  const [addingCart, setAddingCart]     = useState(false);
  const [deliveryPhone, setDeliveryPhone] = useState('+256-200-907-146');
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [offerModal, setOfferModal]       = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNote, setOfferNote]   = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerSentModal, setOfferSentModal] = useState(false);
  const [offerThreadInfo, setOfferThreadInfo] = useState(null);

  // Reviews state
  const [reviews, setReviews]               = useState([]);
  const [reviewsMeta, setReviewsMeta]       = useState({ average_rating: null, reviews_count: 0 });
  const [reviewsPage, setReviewsPage]       = useState(1);
  const [reviewsLastPage, setReviewsLastPage] = useState(1);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [rvRating, setRvRating]             = useState(0);
  const [rvComment, setRvComment]           = useState('');
  const [rvName, setRvName]                 = useState('');
  const [rvSubmitting, setRvSubmitting]     = useState(false);
  const [rvError, setRvError]               = useState(null);
  const [rvDone, setRvDone]                 = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get(`/products/${id}`);
        setProduct(res.data);
      } finally { setLoading(false); }
    })();
    // fetch delivery phone from settings
    client.get('/settings')
      .then(r => { if (r.data?.settings?.delivery_phone) setDeliveryPhone(r.data.settings.delivery_phone); })
      .catch(() => {});
    loadReviews(1);
  }, [id]);

  const loadReviews = async (page = 1) => {
    setReviewsLoading(true);
    try {
      const res = await client.get(`/products/${id}/reviews`, { params: { page } });
      const d = res.data;
      setReviews(prev => page === 1 ? (d.data || []) : [...prev, ...(d.data || [])]);
      setReviewsMeta({ average_rating: d.average_rating, reviews_count: d.reviews_count || d.total });
      setReviewsPage(d.current_page);
      setReviewsLastPage(d.last_page);
    } catch (_) {}
    setReviewsLoading(false);
  };

  const submitReview = async () => {
    setRvError(null);
    if (!rvRating) { setRvError('Please select a rating.'); return; }
    if (!rvComment.trim()) { setRvError('Please write a comment.'); return; }
    if (!user && !rvName.trim()) { setRvError('Please enter your name.'); return; }
    setRvSubmitting(true);
    try {
      await client.post(`/products/${id}/reviews`, {
        rating: rvRating,
        comment: rvComment,
        reviewer_name: rvName || undefined,
      });
      setRvDone(true);
      loadReviews(1);
    } catch (e) {
      setRvError(e?.response?.data?.message || 'Could not submit review. Try again.');
    } finally { setRvSubmitting(false); }
  };

  const starLabel = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      try {
        const res = await client.get(`/wishlist/check/${id}`);
        setInWishlist(res.data?.in_wishlist ?? false);
      } catch (_) {}
    })();
  }, [user, id]);

  if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} />;
  if (!product) return <Text style={{ textAlign: 'center', marginTop: 40 }}>Product not found.</Text>;

  const images = product.images?.length
    ? product.images
    : [{ url: null }];

  // Each image has a .url attribute (full URL) returned by the API
  const imgUri = (img) => img?.url || img?.image_path || `${BASE_URL}/images/placeholder.png`;

  const price = product.discount_price ?? product.price;

  const addToCart = async () => {
    if (!user) { navigation.navigate('Login'); return; }
    setAddingCart(true);
    try {
      await client.post('/cart', { product_id: product.id, quantity: 1 });
      Alert.alert('Added', 'Product added to cart.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not add to cart.');
    } finally { setAddingCart(false); }
  };

  const toggleWishlist = async () => {
    if (!user) { navigation.navigate('Login'); return; }
    try {
      await client.post('/wishlist/toggle', { product_id: product.id });
      setInWishlist(w => !w);
    } catch (_) {}
  };

  const openDeliveryModal = async () => {
    if (!user) { navigation.navigate('Login'); return; }
    // Add to cart silently first
    setAddingCart(true);
    try {
      await client.post('/cart', { product_id: product.id, quantity: 1 });
    } catch (_) { /* ignore duplicate — still open modal */ }
    setAddingCart(false);
    setDeliveryModal(true);
  };

  const callDelivery = () => {
    Linking.openURL(`tel:${deliveryPhone.replace(/[\s\-]/g, '')}`);
  };

  const callVendor = () => {
    if (product.vendor?.phone) {
      Linking.openURL(`tel:${product.vendor.phone.replace(/[\s\-]/g, '')}`);
    }
  };

  const openOfferModal = () => {
    if (!user) { navigation.navigate('Login'); return; }
    setOfferPrice(String(Math.floor(Number(price) * 0.9))); // pre-fill 90% as a hint
    setOfferNote('');
    setOfferModal(true);
  };

  const sendOffer = async () => {
    const amount = parseFloat(offerPrice);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid offer price.');
      return;
    }
    setSendingOffer(true);
    try {
      // 1. Add product to cart
      await client.post('/cart', { product_id: product.id, quantity: 1 });

      // 2. Create offer thread
      const res = await client.post('/offers', {
        product_id:    product.id,
        offered_price: amount,
        message:       offerNote.trim() || `I would like to offer UGX ${amount.toLocaleString()} for "${product.name}".`,
      });
      
      setOfferModal(false);
      setOfferSentModal(true);
      setSendingOffer(false);
      // Store the thread info for navigation after closing modal
      setOfferThreadInfo({ threadId: res.data.thread.id, productName: product.name });
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not send offer.');
    } finally {
      setSendingOffer(false);
    }
  };

  return (
    <>
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Main image */}
      <Image source={{ uri: imgUri(images[mainImg]) }} style={styles.mainImage} resizeMode="cover" />

      {/* Thumbnails */}
      {images.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
          {images.map((img, i) => (
            <TouchableOpacity key={i} onPress={() => setMainImg(i)}>
              <Image
                source={{ uri: imgUri(img) }}
                style={[styles.thumb, mainImg === i && styles.thumbActive]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.body}>
        {/* Title + wishlist */}
        <View style={styles.titleRow}>
          <Text style={styles.name}>{product.name}</Text>
          <TouchableOpacity onPress={toggleWishlist}>
            <MaterialCommunityIcons
              name={inWishlist ? 'heart' : 'heart-outline'}
              size={26}
              color={inWishlist ? COLORS.danger : '#999'}
            />
          </TouchableOpacity>
        </View>

        {product.nickname && <Text style={styles.nick}>"{product.nickname}"</Text>}

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>UGX {Number(price).toLocaleString()}</Text>
          {product.discount_price && (
            <Text style={styles.original}>UGX {Number(product.price).toLocaleString()}</Text>
          )}
          {product.discount_percent > 0 && (
            <View style={styles.discBadge}><Text style={styles.discText}>-{product.discount_percent}%</Text></View>
          )}
        </View>

        {/* Vendor card */}
        {product.vendor && (
          <View style={styles.vendorCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vendorLabel}>Sold by</Text>
                <View style={styles.vendorNameRow}>
                  <Text style={styles.vendorName}>{product.vendor.name}</Text>
                  {product.vendor.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <MaterialCommunityIcons name="check-decagram" size={14} color="#f59e0b" />
                      <Text style={styles.verifiedText}>Verified Vendor</Text>
                    </View>
                  )}
                </View>
                {product.vendor.vendor_profile?.location && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <MaterialCommunityIcons name="map-marker-outline" size={16} color="#64748b" />
                    <Text style={styles.vendorLoc}>{product.vendor.vendor_profile.location}</Text>
                  </View>
                )}
              </View>
              {product.vendor?.phone && (
                <TouchableOpacity style={styles.callVendorBtn} onPress={callVendor}>
                  <MaterialCommunityIcons name="phone" size={16} color="#fff" />
                  <Text style={styles.callVendorText}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Description */}
        {product.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.desc}>{product.description}</Text>
          </View>
        ) : null}

        {/* Info pills */}
        <View style={styles.infoRow}>
          {product.condition  && <View style={styles.infoPill}><Text style={styles.infoPillText}>{product.condition}</Text></View>}
          {product.location   && (
            <View style={styles.infoPill}>
              <MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.primary} />
              <Text style={styles.infoPillText}>{product.location}</Text>
            </View>
          )}
          {product.available_stock != null && product.available_stock > 0 && <View style={styles.infoPill}><Text style={styles.infoPillText}>Stock: {product.available_stock}</Text></View>}
        </View>

        {/* Sold-out banner */}
        {product.is_sold_out && (
          <View style={styles.soldBanner}>
            <MaterialCommunityIcons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.soldBannerText}>This product is Sold Out</Text>
          </View>
        )}

        {/* Actions — hidden when sold out */}
        {!product.is_sold_out && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnPrimary} onPress={addToCart} disabled={addingCart}>
              {addingCart ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="shopping-outline" size={18} color="#fff" />
                  <Text style={styles.btnText}>Add to Cart</Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Make an Offer — only shown when the logged-in user is NOT the vendor */}
            {(!user || user.id !== product.vendor_id) && (
              <TouchableOpacity style={styles.btnOffer} onPress={openOfferModal}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="message-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.btnOfferText}>Make an Offer</Text>
                </View>
              </TouchableOpacity>
            )}
            {product.delivery_available && (
              <TouchableOpacity style={styles.btnOutline} onPress={openDeliveryModal} disabled={addingCart}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="truck-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.btnOutlineText}>Request Delivery</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
        {/* Quick Navigation Strip */}
        <View style={styles.navStrip}>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={16} color="#555" />
            <Text style={styles.navBtnLabel}>Back</Text>
          </TouchableOpacity>
          <View style={styles.navDivider} />
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}>
            <MaterialCommunityIcons name="home-outline" size={16} color="#555" />
            <Text style={styles.navBtnLabel}>Dashboard</Text>
          </TouchableOpacity>
          <View style={styles.navDivider} />
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}>
            <MaterialCommunityIcons name="earth" size={16} color="#555" />
            <Text style={styles.navBtnLabel}>Homepage</Text>
          </TouchableOpacity>
          <View style={styles.navDivider} />
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}>
            <MaterialCommunityIcons name="package-outline" size={16} color="#555" />
            <Text style={styles.navBtnLabel}>Products</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Ratings & Reviews ─── */}
        <View style={styles.rvSection}>
          <View style={styles.rvHeader}>
            <Text style={styles.rvHeaderTitle}>Ratings &amp; Reviews</Text>
            {reviewsMeta.average_rating ? (
              <View style={styles.rvAvgRow}>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[1,2,3,4,5].map(i => (
                    <MaterialCommunityIcons key={i} name={i <= Math.round(reviewsMeta.average_rating) ? 'star' : 'star-outline'} size={14} color="#f59e0b" />
                  ))}
                </View>
                <Text style={styles.rvAvgNum}>{reviewsMeta.average_rating}</Text>
                <Text style={styles.rvAvgCount}>({reviewsMeta.reviews_count})</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rvImmutable}>Reviews cannot be removed by vendors.</Text>

          {/* Submit form */}
          {rvDone ? (
            <View style={styles.rvSuccess}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" style={{ marginRight: 8 }} />
              <Text style={styles.rvSuccessText}>Thank you! Your review has been posted.</Text>
            </View>
          ) : (
            <View style={styles.rvForm}>
              <Text style={styles.rvFormTitle}>Leave a Review</Text>
              {rvError ? <Text style={styles.rvError}>{rvError}</Text> : null}

              {!user && (
                <>
                  <Text style={styles.rvLabel}>Your Name *</Text>
                  <TextInput
                    style={styles.rvInput}
                    value={rvName}
                    onChangeText={setRvName}
                    placeholder="e.g. John Doe"
                    placeholderTextColor="#aaa"
                    maxLength={100}
                  />
                </>
              )}

              <Text style={styles.rvLabel}>Rating *</Text>
              <View style={styles.rvStarRow}>
                {[1,2,3,4,5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setRvRating(n)}>
                    <MaterialCommunityIcons name={n <= rvRating ? 'star' : 'star-outline'} size={28} color={n <= rvRating ? '#f59e0b' : '#cbd5e1'} />
                  </TouchableOpacity>
                ))}
                {rvRating > 0 && <Text style={styles.rvStarLabel}>{starLabel[rvRating]}</Text>}
              </View>

              <Text style={styles.rvLabel}>Comment *</Text>
              <TextInput
                style={[styles.rvInput, { height: 80, textAlignVertical: 'top' }]}
                value={rvComment}
                onChangeText={setRvComment}
                multiline
                placeholder="Share your experience with this product..."
                placeholderTextColor="#aaa"
                maxLength={1000}
              />
              <Text style={styles.rvChar}>{rvComment.length}/1000</Text>

              <TouchableOpacity
                style={[styles.rvSubmitBtn, rvSubmitting && { opacity: 0.6 }]}
                onPress={submitReview}
                disabled={rvSubmitting}
              >
                {rvSubmitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.rvSubmitText}>Post Review</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Review cards */}
          {reviews.map(r => (
            <View key={r.id} style={styles.rvCard}>
              <View style={styles.rvCardTop}>
                <View style={styles.rvAvatar}>
                  <Text style={styles.rvAvatarText}>{r.reviewer_name?.charAt(0)?.toUpperCase() || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rvReviewerName}>{r.reviewer_name}</Text>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[1,2,3,4,5].map(i => (
                      <MaterialCommunityIcons key={i} name={i <= r.rating ? 'star' : 'star-outline'} size={12} color="#f59e0b" />
                    ))}
                  </View>
                </View>
                <Text style={styles.rvCardDate}>
                  {new Date(r.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' })}
                </Text>
              </View>
              <Text style={styles.rvCardComment}>{r.comment}</Text>
            </View>
          ))}

          {reviewsLoading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />}

          {reviewsPage < reviewsLastPage && !reviewsLoading && (
            <TouchableOpacity style={styles.rvLoadMore} onPress={() => loadReviews(reviewsPage + 1)}>
              <Text style={styles.rvLoadMoreText}>Load more reviews</Text>
            </TouchableOpacity>
          )}

          {!reviewsLoading && reviews.length === 0 && (
            <Text style={styles.rvEmpty}>No reviews yet — be the first!</Text>
          )}
        </View>

      </View>
    </ScrollView>

    {/* Delivery Modal */}
    <Modal
      visible={deliveryModal}
      transparent
      animationType="slide"
      onRequestClose={() => setDeliveryModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <MaterialCommunityIcons name="truck-outline" size={22} color={COLORS.primary} />
            <Text style={styles.modalTitle}>Request Delivery</Text>
          </View>
          <Text style={styles.modalSub}>{product?.name}</Text>
          <Text style={styles.deliveryNote}>
            This product has been added to your cart. Call the delivery company below to arrange delivery to your location.
          </Text>
          <View style={styles.deliveryCard}>
            <Text style={styles.deliveryLabel}>Delivery Company</Text>
            <TouchableOpacity style={styles.phoneBtn} onPress={callDelivery}>
              <MaterialCommunityIcons name="phone" size={16} color={COLORS.primary} />
              <Text style={styles.phoneBtnText}>{deliveryPhone}</Text>
            </TouchableOpacity>
            <Text style={styles.deliveryHint}>Tap to call directly</Text>
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.confirmBtn, { flex: 1, backgroundColor: COLORS.primary }]}
              onPress={callDelivery}
            >
              <MaterialCommunityIcons name="phone" size={16} color="#fff" />
              <Text style={styles.confirmBtnText}>Call Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeliveryModal(false)}>
              <Text style={styles.cancelBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Make an Offer Modal */}
    <Modal
      visible={offerModal}
      transparent
      animationType="slide"
      onRequestClose={() => setOfferModal(false)}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <MaterialCommunityIcons name="message-outline" size={22} color={COLORS.primary} />
            <Text style={styles.modalTitle}>Make an Offer</Text>
          </View>
          <Text style={styles.modalSub}>
            Listed price: <Text style={{ color: COLORS.primary, fontWeight: '700' }}>UGX {Number(price).toLocaleString()}</Text>
          </Text>

          <Text style={styles.inputLabel}>Your Offer Price (UGX)</Text>
          <TextInput
            style={styles.offerInput}
            value={offerPrice}
            onChangeText={setOfferPrice}
            keyboardType="numeric"
            placeholder="Enter your offer amount"
            placeholderTextColor="#aaa"
          />

          <Text style={styles.inputLabel}>Message to Vendor (optional)</Text>
          <TextInput
            style={[styles.offerInput, { height: 80, textAlignVertical: 'top' }]}
            value={offerNote}
            onChangeText={setOfferNote}
            multiline
            placeholder="Explain your offer or ask a question..."
            placeholderTextColor="#aaa"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setOfferModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, sendingOffer && { opacity: 0.6 }]}
              onPress={sendOffer}
              disabled={sendingOffer}
            >
              {sendingOffer
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Send Offer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Offer Sent Success Modal */}
    <Modal
      visible={offerSentModal}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.offerSentOverlay}>
        <View style={styles.offerSentBox}>
          <View style={styles.offerSentIconWrap}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#fff" />
          </View>
          <Text style={styles.offerSentTitle}>Offer has been sent!</Text>
          <Text style={styles.offerSentText}>
            Your offer has been sent to the vendor. They will review it and respond shortly.
          </Text>
          <TouchableOpacity
            style={styles.offerSentBtn}
            onPress={() => {
              setOfferSentModal(false);
              if (offerThreadInfo) {
                navigation.navigate('OfferChat', {
                  threadId: offerThreadInfo.threadId,
                  productName: offerThreadInfo.productName,
                });
              }
            }}
          >
            <Text style={styles.offerSentBtnText}>View My Offers</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: '#f8f9fc' },
  mainImage   : { width, height: width, backgroundColor: '#eef0f6' },
  thumbRow    : { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f0f2f8', backgroundColor: '#fff' },
  thumb       : { width: 62, height: 62, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  thumbActive : { borderColor: COLORS.primary },
  body        : { padding: 16, backgroundColor: '#fff', marginBottom: 12 },
  titleRow    : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name        : { fontSize: 20, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 12 },
  nick        : { color: '#888', fontStyle: 'italic', marginTop: 2 },
  priceRow    : { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  price       : { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  original    : { fontSize: 14, color: '#aaa', textDecorationLine: 'line-through' },
  discBadge   : { backgroundColor: '#fff3e6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discText    : { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  vendorCard    : { backgroundColor: '#f6f7fb', borderRadius: 14, padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#e8eaf2' },
  vendorLabel   : { fontSize: 11, color: '#888', marginBottom: 2 },
  vendorNameRow : { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  vendorName    : { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  verifiedBadge : { backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: '#86efac' },
  verifiedText  : { fontSize: 11, color: '#16a34a', fontWeight: '800' },
  vendorLoc     : { fontSize: 12, color: '#555', marginTop: 4 },
  callVendorBtn : { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  callVendorText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  section     : { marginTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  desc        : { color: '#555', fontSize: 14, lineHeight: 22 },
  infoRow     : { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  infoPill    : { backgroundColor: '#f2f2f2', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  infoPillText: { fontSize: 12, color: '#555' },
  soldBanner  : { backgroundColor: '#fef2f2', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginTop: 16, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  soldBannerText: { color: '#dc2626', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  actions     : { gap: 10, marginTop: 24 },
  btnPrimary  : { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  btnText     : { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnOffer    : { backgroundColor: '#00442B', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnOfferText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnOutline  : { borderWidth: 2, borderColor: COLORS.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnOutlineText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },

  // Offer modal
  modalOverlay  : { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox      : { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle    : { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  modalSub      : { fontSize: 14, color: '#555', marginBottom: 16 },
  inputLabel    : { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  offerInput    : { backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1a1a1a', marginBottom: 14 },
  modalActions  : { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn     : { flex: 1, borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelBtnText : { color: '#888', fontWeight: '600', fontSize: 14 },
  confirmBtn    : { flex: 2, borderRadius: 10, paddingVertical: 12, backgroundColor: '#1e40af', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Delivery modal extras
  deliveryNote  : { fontSize: 13, color: '#555', lineHeight: 19, marginBottom: 14 },
  deliveryCard  : { backgroundColor: '#fff8ee', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#fed7aa' },
  deliveryLabel : { fontSize: 11, color: '#888', marginBottom: 8 },
  phoneBtn      : { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginBottom: 6 },
  phoneBtnText  : { color: '#fff', fontWeight: '700', fontSize: 16 },
  deliveryHint  : { fontSize: 11, color: '#aaa', textAlign: 'center' },

  // Quick navigation strip
  navStrip      : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 8, backgroundColor: '#f5f5f5', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4 },
  navBtn        : { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navBtnIcon    : { fontSize: 18, marginBottom: 3 },
  navBtnLabel   : { fontSize: 10, color: '#555', fontWeight: '600', textAlign: 'center' },
  navDivider    : { width: 1, height: 32, backgroundColor: '#e0e0e0' },

  // Reviews
  rvSection     : { marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderColor: '#f1f5f9' },
  rvHeader      : { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 },
  rvHeaderTitle : { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  rvAvgRow      : { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rvAvgStars    : { color: '#f59e0b', fontSize: 14, letterSpacing: 2 },
  rvAvgNum      : { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  rvAvgCount    : { fontSize: 12, color: '#94a3b8' },
  rvImmutable   : { fontSize: 11, color: '#94a3b8', marginBottom: 14 },
  rvSuccess     : { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#bbf7d0' },
  rvSuccessText : { color: '#15803d', fontWeight: '700', fontSize: 14 },
  rvForm        : { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  rvFormTitle   : { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  rvError       : { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, color: '#dc2626', fontSize: 13, marginBottom: 10 },
  rvLabel       : { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, marginTop: 8 },
  rvInput       : { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#0f172a' },
  rvStarRow     : { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 },
  rvStar        : { fontSize: 28, color: '#d1d5db' },
  rvStarOn      : { color: '#f59e0b' },
  rvStarLabel   : { fontSize: 13, color: '#64748b', marginLeft: 6, fontStyle: 'italic' },
  rvChar        : { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 2, marginBottom: 8 },
  rvSubmitBtn   : { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  rvSubmitText  : { color: '#fff', fontWeight: '700', fontSize: 15 },
  rvCard        : { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 12, padding: 12, marginBottom: 10 },
  rvCardTop     : { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  rvAvatar      : { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  rvAvatarText  : { color: '#fff', fontWeight: '700', fontSize: 14 },
  rvReviewerName: { fontWeight: '700', fontSize: 13, color: '#0f172a' },
  rvCardStars   : { color: '#f59e0b', fontSize: 13, letterSpacing: 1 },
  rvCardDate    : { fontSize: 11, color: '#94a3b8' },
  rvCardComment : { fontSize: 13, color: '#334155', lineHeight: 20 },
  rvLoadMore    : { borderWidth: 1, borderStyle: 'dashed', borderColor: '#e2e8f0', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
  rvLoadMoreText: { color: '#64748b', fontSize: 13 },
  rvEmpty       : { textAlign: 'center', color: '#94a3b8', fontSize: 13, paddingVertical: 20 },

  // Offer Sent Success Modal
  offerSentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  offerSentBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  offerSentIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  offerSentTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  offerSentText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  offerSentBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  offerSentBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

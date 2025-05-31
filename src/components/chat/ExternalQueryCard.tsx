import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const {width: screenWidth} = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.65; // Reduced width to prevent overflow

interface OrganicResult {
  position: number;
  title: string;
  link: string;
  displayedLink: string;
  source: string;
  snippet: string;
  images?: string[];
}

interface ExternalQueryResultProps {
  data: {
    organicResults?: OrganicResult[];
    relatedSearches?: Array<{query: string; link: string}>;
    immersiveProducts?: Array<{
      title: string;
      price: string;
      delivery?: string;
      source: string;
      link?: string;
      image?: string;
    }>;
  };
  queryType: 'weather' | 'restaurant' | 'shop' | 'general';
}

const ExternalQueryCard: React.FC<ExternalQueryResultProps> = ({
  data,
  queryType,
}) => {
  // Add debugging
  console.log('ExternalQueryCard rendering with data:', {
    queryType,
    hasOrganicResults: !!data?.organicResults,
    organicResultsLength: data?.organicResults?.length || 0,
    hasRelatedSearches: !!data?.relatedSearches,
    relatedSearchesLength: data?.relatedSearches?.length || 0,
    hasProducts: !!data?.immersiveProducts,
    productsLength: data?.immersiveProducts?.length || 0,
  });

  const handleCardPress = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
  };

  const getCardIcon = (type: string) => {
    switch (type) {
      case 'weather':
        return 'cloud-outline';
      case 'restaurant':
        return 'restaurant-outline';
      case 'shop':
        return 'storefront-outline';
      default:
        return 'search-outline';
    }
  };

  const getCardColor = (type: string) => {
    switch (type) {
      case 'weather':
        return '#87CEEB';
      case 'restaurant':
        return '#FFB84D';
      case 'shop':
        return '#98D8C8';
      default:
        return '#0081FB';
    }
  };

  const renderOrganicResults = () => {
    console.log('Checking organic results:', data.organicResults);
    
    if (!data.organicResults || data.organicResults.length === 0) {
      console.log('No organic results found');
      return (
        <View style={styles.section}>
          <Text style={styles.debugText}>No organic results available</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name={getCardIcon(queryType)}
            size={16}
            color={getCardColor(queryType)}
          />
          <Text style={styles.sectionTitle}>Results ({data.organicResults.length})</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsContainer}
          style={styles.horizontalScroll}
          nestedScrollEnabled={true} // Important for nested scrolling
          >
          {data.organicResults.slice(0, 5).map((result, index) => (
            <TouchableOpacity
              key={`result-${index}`}
              style={[
                styles.resultCard,
                {borderLeftColor: getCardColor(queryType)},
              ]}
              onPress={() => handleCardPress(result.link)}>
              {result.images && result.images.length > 0 && (
                <Image
                  source={{uri: result.images[0]}}
                  style={styles.cardImage}
                  resizeMode="cover"
                  onError={(error) => console.log('Image load error:', error)}
                />
              )}
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {result.title || 'No title'}
                </Text>
                <Text style={styles.cardSource}>{result.source || 'Unknown source'}</Text>
                <Text style={styles.cardSnippet} numberOfLines={2}>
                  {result.snippet || 'No description available'}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardLink} numberOfLines={1}>
                    {result.displayedLink || result.link || 'No link'}
                  </Text>
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color="#0081FB"
                    style={styles.linkIcon}
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderProducts = () => {
    if (!data.immersiveProducts || data.immersiveProducts.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bag-outline" size={16} color="#FFB84D" />
          <Text style={styles.sectionTitle}>Products ({data.immersiveProducts.length})</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsContainer}
          style={styles.horizontalScroll}
          nestedScrollEnabled={true}>
          {data.immersiveProducts.slice(0, 5).map((product, index) => (
            <TouchableOpacity
              key={`product-${index}`}
              style={[styles.productCard, {borderLeftColor: '#FFB84D'}]}
              onPress={() =>
                product.link && handleCardPress(product.link)
              }>
              {product.image && (
                <Image
                  source={{uri: product.image}}
                  style={styles.productImage}
                  resizeMode="cover"
                  onError={(error) => console.log('Product image load error:', error)}
                />
              )}
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {product.title || 'No title'}
                </Text>
                <Text style={styles.productPrice}>{product.price || 'Price not available'}</Text>
                {product.delivery && (
                  <Text style={styles.productDelivery}>{product.delivery}</Text>
                )}
                <Text style={styles.cardSource}>{product.source || 'Unknown source'}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderRelatedSearches = () => {
    if (!data.relatedSearches || data.relatedSearches.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bulb-outline" size={16} color="#9B59B6" />
          <Text style={styles.sectionTitle}>Related ({data.relatedSearches.length})</Text>
        </View>
      </View>
    );
  };

  // If no data at all, show a fallback
  if (!data) {
    return (
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.debugText}>No external data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderOrganicResults()}
      {renderProducts()}
      {renderRelatedSearches()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 8,
    // Crucial: Ensure the container doesn't expand beyond its content
    alignSelf: 'stretch',
    flexShrink: 1,
  },
  section: {
    marginBottom: 12, // Reduced margin
    // Ensure sections don't overflow
    alignSelf: 'stretch',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Reduced margin
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14, // Slightly smaller
    fontWeight: '600',
    color: '#333333',
    marginLeft: 8,
  },
  horizontalScroll: {
    // Fixed height to prevent layout issues
    height: 150, // Fixed height instead of minHeight
  },
  horizontalScrollSmall: {
    // Fixed height for related searches
    height: 50,
  },
  cardsContainer: {
    paddingLeft: 4,
    paddingRight: 16,
    paddingVertical: 4,
    // Remove minHeight to prevent expansion
  },
  resultCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginRight: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1, // Reduced shadow
    },
    shadowOpacity: 0.1,
    shadowRadius: 2, // Reduced shadow
    elevation: 2, // Reduced elevation
    // Fixed height to prevent expansion
    height: 140,
  },
  productCard: {
    width: CARD_WIDTH * 0.8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginRight: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    // Fixed height to prevent expansion
    height: 130,
  },
  cardImage: {
    width: '100%',
    height: 60, // Reduced height
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  productImage: {
    width: '100%',
    height: 50, // Reduced height
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  cardContent: {
    padding: 8, // Reduced padding
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 13, // Reduced font size
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
    lineHeight: 16,
  },
  cardSource: {
    fontSize: 11, // Reduced font size
    color: '#0081FB',
    fontWeight: '500',
    marginBottom: 2,
  },
  cardSnippet: {
    fontSize: 11, // Reduced font size
    color: '#666666',
    lineHeight: 14,
    marginBottom: 4,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLink: {
    fontSize: 10, // Reduced font size
    color: '#888888',
    flex: 1,
  },
  linkIcon: {
    marginLeft: 8,
  },
  productPrice: {
    fontSize: 14, // Reduced font size
    fontWeight: '700',
    color: '#2E8B57',
    marginBottom: 2,
  },
  productDelivery: {
    fontSize: 10, // Reduced font size
    color: '#666666',
    marginBottom: 2,
  },
  relatedContainer: {
    paddingLeft: 4,
    paddingRight: 16,
    paddingVertical: 4,
  },
  relatedChip: {
    backgroundColor: 'rgba(155, 89, 182, 0.1)',
    borderRadius: 16, // Reduced border radius
    paddingHorizontal: 10, // Reduced padding
    paddingVertical: 6, // Reduced padding
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 160, // Reduced max width
    height: 32, // Reduced height
  },
  relatedText: {
    fontSize: 12, // Reduced font size
    color: '#9B59B6',
    fontWeight: '500',
    marginRight: 4,
    flex: 1,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    padding: 8,
  },
});

export default ExternalQueryCard;
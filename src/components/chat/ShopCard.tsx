import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ShopItem {
  title: string;
  link: string;
  price?: string;
  source?: string;
  snippet?: string;
  position?: number;
  displayedLink?: string;
}

interface ShopData {
  requestMetadata?: {
    id: string;
    status: string;
  };
  organicResults?: ShopItem[];    // Google search results
  shops?: ShopItem[];
  organic_results?: ShopItem[];
  shopping_results?: ShopItem[];
  results?: ShopItem[];
  items?: ShopItem[];
  searchResults?: ShopItem[];
  webResults?: ShopItem[];
}

interface ShopCardProps {
  data: ShopData | ShopItem[] | any;
}

const ShopCard: React.FC<ShopCardProps> = ({ data }) => {
  console.log('🛍️ ShopCard received data:', {
    dataType: typeof data,
    isArray: Array.isArray(data),
    keys: typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : null,
    organicResultsLength: data?.organicResults?.length,
    dataPreview: data,
  });

  // Extract shop items from various possible data structures
  const extractShopItems = (rawData: any): ShopItem[] => {
    // If it's already an array of items
    if (Array.isArray(rawData)) {
      return rawData;
    }

    // If it's an object, look for shop data in various possible fields
    if (typeof rawData === 'object' && rawData !== null) {
      // Enhanced list of possible shop data fields
      const possibleFields = [
        'organicResults',      // Google search results - most common
        'shops',
        'shopping_results',
        'organic_results',
        'results',
        'items',
        'products',
        'listings',
        'searchResults',
        'webResults',
      ];

      for (const field of possibleFields) {
        if (rawData[field] && Array.isArray(rawData[field])) {
          console.log(`🛍️ Found shop items in field: ${field} (${rawData[field].length} items)`);
          return rawData[field];
        }
      }

      // If no array fields found, check if there's nested data
      const nestedData = Object.values(rawData).find(
        value => typeof value === 'object' && value !== null && !Array.isArray(value)
      );
      
      if (nestedData) {
        return extractShopItems(nestedData);
      }
    }

    console.log('🛍️ No shop items found, returning empty array');
    return [];
  };

  const shopItems = extractShopItems(data);
  console.log(`🛍️ Extracted ${shopItems.length} shop items`);

  const handleOpenLink = async (link: string) => {
    try {
      const supported = await Linking.canOpenURL(link);
      if (supported) {
        await Linking.openURL(link);
      } else {
        console.log('Cannot open URL:', link);
      }
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  const formatPrice = (price?: string): string => {
    if (!price) return 'Price not available';
    
    // Clean up price string
    return price.replace(/^\$/, '$').trim();
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (shopItems.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="storefront" size={20} color="#FF6B6B" />
          <Text style={styles.title}>Search Results</Text>
        </View>
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No results found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="search" size={20} color="#FF6B6B" />
        <Text style={styles.title}>Search Results</Text>
        <Text style={styles.itemCount}>{shopItems.length} results</Text>
      </View>

      <ScrollView 
        style={styles.shopList}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}>
        {shopItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.shopItem}
            onPress={() => item.link && handleOpenLink(item.link)}
            activeOpacity={0.7}>
            
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title || 'Untitled Item'}
              </Text>
              {item.position && (
                <Text style={styles.position}>#{item.position}</Text>
              )}
            </View>

            {item.snippet && (
              <Text style={styles.itemSnippet} numberOfLines={3}>
                {item.snippet}
              </Text>
            )}

            <View style={styles.itemFooter}>
              <View style={styles.sourceContainer}>
                {item.source && (
                  <Text style={styles.source}>
                    📍 {item.source}
                  </Text>
                )}
                {item.displayedLink && (
                  <Text style={styles.displayedLink}>
                    🔗 {item.displayedLink}
                  </Text>
                )}
                {item.price && (
                  <Text style={styles.price}>
                    💰 {formatPrice(item.price)}
                  </Text>
                )}
              </View>
              
              <View style={styles.linkContainer}>
                <Ionicons name="open-outline" size={16} color="#FF6B6B" />
                <Text style={styles.linkText}>Open</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={14} color="#999" />
        <Text style={styles.footerText}>
          Tap any result to open in browser
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  itemCount: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#fff5f5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffebeb',
  },
  shopList: {
    maxHeight: 400,
  },
  shopItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
    lineHeight: 22,
  },
  position: {
    fontSize: 12,
    color: '#FF6B6B',
    backgroundColor: '#fff5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    fontWeight: '600',
  },
  itemSnippet: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sourceContainer: {
    flex: 1,
    marginRight: 12,
  },
  source: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  displayedLink: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffebeb',
  },
  linkText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
    marginLeft: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  noResults: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default ShopCard;
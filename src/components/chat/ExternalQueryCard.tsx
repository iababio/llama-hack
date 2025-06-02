import React from 'react';
import {View, StyleSheet} from 'react-native';
import WeatherCard from './WeatherCard';
import RestaurantCard from './RestaurantCard';
import ShopCard from './ShopCard';
import MenuCard from './MenuCard';

interface ExternalQueryCardProps {
  data: any;
  queryType: 'weather' | 'restaurant' | 'shop' | 'general';
  onMoreDetails?: (response: string) => void;
  onOrderSelected?: (selectedItems: any[]) => void;
}

// Enhanced helper function to detect weather data
const isWeatherData = (data: any): boolean => {
  console.log('🌤️ Checking if data is weather data:', {
    dataType: typeof data,
    isArray: Array.isArray(data),
    keys: typeof data === 'object' ? Object.keys(data) : null,
    data: typeof data === 'string' ? data.substring(0, 100) + '...' : data,
  });

  if (!data) {
    console.log('❌ No data provided');
    return false;
  }

  // Check if it's a string that contains weather-related keywords
  if (typeof data === 'string') {
    const weatherKeywords = [
      'temperature',
      'weather',
      'forecast',
      'humidity',
      'wind',
      'precipitation',
      'celsius',
      'fahrenheit',
      'sunny',
      'cloudy',
      'rainy',
      'snow',
    ];
    const dataLower = data.toLowerCase();
    const hasWeatherKeywords = weatherKeywords.some(keyword =>
      dataLower.includes(keyword),
    );
    console.log('🌤️ String weather keyword check:', hasWeatherKeywords);
    return hasWeatherKeywords;
  }

  // Check for weather API structure in objects
  if (typeof data === 'object' && !Array.isArray(data)) {
    const weatherFields = [
      'temperature',
      'weather',
      'forecast',
      'current',
      'humidity',
      'wind_speed',
      'conditions',
      'temp',
    ];
    const hasWeatherFields = weatherFields.some(field => data[field]);
    console.log('🌤️ Object weather field check:', hasWeatherFields);
    return hasWeatherFields;
  }

  console.log('❌ Data type not supported for weather detection');
  return false;
};

// Enhanced helper function to detect shop data
const isShopData = (data: any): boolean => {
  console.log('🛍️ Checking if data is shop data:', {
    dataType: typeof data,
    isArray: Array.isArray(data),
    keys: typeof data === 'object' ? Object.keys(data) : null,
    hasOrganicResults: data && typeof data === 'object' && data.organicResults,
  });

  if (!data) {
    console.log('❌ No data provided');
    return false;
  }

  // Check if it's an array of shop items
  if (Array.isArray(data)) {
    const hasShopFields = data.some(
      item =>
        item &&
        typeof item === 'object' &&
        (item.title || item.price || item.link || item.source),
    );
    console.log('🛍️ Array shop item check:', hasShopFields);
    return hasShopFields;
  }

  // Check for shop data structure in objects
  if (typeof data === 'object' && !Array.isArray(data)) {
    // Enhanced list of possible shop data fields
    const shopFields = [
      'organicResults', // Google search results
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

    // Check if any of these fields contain array data
    for (const field of shopFields) {
      if (data[field] && Array.isArray(data[field])) {
        console.log(
          `🛍️ Found shop data in field: ${field} with ${data[field].length} items`,
        );

        // Verify the array contains shop-like items
        const firstItem = data[field][0];
        if (
          firstItem &&
          typeof firstItem === 'object' &&
          (firstItem.title ||
            firstItem.link ||
            firstItem.snippet ||
            firstItem.displayedLink ||
            firstItem.source)
        ) {
          console.log('🛍️ Confirmed shop data structure');
          return true;
        }
      }
    }

    // Check for requestMetadata structure (common in shop APIs)
    if (data.requestMetadata) {
      console.log('🛍️ Found requestMetadata, checking nested fields...');
      return isShopData({...data, requestMetadata: undefined}); // Recursive check without metadata
    }

    console.log('🛍️ No shop fields found in object');
    return false;
  }

  console.log('❌ Data type not supported for shop detection');
  return false;
};

const ExternalQueryCard: React.FC<ExternalQueryCardProps> = ({
  data,
  queryType,
  onMoreDetails,
  onOrderSelected,
}) => {
  console.log('🎴 ExternalQueryCard received:', {
    queryType,
    dataType: typeof data,
    dataPreview:
      typeof data === 'string' ? data.substring(0, 100) + '...' : data,
    keys:
      typeof data === 'object' && !Array.isArray(data)
        ? Object.keys(data)
        : null,
  });

  // Check if data contains menu_items (menu data) - highest priority
  if (
    data &&
    typeof data === 'object' &&
    data.menu_items &&
    Array.isArray(data.menu_items)
  ) {
    console.log('🍽️ Rendering MenuCard');
    return (
      <View style={styles.container}>
        <MenuCard
          data={data}
          onMoreDetails={onMoreDetails}
          onOrderSelected={onOrderSelected}
        />
      </View>
    );
  }

  // Check if data contains weather information
  if (isWeatherData(data)) {
    console.log('🌤️ Rendering WeatherCard');
    return (
      <View style={styles.container}>
        <WeatherCard data={data} />
      </View>
    );
  }

  // Check if data contains shop information
  if (isShopData(data)) {
    console.log('🛍️ Rendering ShopCard');
    return (
      <View style={styles.container}>
        <ShopCard data={data} />
      </View>
    );
  }

  // Existing logic for other query types based on queryType
  switch (queryType) {
    case 'weather':
      console.log('🌤️ Fallback: Rendering WeatherCard based on queryType');
      return (
        <View style={styles.container}>
          <WeatherCard data={data} />
        </View>
      );
    case 'restaurant':
      console.log('🍽️ Rendering RestaurantCard');
      return (
        <View style={styles.container}>
          <RestaurantCard data={data} />
        </View>
      );
    case 'shop':
      console.log('🛍️ Fallback: Rendering ShopCard based on queryType');
      return (
        <View style={styles.container}>
          <ShopCard data={data} />
        </View>
      );
    default:
      console.log('❓ No matching card type, returning null');
      return null;
  }
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 5,
  },
});

export default ExternalQueryCard;
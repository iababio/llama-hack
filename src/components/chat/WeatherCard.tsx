import React, {useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface WeatherData {
  location?: {
    name?: string;
    country?: string;
    region?: string;
    lat?: number;
    lon?: number;
    localtime?: string;
  };
  current?: {
    temp_c?: number;
    temp_f?: number;
    condition?: {
      text?: string;
      icon?: string;
      code?: number;
    };
    wind_mph?: number;
    wind_kph?: number;
    wind_dir?: string;
    pressure_mb?: number;
    pressure_in?: number;
    precip_mm?: number;
    precip_in?: number;
    humidity?: number;
    cloud?: number;
    feelslike_c?: number;
    feelslike_f?: number;
    vis_km?: number;
    vis_miles?: number;
    uv?: number;
    gust_mph?: number;
    gust_kph?: number;
  };
  forecast?: {
    forecastday?: Array<{
      date?: string;
      day?: {
        maxtemp_c?: number;
        maxtemp_f?: number;
        mintemp_c?: number;
        mintemp_f?: number;
        avgtemp_c?: number;
        avgtemp_f?: number;
        condition?: {
          text?: string;
          icon?: string;
        };
        maxwind_mph?: number;
        maxwind_kph?: number;
        totalprecip_mm?: number;
        totalprecip_in?: number;
        avghumidity?: number;
        daily_will_it_rain?: number;
        daily_chance_of_rain?: number;
        daily_will_it_snow?: number;
        daily_chance_of_snow?: number;
        uv?: number;
      };
    }>;
  };
}

interface WeatherCardProps {
  data: any;
}

const WeatherCard: React.FC<WeatherCardProps> = ({data}) => {
  const [useCelsius, setUseCelsius] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  console.log('🌤️ WeatherCard received data:', {
    dataType: typeof data,
    dataPreview: typeof data === 'string' ? data.substring(0, 200) : data
  });

  // Enhanced data parsing
  let weatherData: WeatherData = {};
  let isPlainText = false;
  
  if (typeof data === 'string') {
    console.log('📝 Processing string data...');
    
    // Try to extract JSON from markdown code blocks
    const jsonMatch = data.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      console.log('📋 Found JSON block, attempting to parse...');
      try {
        weatherData = JSON.parse(jsonMatch[1]);
        console.log('✅ Successfully parsed JSON from markdown:', weatherData);
      } catch (error) {
        console.log('❌ Failed to parse JSON from markdown:', error);
        isPlainText = true;
      }
    } else {
      // Try parsing the entire string as JSON
      try {
        weatherData = JSON.parse(data);
        console.log('✅ Successfully parsed entire string as JSON:', weatherData);
      } catch (error) {
        console.log('⚠️ String is not JSON, treating as plain text');
        isPlainText = true;
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    console.log('🏗️ Processing object data...');
    weatherData = data;
    console.log('✅ Using object directly as weather data:', weatherData);
  } else {
    console.log('❓ Unknown data type, treating as plain text');
    isPlainText = true;
  }

  // If it's plain text or parsing failed, show as text with weather styling
  if (isPlainText || (!weatherData.current && !weatherData.location && !weatherData.forecast)) {
    console.log('📄 Rendering as plain text weather info');
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="partly-sunny" size={20} color="#0081FB" />
          <Text style={styles.title}>Weather Information</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.dataText}>
            {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
          </Text>
        </View>
      </View>
    );
  }

  console.log('🎨 Rendering structured weather card with data:', {
    hasLocation: !!weatherData.location,
    hasCurrent: !!weatherData.current,
    hasForecast: !!weatherData.forecast
  });

  const getWeatherIcon = (condition?: string, code?: number) => {
    if (!condition && !code) return 'partly-sunny';
    
    const conditionLower = condition?.toLowerCase() || '';
    
    if (conditionLower.includes('sunny') || conditionLower.includes('clear')) {
      return 'sunny';
    } else if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
      return 'cloudy';
    } else if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
      return 'rainy';
    } else if (conditionLower.includes('snow')) {
      return 'snow';
    } else if (conditionLower.includes('storm') || conditionLower.includes('thunder')) {
      return 'thunderstorm';
    } else if (conditionLower.includes('fog') || conditionLower.includes('mist')) {
      return 'cloudy';
    }
    
    return 'partly-sunny';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getTemperature = (tempC?: number, tempF?: number) => {
    if (useCelsius && tempC !== undefined) {
      return `${Math.round(tempC)}°C`;
    } else if (!useCelsius && tempF !== undefined) {
      return `${Math.round(tempF)}°F`;
    } else if (tempC !== undefined) {
      return `${Math.round(tempC)}°C`;
    }
    return 'N/A';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity 
        style={styles.header} 
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}>
        <Ionicons 
          name={getWeatherIcon(weatherData.current?.condition?.text, weatherData.current?.condition?.code)} 
          size={20} 
          color="#0081FB" 
        />
        <Text style={styles.title}>Weather Information</Text>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color="#0081FB" 
          style={styles.expandIcon}
        />
      </TouchableOpacity>

      {/* Location */}
      {weatherData.location && (
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={16} color="#666" />
          <Text style={styles.locationText}>
            {weatherData.location.name}
            {weatherData.location.region && `, ${weatherData.location.region}`}
            {weatherData.location.country && `, ${weatherData.location.country}`}
          </Text>
        </View>
      )}

      {/* Current Weather */}
      {weatherData.current && (
        <View style={styles.currentWeather}>
          <View style={styles.mainInfo}>
            <View style={styles.temperatureContainer}>
              <Text style={styles.temperature}>
                {getTemperature(weatherData.current.temp_c, weatherData.current.temp_f)}
              </Text>
              <TouchableOpacity 
                style={styles.unitToggle}
                onPress={() => setUseCelsius(!useCelsius)}>
                <Text style={styles.unitText}>°{useCelsius ? 'F' : 'C'}</Text>
              </TouchableOpacity>
            </View>
            
            {weatherData.current.condition && (
              <View style={styles.conditionContainer}>
                <Ionicons 
                  name={getWeatherIcon(weatherData.current.condition.text)} 
                  size={24} 
                  color="#0081FB" 
                />
                <Text style={styles.conditionText}>
                  {weatherData.current.condition.text}
                </Text>
              </View>
            )}
          </View>

          {/* Feels Like */}
          {(weatherData.current.feelslike_c || weatherData.current.feelslike_f) && (
            <Text style={styles.feelsLike}>
              Feels like {getTemperature(weatherData.current.feelslike_c, weatherData.current.feelslike_f)}
            </Text>
          )}
        </View>
      )}

      {/* Show basic info when collapsed but has no current data */}
      {!isExpanded && !weatherData.current && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewText}>
            Weather information available - tap to expand
          </Text>
        </View>
      )}

      {/* Detailed Info - Only when expanded */}
      {isExpanded && weatherData.current && (
        <ScrollView style={styles.detailsContainer} nestedScrollEnabled={true}>
          <View style={styles.detailsGrid}>
            {weatherData.current.humidity !== undefined && (
              <View style={styles.detailItem}>
                <Ionicons name="water" size={16} color="#0081FB" />
                <Text style={styles.detailLabel}>Humidity</Text>
                <Text style={styles.detailValue}>{weatherData.current.humidity}%</Text>
              </View>
            )}

            {(weatherData.current.wind_kph || weatherData.current.wind_mph) && (
              <View style={styles.detailItem}>
                <Ionicons name="flag" size={16} color="#0081FB" />
                <Text style={styles.detailLabel}>Wind</Text>
                <Text style={styles.detailValue}>
                  {useCelsius 
                    ? `${weatherData.current.wind_kph} km/h` 
                    : `${weatherData.current.wind_mph} mph`
                  } {weatherData.current.wind_dir}
                </Text>
              </View>
            )}

            {(weatherData.current.pressure_mb || weatherData.current.pressure_in) && (
              <View style={styles.detailItem}>
                <Ionicons name="speedometer" size={16} color="#0081FB" />
                <Text style={styles.detailLabel}>Pressure</Text>
                <Text style={styles.detailValue}>
                  {useCelsius 
                    ? `${weatherData.current.pressure_mb} mb` 
                    : `${weatherData.current.pressure_in} in`
                  }
                </Text>
              </View>
            )}

            {(weatherData.current.vis_km || weatherData.current.vis_miles) && (
              <View style={styles.detailItem}>
                <Ionicons name="eye" size={16} color="#0081FB" />
                <Text style={styles.detailLabel}>Visibility</Text>
                <Text style={styles.detailValue}>
                  {useCelsius 
                    ? `${weatherData.current.vis_km} km` 
                    : `${weatherData.current.vis_miles} mi`
                  }
                </Text>
              </View>
            )}

            {weatherData.current.uv !== undefined && (
              <View style={styles.detailItem}>
                <Ionicons name="sunny" size={16} color="#0081FB" />
                <Text style={styles.detailLabel}>UV Index</Text>
                <Text style={styles.detailValue}>{weatherData.current.uv}</Text>
              </View>
            )}

            {weatherData.current.cloud !== undefined && (
              <View style={styles.detailItem}>
                <Ionicons name="cloud" size={16} color="#0081FB" />
                <Text style={styles.detailLabel}>Cloud Cover</Text>
                <Text style={styles.detailValue}>{weatherData.current.cloud}%</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Raw data for debugging when expanded */}
      {isExpanded && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Info:</Text>
          <ScrollView style={styles.debugScroll} nestedScrollEnabled={true}>
            <Text style={styles.debugText}>
              {JSON.stringify(weatherData, null, 2)}
            </Text>
          </ScrollView>
        </View>
      )}

      {/* Last Updated */}
      {weatherData.location?.localtime && (
        <View style={styles.footer}>
          <Ionicons name="time-outline" size={14} color="#999" />
          <Text style={styles.lastUpdated}>
            Updated: {new Date(weatherData.location.localtime).toLocaleTimeString()}
          </Text>
        </View>
      )}
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
    maxHeight: 500, // Increased for debug info
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
  expandIcon: {
    marginLeft: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  currentWeather: {
    padding: 16,
  },
  mainInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  temperatureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  temperature: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0081FB',
  },
  unitToggle: {
    marginLeft: 8,
    padding: 4,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
  },
  unitText: {
    fontSize: 12,
    color: '#0081FB',
    fontWeight: '600',
  },
  conditionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conditionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  feelsLike: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  previewContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  previewText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  detailsContainer: {
    maxHeight: 120,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  detailItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  detailValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  debugContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#f8f9fa',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    padding: 12,
  },
  debugScroll: {
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  debugText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#555',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#f8f9fa',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  content: {
    padding: 16,
  },
  dataText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default WeatherCard;
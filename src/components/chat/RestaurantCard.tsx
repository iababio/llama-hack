import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface RestaurantCardProps {
  data: any;
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({data}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="restaurant" size={20} color="#0081FB" />
        <Text style={styles.title}>Restaurant Information</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.dataText}>
          {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
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

export default RestaurantCard;
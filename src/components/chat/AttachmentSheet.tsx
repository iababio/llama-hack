/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Animated} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {IsDarkMode} from '../../utils/config';
import {ATTACHMENT_SHEET_HEIGHT} from './styles';

interface AttachmentSheetProps {
  translateY: Animated.Value;
  onOptionPress?: (option: string) => void;
}

const AttachmentSheet = ({translateY, onOptionPress}: AttachmentSheetProps) => {
  const isDark = IsDarkMode();
  const options = [
    {icon: 'camera', label: 'Camera', value: 'camera', color: '#0081FB'},
  ];

  const handleOptionPress = (optionValue: string) => {
    onOptionPress?.(optionValue);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          transform: [{translateY}],
        },
      ]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[
            styles.headerText,
            {color: isDark ? '#FFFFFF' : '#333333'}
          ]}>
          </Text>
        </View>

        {/* Options Grid */}
        <View style={styles.optionsGrid}>
          {options.map((option, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.option}
              onPress={() => handleOptionPress(option.value)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  {backgroundColor: option.color},
                ]}>
                <Ionicons
                  name={option.icon}
                  size={24}
                  color="#FFFFFF"
                />
              </View>
              <Text
                style={[
                  styles.optionLabel,
                  {color: isDark ? '#FFFFFF' : '#333333'},
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ATTACHMENT_SHEET_HEIGHT,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  content: {
    padding: 20,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  option: {
    width: '22%',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default AttachmentSheet;

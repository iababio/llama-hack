import { StyleSheet } from 'react-native';
import { Dimensions } from 'react-native';

export const windowHeight = Dimensions.get('window').height;

export const sharedStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '99%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#121212',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    position: 'relative',
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: '#DDDDDD',
    borderRadius: 3,
    position: 'absolute',
    top: 7,
    alignSelf: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.2,
  },
  // Rest of shared styles...
});

export const ATTACHMENT_SHEET_HEIGHT = 200;

import { Platform } from 'react-native';

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.terrampleo.com/api';
const API_URL = Platform.OS === 'android' ? rawApiUrl.replace('localhost', '10.0.2.2') : rawApiUrl;

export default {
  API_URL,
  SMS_MOCK: false,
};

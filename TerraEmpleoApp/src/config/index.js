import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || Platform.select({
  web: 'http://localhost:3000/api',
  android: 'http://10.0.2.2:3000/api',
  ios: 'http://localhost:3000/api',
  default: 'http://localhost:3000/api',
});

export default {
  API_URL,
  SMS_MOCK: true,
};
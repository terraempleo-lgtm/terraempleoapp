import { Platform } from 'react-native';

const API_URL = Platform.select({
  web: 'http://localhost:3000/api',
  android: 'http://10.0.2.2:3000/api',
  ios: 'http://localhost:3000/api',
  default: 'http://localhost:3000/api',
});
// Para dispositivo físico, cambiar a la IP de tu computadora:
// const API_URL = 'http://192.168.x.x:3000/api';

export default {
  API_URL,
  SMS_MOCK: true,
};

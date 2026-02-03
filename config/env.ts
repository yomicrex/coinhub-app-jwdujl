
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const ENV = {
  APP_SCHEME: 'coinhub',
  BACKEND_URL: Constants.expoConfig?.extra?.backendUrl || 'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev',
  PLATFORM: Platform.OS,
  IS_STANDALONE: Constants.appOwnership === 'standalone',
  IS_EXPO_GO: Constants.appOwnership === 'expo',
  APP_TYPE: Constants.appOwnership === 'standalone' ? 'standalone' : Constants.appOwnership === 'expo' ? 'expo-go' : 'unknown',
};

export default ENV;

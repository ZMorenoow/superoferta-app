import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import HomeScreen from '../../screens/HomeScreen';

export default function HomeTab() {
  const router = useRouter();

  const navigation = {
    navigate: async (screen, params) => {
      if (screen === 'Cart') {
        const token = await AsyncStorage.getItem('@auth_token');
        if (!token) {
          router.push('/login');
        } else {
          router.push('/cart');
        }
      }
      if (screen === 'ProductDetail') {
        router.push({
          pathname: '/product-detail',
          params: { product: JSON.stringify(params.product) },
        });
      }
      if (screen === 'Checkout') router.push('/checkout');
    },
    goBack: () => router.back(),
    replace: (screen, params) => {
      if (screen === 'OrderStatus') {
        router.replace({ pathname: '/order-status', params });
      }
    },
  };

  return <HomeScreen navigation={navigation} />;
}
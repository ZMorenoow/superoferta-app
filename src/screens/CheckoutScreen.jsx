// src/app/checkout.jsx
import { useRouter } from 'expo-router';
import CheckoutScreen from './CheckoutScreen';

export default function CheckoutPage() {
  const router = useRouter();

  const navigation = {
    goBack: () => router.back(),
    replace: (screen, params) => {
      if (screen === 'OrderStatus') router.replace({ pathname: '/order-status', params });
    },
  };

  return <CheckoutScreen navigation={navigation} />;
}
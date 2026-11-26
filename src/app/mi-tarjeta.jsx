import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OneclickPaymentSection from '../components/OneclickPaymentSection';

const PRIMARY = '#ED1D26';

export default function MiTarjetaScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Mi tarjeta</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.descriptionBlock}>
          <Ionicons name="card-outline" size={38} color={PRIMARY} />
          <Text style={styles.heading}>Tu tarjeta de pago</Text>
          <Text style={styles.description}>
            Administra tu tarjeta guardada en Oneclick de Transbank.
            Puedes registrar una tarjeta o eliminar la que tienes actualmente.
          </Text>
        </View>

        <OneclickPaymentSection mode="profile" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
  descriptionBlock: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  heading: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 21,
    textAlign: 'center',
  },
});
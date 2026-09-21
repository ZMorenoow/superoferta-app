import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistorialScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Historial</Text>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aún no hay pedidos completados</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', padding: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#aaa' },
});
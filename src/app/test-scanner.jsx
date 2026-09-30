import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BarcodeScanner from '../components/BarcodeScanner';

export default function TestScanner() {
  const [resultado, setResultado] = useState(null);

  const handleScanned = (data) => {
    setResultado(data);
    Alert.alert('Código detectado', data);
  };

  if (resultado) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>✅ Código leído:</Text>
        <Text style={styles.code}>{resultado}</Text>
      </SafeAreaView>
    );
  }

  return (
    <BarcodeScanner
      onScanned={handleScanned}
      onClose={() => Alert.alert('Cancelado')}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  code: { fontSize: 24, fontWeight: '900', color: '#C21807' },
});
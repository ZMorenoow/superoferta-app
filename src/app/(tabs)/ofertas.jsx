import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBar } from '../../context/TabBarContext';
import { supabase } from '../../utils/supabase';

const PRIMARY = '#C21807';

function OfertaImagen({ uri }) {
  const [ratio, setRatio] = useState(1644 / 2048);
  return (
    <Image
      source={{ uri }}
      style={[styles.image, { aspectRatio: ratio }]}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      onLoad={(e) => {
        const { width, height } = e.source;
        if (width && height) setRatio(width / height);
      }}
    />
  );
}

export default function OfertasScreen() {
  const { handleScroll } = useTabBar();
  const router = useRouter();
  const [ofertas, setOfertas] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargarOfertas = useCallback(async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, imagen_url, imagen_oferta')
      .eq('activo', true)
      .eq('en_oferta', true);
    if (error) console.log('ERROR OFERTAS:', error.message);
    setOfertas(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarOfertas();
    }, [cargarOfertas])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ofertas</Text>
        <Text style={styles.subtitle}>Precios rebajados por tiempo limitado 🔥</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {ofertas.length === 0 && (
            <Text style={styles.empty}>No hay ofertas por ahora 🛒</Text>
          )}

          {ofertas.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              style={styles.card}
              onPress={() =>
                router.push({ pathname: '/product-detail', params: { id: item.id } })
              }
            >
              <OfertaImagen uri={item.imagen_oferta || item.imagen_url} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  card: {
    borderRadius: 16, marginBottom: 14, overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  image: { width: '100%', backgroundColor: '#f2f2f2' },
});
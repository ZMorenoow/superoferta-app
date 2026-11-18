import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

// Muestra las fotos de evidencia de un pedido. Sirve para el picker y para el cliente:
// quien pueda ver el pedido (por RLS) puede ver sus fotos. Si no hay fotos, no muestra nada.
export default function EvidenciaGaleria({ pedidoId, titulo = 'Fotos del pedido' }) {
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grande, setGrande] = useState(null);

  useEffect(() => {
    let vivo = true;

    const cargar = async () => {
      if (!pedidoId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('pedido_evidencias')
        .select('id, ruta, created_at')
        .eq('id_pedido', pedidoId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error cargando evidencias', error);
      }
      if (error || !data?.length) {
        if (vivo) {
          setFotos([]);
          setLoading(false);
        }
        return;
      }

      // Bucket privado: se generan enlaces temporales (1 hora).
      const { data: firmadas, error: e2 } = await supabase.storage
        .from('evidencias')
        .createSignedUrls(
          data.map((d) => d.ruta),
          3600
        );
      if (e2) console.error('Error firmando fotos', e2);

      const porRuta = {};
      (firmadas ?? []).forEach((f) => {
        if (f.signedUrl) porRuta[f.path] = f.signedUrl;
      });

      if (vivo) {
        setFotos(
          data
            .map((d) => ({ id: d.id, uri: porRuta[d.ruta] }))
            .filter((f) => !!f.uri)
        );
        setLoading(false);
      }
    };

    cargar();
    return () => {
      vivo = false;
    };
  }, [pedidoId]);

  if (loading) {
    return <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />;
  }
  if (fotos.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.titulo}>{titulo}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
        {fotos.map((f) => (
          <TouchableOpacity key={f.id} onPress={() => setGrande(f.uri)} activeOpacity={0.8}>
            <Image source={{ uri: f.uri }} style={styles.mini} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!grande} transparent animationType="fade" onRequestClose={() => setGrande(null)}>
        <View style={styles.fondo}>
          {grande && <Image source={{ uri: grande }} style={styles.grande} resizeMode="contain" />}
          <TouchableOpacity style={styles.cerrar} onPress={() => setGrande(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  titulo: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 10 },
  fila: { gap: 10 },
  mini: { width: 110, height: 110, borderRadius: 12, backgroundColor: '#eee' },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  grande: { width: '100%', height: '80%' },
  cerrar: {
    position: 'absolute', top: 50, right: 20,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
});
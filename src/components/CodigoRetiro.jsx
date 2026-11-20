
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';
const VERDE = '#1B6B3A';

async function obtenerCodigo(pedidoId) {

  const viaRpc = await supabase.rpc('mi_codigo_retiro', { p_pedido: pedidoId });
  if (!viaRpc.error && viaRpc.data) return viaRpc.data;

  const { data } = await supabase
    .from('pedidos')
    .select('codigo_retiro')
    .eq('id', pedidoId)
    .maybeSingle();
  return data?.codigo_retiro ?? null;
}

export default function CodigoRetiro({ pedidoId, estado }) {
  const [codigo, setCodigo] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (estado !== 'completado' || !pedidoId) return;
    let vivo = true;
    setCargando(true);
    obtenerCodigo(pedidoId)
      .then((c) => vivo && setCodigo(c))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [pedidoId, estado]);

  if (estado === 'entregado') {
    return (
      <View style={[styles.card, { borderColor: VERDE, backgroundColor: '#f0fff4' }]}>
        <Ionicons name="checkmark-circle" size={30} color={VERDE} />
        <Text style={[styles.titulo, { color: VERDE }]}>Pedido entregado</Text>
        <Text style={styles.texto}>Gracias por tu compra.</Text>
      </View>
    );
  }

  if (estado !== 'completado') {
    if (!['pagado', 'asignado', 'en_proceso'].includes(estado)) return null;
    return (
      <View style={styles.card}>
        <Ionicons name="time-outline" size={28} color="#888" />
        <Text style={styles.titulo}>Estamos preparando tu pedido</Text>
        <Text style={styles.texto}>
          Cuando esté listo te avisaremos y aquí aparecerá tu código de retiro.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: PRIMARY }]}>
      <Text style={styles.etiqueta}>Tu pedido está listo</Text>
      {cargando ? (
        <ActivityIndicator color={PRIMARY} style={{ marginVertical: 18 }} />
      ) : (
        <Text style={styles.codigo} accessibilityLabel={`Código de retiro ${codigo ?? ''}`}>
          {codigo ?? '------'}
        </Text>
      )}
      <Text style={styles.texto}>
        Muestra este código al retirar en tienda. No lo compartas con nadie más.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#eee',
    padding: 20,
    alignItems: 'center',
    gap: 6,
    marginVertical: 12,
  },
  etiqueta: { fontSize: 14, fontWeight: '700', color: '#555' },
  codigo: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 8,
    color: PRIMARY,
    marginVertical: 8,
  },
  titulo: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  texto: { fontSize: 13, color: '#888', textAlign: 'center' },
});
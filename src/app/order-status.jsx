import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';
const VERDE = '#1B6B3A';

const formatCLP = (n) => `$${Number(n).toLocaleString('es-CL')}`;
const esperar = (ms) => new Promise((res) => setTimeout(res, ms));

const ESTADOS_PAGADOS = ['pagado', 'asignado', 'en_proceso', 'completado'];

// Espera total máxima a que se guarde la confirmación: MAX_INTENTOS * ESPERA_MS (≈ 10 s).
const MAX_INTENTOS = 8;
const ESPERA_MS = 1500;

export default function OrderStatusScreen() {
  const router = useRouter();
  const { pedido } = useLocalSearchParams();
  const [cargando, setCargando] = useState(true);
  const [resultado, setResultado] = useState(null); // 'pagado' | 'no_pagado' | 'error'
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    let activo = true;

    const vaciarCarrito = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: carrito } = await supabase
        .from('carrito')
        .select('id')
        .eq('id_cliente', user.id)
        .maybeSingle();
      if (carrito) {
        await supabase.from('carrito_items').delete().eq('id_carrito', carrito.id);
      }
    };

    const leerEstado = async () => {

      for (let intento = 0; intento < MAX_INTENTOS; intento++) {
        const { data: pedidoDb, error: pedidoError } = await supabase
          .from('pedidos')
          .select('id, estado, total')
          .eq('id', pedido)
          .maybeSingle();

        const { data: pagoDb } = await supabase
          .from('pagos')
          .select('estado, monto, codigo_autorizacion, fecha_pago')
          .eq('id_pedido', pedido)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!activo) return;

        if (pedidoError || !pedidoDb) {
          setResultado('error');
          setCargando(false);
          return;
        }

        const pagoAutorizado = pagoDb?.estado === 'autorizado';
        const pedidoPagado = ESTADOS_PAGADOS.includes(pedidoDb.estado);


        const confirmando = pagoDb?.estado === 'iniciado' || (pagoAutorizado && !pedidoPagado);
        if (confirmando && intento < MAX_INTENTOS - 1) {
          await esperar(ESPERA_MS);
          continue;
        }

        if (pagoAutorizado && pedidoPagado) {
          await vaciarCarrito();
          setDetalle({ total: pedidoDb.total, codigo: pagoDb.codigo_autorizacion });
          setResultado('pagado');
        } else if (confirmando) {

          setResultado('error');
        } else {

          setResultado('no_pagado');
        }
        setCargando(false);
        return;
      }
    };

    if (pedido) {
      leerEstado();
    } else {
      setResultado('error');
      setCargando(false);
    }

    return () => {
      activo = false;
    };
  }, [pedido]);

  if (cargando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.texto}>Confirmando tu pago...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (resultado === 'pagado') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centro}>
          <Ionicons name="checkmark-circle" size={96} color={VERDE} />
          <Text style={styles.titulo}>¡Pago exitoso!</Text>
          <Text style={styles.texto}>Tu pedido fue pagado y ya lo estamos preparando.</Text>
          {detalle && (
            <View style={styles.detalleBox}>
              <Text style={styles.detalleFila}>Total pagado: {formatCLP(detalle.total)}</Text>
              {detalle.codigo ? (
                <Text style={styles.detalleFila}>Código de autorización: {detalle.codigo}</Text>
              ) : null}
            </View>
          )}
          <TouchableOpacity style={styles.boton} onPress={() => router.replace('/mis_pedidos')}>
            <Text style={styles.botonTexto}>Ver mis pedidos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/')}>
            <Text style={styles.link}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (resultado === 'no_pagado') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centro}>
          <Ionicons name="close-circle" size={96} color={PRIMARY} />
          <Text style={styles.titulo}>El pago no se realizó</Text>
          <Text style={styles.texto}>
            No se hizo ningún cargo. Tu carrito sigue intacto para que lo intentes de nuevo.
          </Text>
          <TouchableOpacity style={styles.boton} onPress={() => router.replace('/cart')}>
            <Text style={styles.botonTexto}>Volver al carrito</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centro}>
        <Ionicons name="alert-circle" size={96} color="#e0a800" />
        <Text style={styles.titulo}>No pudimos confirmar tu pago</Text>
        <Text style={styles.texto}>
          Si te cobraron, revisa "Mis pedidos" en unos minutos. Si no aparece, contáctanos.
        </Text>
        <TouchableOpacity style={styles.boton} onPress={() => router.replace('/mis_pedidos')}>
          <Text style={styles.botonTexto}>Ver mis pedidos</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/cart')}>
          <Text style={styles.link}>Volver al carrito</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  titulo: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  texto: { fontSize: 15, color: '#666', textAlign: 'center' },
  detalleBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignSelf: 'stretch',
    gap: 6,
  },
  detalleFila: { fontSize: 14, color: '#1a1a1a' },
  boton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '800' },
  link: { color: PRIMARY, fontSize: 14, fontWeight: '700', marginTop: 4 },
});
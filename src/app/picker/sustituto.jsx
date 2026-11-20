import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';

const PRIMARY = '#C21807';
const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

export default function SustitutoScreen() {
  const router = useRouter();
  const { item: itemId } = useLocalSearchParams();

  const [item, setItem] = useState(null);
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [elegido, setElegido] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);


  const enCurso = useRef(false);
  
  const busquedaActual = useRef(0);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('pedido_items')
        .select(
          'id, cantidad, precio_unitario, id_producto, productos(nombre, id_categoria), pedidos(id_sucursal)'
        )
        .eq('id', itemId)
        .single();

      if (error) {
        Alert.alert('Error', 'No se pudo cargar el producto');
        router.back();
        return;
      }
      setItem(data);
      setCantidad(data.cantidad);
    })();
  }, [itemId]);

  // Busca con un pequeño retraso; sin texto, muestra la misma categoría
  useEffect(() => {
    if (!item) return;

    const t = setTimeout(async () => {
      const numero = ++busquedaActual.current;
      setBuscando(true);

      let q = supabase
        .from('producto_sucursal')
        .select('precio, stock, productos!inner(id, nombre, imagen_url, id_categoria)')
        .eq('id_sucursal', item.pedidos.id_sucursal)
        .eq('activo', true)
        .gt('stock', 0)
        .neq('id_producto', item.id_producto) 
        .limit(30);

      if (texto.trim()) q = q.ilike('productos.nombre', `%${texto.trim()}%`);
      else q = q.eq('productos.id_categoria', item.productos.id_categoria);

      const { data, error } = await q;
      if (numero !== busquedaActual.current) return;

      if (error) console.error(error);
      setResultados((data ?? []).filter((r) => r.productos?.id));
      setBuscando(false);
    }, 350);

    return () => clearTimeout(t);
  }, [texto, item]);

  const enviar = async () => {
    if (!elegido || enCurso.current) return;
    enCurso.current = true;
    setEnviando(true);

    try {
      const { error } = await supabase.rpc('proponer_sustituto', {
        p_item: itemId,
        p_producto: elegido.productos.id,
        p_cantidad: cantidad,
        p_nota: nota,
      });

      if (error) {
        Alert.alert('No se pudo enviar', error.message || 'Intenta de nuevo.');
        return;
      }

      Alert.alert('Propuesta enviada', 'El cliente recibirá la sugerencia para aceptarla.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  const renderResultado = ({ item: r }) => {
    const activo = elegido?.productos.id === r.productos.id;
    return (
      <TouchableOpacity
        style={[styles.card, activo && styles.cardActiva]}
        onPress={() => {
          setElegido(r);
          setCantidad((c) => Math.min(Math.max(c, 1), r.stock));
        }}
        disabled={enviando}
        activeOpacity={0.8}
      >
        {r.productos.imagen_url ? (
          <Image source={{ uri: r.productos.imagen_url }} style={styles.img} />
        ) : (
          <View style={[styles.img, styles.imgVacia]}>
            <Ionicons name="cube-outline" size={22} color="#aaa" />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.nombre} numberOfLines={2}>
            {r.productos.nombre}
          </Text>
          <Text style={styles.sub}>Stock: {r.stock}</Text>
        </View>
        <Text style={styles.precio}>{formatCLP(r.precio)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Sugerir reemplazo</Text>
          <Text style={styles.sub} numberOfLines={1}>
            Para: {item?.productos?.nombre ?? '...'}
          </Text>
        </View>
      </View>

      <View style={styles.buscador}>
        <Ionicons name="search" size={18} color="#999" />
        <TextInput
          style={styles.buscadorInput}
          placeholder="Buscar otro producto"
          placeholderTextColor="#aaa"
          value={texto}
          onChangeText={setTexto}
        />
      </View>

      <Text style={styles.seccion}>
        {texto.trim() ? 'Resultados' : 'Misma categoría con stock'}
      </Text>

      {buscando || !item ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={resultados}
          keyExtractor={(r) => r.productos.id}
          renderItem={renderResultado}
          contentContainerStyle={{ padding: 16, paddingBottom: elegido ? 260 : 24 }}
          ListEmptyComponent={
            <Text style={styles.vacio}>No hay productos con stock para mostrar.</Text>
          }
        />
      )}

      {elegido && (
        <View style={styles.panel}>
          <Text style={styles.panelTitulo} numberOfLines={1}>
            {elegido.productos.nombre}
          </Text>

          <View style={styles.fila}>
            <Text style={styles.sub}>Cantidad</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                disabled={enviando}
                onPress={() => setCantidad((c) => Math.max(1, c - 1))}
              >
                <Ionicons name="remove-circle-outline" size={28} color={PRIMARY} />
              </TouchableOpacity>
              <Text style={styles.cant}>{cantidad}</Text>
              <TouchableOpacity
                disabled={enviando}
                onPress={() => setCantidad((c) => Math.min(elegido.stock, c + 1))}
              >
                <Ionicons name="add-circle-outline" size={28} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={styles.notaInput}
            placeholder="Mensaje para el cliente (opcional)"
            placeholderTextColor="#aaa"
            value={nota}
            onChangeText={setNota}
            maxLength={150}
            editable={!enviando}
          />

          <TouchableOpacity
            style={[styles.btn, enviando && { opacity: 0.6 }]}
            onPress={enviar}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnTexto}>
                Enviar propuesta · {formatCLP(elegido.precio * cantidad)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  back: { padding: 4 },
  titulo: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  sub: { fontSize: 12, color: '#888' },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  buscadorInput: { flex: 1, paddingVertical: 12, color: '#1a1a1a' },
  seccion: { fontSize: 13, fontWeight: '800', color: '#555', marginHorizontal: 16, marginTop: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardActiva: { borderColor: PRIMARY, backgroundColor: '#FFF5F4' },
  img: { width: 54, height: 54, borderRadius: 10, backgroundColor: '#f5f5f5' },
  imgVacia: { alignItems: 'center', justifyContent: 'center' },
  nombre: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  precio: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  vacio: { textAlign: 'center', color: '#999', marginTop: 40 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    padding: 18,
    paddingBottom: 30,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  panelTitulo: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cant: { fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center' },
  notaInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    color: '#1a1a1a',
  },
  btn: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnTexto: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
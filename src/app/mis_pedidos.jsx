import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

export default function MisPedidosScreen() {
  const router = useRouter();

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const cargarPedidos = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          id_cliente,
          estado,
          total,
          direccion_entrega,
          notas,
          created_at,
          pedido_items (
            id,
            cantidad,
            precio_unitario,
            productos (
              id,
              nombre,
              imagen_url
            )
          )
        `)
        .eq('id_cliente', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error cargando pedidos:', error);
        setPedidos([]);
        return;
      }

      setPedidos(data || []);
    } catch (error) {
      console.error('Error inesperado:', error);
      setPedidos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      cargarPedidos();
    }, [cargarPedidos])
  );

  const onRefresh = () => {
    setRefreshing(true);
    cargarPedidos();
  };

  const togglePedido = (id) => {
    setExpanded((actual) => (actual === id ? null : id));
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '';

    const date = new Date(fecha);

    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatearPrecio = (valor) => {
    const numero = Number(valor) || 0;

    return `$${numero.toLocaleString('es-CL')}`;
  };

  const obtenerEstado = (estado) => {
    const estadoNormalizado = String(estado || '')
      .toLowerCase()
      .trim();

    switch (estadoNormalizado) {
      case 'pendiente':
        return {
          texto: 'Pendiente',
          icono: 'time-outline',
          color: '#D97706',
          fondo: '#FEF3C7',
        };

      case 'confirmado':
        return {
          texto: 'Confirmado',
          icono: 'checkmark-circle-outline',
          color: '#2563EB',
          fondo: '#DBEAFE',
        };

      case 'preparando':
      case 'preparación':
        return {
          texto: 'Preparando',
          icono: 'restaurant-outline',
          color: '#7C3AED',
          fondo: '#EDE9FE',
        };

      case 'en camino':
      case 'en_camino':
        return {
          texto: 'En camino',
          icono: 'bicycle-outline',
          color: '#0891B2',
          fondo: '#CFFAFE',
        };

      case 'entregado':
        return {
          texto: 'Entregado',
          icono: 'checkmark-done-outline',
          color: '#16A34A',
          fondo: '#DCFCE7',
        };

      case 'cancelado':
      case 'cancelada':
        return {
          texto: 'Cancelado',
          icono: 'close-circle-outline',
          color: '#DC2626',
          fondo: '#FEE2E2',
        };

      default:
        return {
          texto: estado || 'Sin estado',
          icono: 'ellipse-outline',
          color: '#666',
          fondo: '#F1F1F1',
        };
    }
  };

  const obtenerCantidadProductos = (pedido) => {
    if (!pedido.pedido_items) return 0;

    return pedido.pedido_items.reduce(
      (total, item) => total + (Number(item.cantidad) || 0),
      0
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ENCABEZADO */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/(tabs)/perfil')}
        >
          <Ionicons name="arrow-back" size={23} color="#1a1a1a" />
        </TouchableOpacity>

        <Text style={styles.title}>Mis pedidos</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
      >
        {/* CARGANDO */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />

            <Text style={styles.loadingText}>
              Cargando tus pedidos...
            </Text>
          </View>
        ) : pedidos.length === 0 ? (
          /* SIN PEDIDOS */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="receipt-outline"
                size={48}
                color={PRIMARY}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No tienes pedidos
            </Text>

            <Text style={styles.emptyText}>
              Cuando realices una compra, tus pedidos aparecerán aquí.
            </Text>

            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.push('/(tabs)/')}
            >
              <Ionicons
                name="cart-outline"
                size={19}
                color="#fff"
              />

              <Text style={styles.shopButtonText}>
                Ir a comprar
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Historial de pedidos
            </Text>

            {pedidos.map((pedido) => {
              const estado = obtenerEstado(pedido.estado);
              const estaExpandido = expanded === pedido.id;
              const cantidadProductos =
                obtenerCantidadProductos(pedido);

              return (
                <View key={pedido.id} style={styles.orderCard}>
                  {/* CABECERA DEL PEDIDO */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.orderHeader}
                    onPress={() => togglePedido(pedido.id)}
                  >
                    <View style={styles.orderHeaderLeft}>
                      <View style={styles.orderIcon}>
                        <Ionicons
                          name="receipt-outline"
                          size={21}
                          color={PRIMARY}
                        />
                      </View>

                      <View style={styles.orderInfo}>
                        <Text style={styles.orderNumber}>
                          Pedido #{pedido.id}
                        </Text>

                        <Text style={styles.orderDate}>
                          {formatearFecha(pedido.created_at)}
                        </Text>
                      </View>
                    </View>

                    <Ionicons
                      name={
                        estaExpandido
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={20}
                      color="#999"
                    />
                  </TouchableOpacity>

                  {/* ESTADO */}
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: estado.fondo,
                        },
                      ]}
                    >
                      <Ionicons
                        name={estado.icono}
                        size={15}
                        color={estado.color}
                      />

                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: estado.color,
                          },
                        ]}
                      >
                        {estado.texto}
                      </Text>
                    </View>

                    <Text style={styles.productCount}>
                      {cantidadProductos}{' '}
                      {cantidadProductos === 1
                        ? 'producto'
                        : 'productos'}
                    </Text>
                  </View>

                  {/* TOTAL */}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      Total
                    </Text>

                    <Text style={styles.totalValue}>
                      {formatearPrecio(pedido.total)}
                    </Text>
                  </View>

                  {/* DETALLE */}
                  {estaExpandido && (
                    <View style={styles.details}>
                      <View style={styles.divider} />

                      <Text style={styles.detailsTitle}>
                        Productos
                      </Text>

                      {pedido.pedido_items &&
                      pedido.pedido_items.length > 0 ? (
                        pedido.pedido_items.map((item) => (
                          <View
                            key={item.id}
                            style={styles.productRow}
                          >
                            {/* IMAGEN */}
                            {item.productos?.imagen_url ? (
                              <Image
                                source={{
                                  uri: item.productos.imagen_url,
                                }}
                                style={styles.productImage}
                              />
                            ) : (
                              <View
                                style={styles.productImagePlaceholder}
                              >
                                <Ionicons
                                  name="cube-outline"
                                  size={25}
                                  color="#aaa"
                                />
                              </View>
                            )}

                            {/* INFORMACIÓN */}
                            <View style={styles.productInfo}>
                              <Text
                                style={styles.productName}
                                numberOfLines={2}
                              >
                                {item.productos?.nombre ||
                                  'Producto'}
                              </Text>

                              <Text style={styles.productQuantity}>
                                Cantidad: {item.cantidad}
                              </Text>
                            </View>

                            {/* PRECIO */}
                            <Text style={styles.productPrice}>
                              {formatearPrecio(
                                Number(item.precio_unitario) *
                                  Number(item.cantidad)
                              )}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noProducts}>
                          No hay productos asociados a este pedido.
                        </Text>
                      )}

                      {/* DIRECCIÓN */}
                      {pedido.direccion_entrega && (
                        <View style={styles.extraInfo}>
                          <Ionicons
                            name="location-outline"
                            size={18}
                            color={PRIMARY}
                          />

                          <View style={styles.extraInfoContent}>
                            <Text style={styles.extraInfoTitle}>
                              Dirección
                            </Text>

                            <Text style={styles.extraInfoText}>
                              {pedido.direccion_entrega}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* NOTAS */}
                      {pedido.notas && (
                        <View style={styles.extraInfo}>
                          <Ionicons
                            name="chatbubble-outline"
                            size={18}
                            color={PRIMARY}
                          />

                          <View style={styles.extraInfoContent}>
                            <Text style={styles.extraInfoTitle}>
                              Notas
                            </Text>

                            <Text style={styles.extraInfoText}>
                              {pedido.notas}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        <View style={styles.bottomSpace} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerSpacer: {
    width: 42,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fdecea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#888',
    textAlign: 'center',
    maxWidth: 300,
  },

  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 13,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 22,
  },

  shopButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },

  orderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  orderIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fdecea',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  orderInfo: {
    flex: 1,
  },

  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a1a',
  },

  orderDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 2,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },

  productCount: {
    fontSize: 12,
    color: '#888',
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 14,
    paddingTop: 12,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
  },

  totalLabel: {
    fontSize: 14,
    color: '#777',
    fontWeight: '600',
  },

  totalValue: {
    fontSize: 17,
    color: PRIMARY,
    fontWeight: '800',
  },

  details: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: 14,
  },

  detailsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
  },

  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  productImage: {
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    marginRight: 11,
  },

  productImagePlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  productInfo: {
    flex: 1,
    paddingRight: 8,
  },

  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },

  productQuantity: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },

  productPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#333',
  },

  noProducts: {
    fontSize: 13,
    color: '#999',
    paddingVertical: 8,
  },

  extraInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
  },

  extraInfoContent: {
    flex: 1,
    marginLeft: 9,
  },

  extraInfoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555',
    marginBottom: 3,
  },

  extraInfoText: {
    fontSize: 13,
    color: '#777',
    lineHeight: 19,
  },

  bottomSpace: {
    height: 30,
  },
});
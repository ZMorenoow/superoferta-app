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

import EvidenciaGaleria from '../components/EvidenciaGaleria';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';
const VERDE = '#1B6B3A';

const formatHoraRetiro = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dia =
    d.toDateString() === new Date().toDateString() ? 'Hoy'
    : d.toDateString() === manana.toDateString() ? 'Mañana'
    : d.toLocaleDateString('es-CL');
  return `${dia} ${hh} hrs`;
};

// Solo se muestran pedidos reales. Los intentos de pago abandonados
// (pendiente / cancelado) quedan guardados en la base de datos pero no se muestran.
const ESTADOS_VISIBLES = ['pagado', 'asignado', 'en_proceso', 'completado'];

const esFaltante = (item) => item?.estado === 'faltante';
const propuestaPendiente = (item) =>
  (item?.sustituciones ?? []).find((s) => s.estado === 'propuesta');
const sustResuelta = (item) =>
  (item?.sustituciones ?? []).find((s) => s.estado === 'aceptada' || s.estado === 'rechazada');

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
          hora_retiro,
          notas,
          codigo_retiro,
          created_at,
          pedido_items (
            id,
            cantidad,
            precio_unitario,
            estado,
            motivo_faltante,
            sugerencia,
            id_item_origen,
            productos (
              id,
              nombre,
              imagen_url
            ),
            sustituciones (
              id,
              estado,
              productos (
                nombre
              )
            )
          )
        `)
        .eq('id_cliente', user.id)
        .in('estado', ESTADOS_VISIBLES)
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

  // Carga al entrar y se queda escuchando cambios mientras la pantalla está enfocada.
  // Cuando el picker reporta un faltante o propone un reemplazo, el pedido se recarga solo.
  useFocusEffect(
    useCallback(() => {
      cargarPedidos();

      const canal = supabase
        .channel('mis-pedidos-items')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'pedido_items' },
          () => cargarPedidos()
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'pedidos' },
          () => cargarPedidos()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sustituciones' },
          () => cargarPedidos()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(canal);
      };
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

      case 'pagado':
        return {
          texto: 'Pagado',
          icono: 'checkmark-circle-outline',
          color: '#16A34A',
          fondo: '#DCFCE7',
        };

      case 'asignado':
        return {
          texto: 'Asignado',
          icono: 'person-outline',
          color: '#2563EB',
          fondo: '#DBEAFE',
        };

      case 'en_proceso':
        return {
          texto: 'En preparación',
          icono: 'basket-outline',
          color: '#7C3AED',
          fondo: '#EDE9FE',
        };

      case 'completado':
        return {
          texto: 'Completado',
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

    // Los faltantes no se entregan: se cuentan solo los productos vigentes
    // (incluye los reemplazos aceptados).
    return pedido.pedido_items
      .filter((item) => !esFaltante(item))
      .reduce((total, item) => total + (Number(item.cantidad) || 0), 0);
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
              const faltantes = (pedido.pedido_items || []).filter(esFaltante);
              const hayPropuesta = faltantes.some((f) => !!propuestaPendiente(f));

              const completado = pedido.estado === 'completado';
              const todosItems = pedido.pedido_items || [];
              const sinReemplazo = faltantes.filter(
                (f) => !todosItems.some((r) => r.id_item_origen === f.id)
              );
              const montoDe = (lista) =>
                lista.reduce(
                  (s, i) => s + Number(i.precio_unitario || 0) * Number(i.cantidad || 0),
                  0
                );
              // Diferencia entre lo pagado y lo realmente entregado (solo pedidos completados)
              const ajuste = completado
                ? montoDe(faltantes) - montoDe(todosItems.filter((i) => !!i.id_item_origen))
                : 0;
              const totalEntregado = Number(pedido.total || 0) - ajuste;

              let banner = null;
              if (faltantes.length > 0) {
                if (!completado) {
                  banner = {
                    icono: 'alert-circle',
                    color: PRIMARY,
                    estilo: null,
                    titulo: hayPropuesta
                      ? 'Tienes un reemplazo por aprobar'
                      : faltantes.length === 1
                      ? '1 producto no está disponible'
                      : `${faltantes.length} productos no están disponibles`,
                    sub: hayPropuesta
                      ? 'Toca para aceptar o rechazar'
                      : 'Toca para ver el detalle',
                  };
                } else if (sinReemplazo.length === 0) {
                  banner = {
                    icono: 'swap-horizontal',
                    color: VERDE,
                    estilo: styles.bannerOk,
                    titulo:
                      faltantes.length === 1
                        ? '1 producto fue reemplazado'
                        : `${faltantes.length} productos fueron reemplazados`,
                    sub: 'Toca para ver el detalle',
                  };
                } else {
                  banner = {
                    icono: 'information-circle',
                    color: '#B45309',
                    estilo: styles.bannerAviso,
                    titulo:
                      sinReemplazo.length === 1
                        ? '1 producto no se pudo entregar'
                        : `${sinReemplazo.length} productos no se pudieron entregar`,
                    sub: 'Se reembolsa su valor · toca para ver el detalle',
                  };
                }
              }

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
                          Pedido #{String(pedido.id).slice(0, 8).toUpperCase()}
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

                  {/* AVISO DE PRODUCTOS FALTANTES / REEMPLAZADOS */}
                  {banner && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.faltanteBanner, banner.estilo]}
                      onPress={() =>
                        hayPropuesta && !completado
                          ? router.push({
                              pathname: '/sustitucion',
                              params: { pedido: pedido.id },
                            })
                          : setExpanded(pedido.id)
                      }
                    >
                      <Ionicons name={banner.icono} size={22} color={banner.color} />
                      <View style={styles.faltanteBannerTextos}>
                        <Text style={[styles.faltanteBannerTitulo, { color: banner.color }]}>
                          {banner.titulo}
                        </Text>
                        <Text style={styles.faltanteBannerSub}>{banner.sub}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={banner.color} />
                    </TouchableOpacity>
                  )}

                  {/* HORA DE RETIRO (solo mientras el pedido no está completado) */}
                  {pedido.hora_retiro && !completado && (
                    <View style={styles.retiroHoraRow}>
                      <Ionicons name="time-outline" size={16} color={PRIMARY} />
                      <Text style={styles.retiroHoraText}>
                        Retiro: {formatHoraRetiro(pedido.hora_retiro)}
                      </Text>
                    </View>
                  )}

                  {/* TOTAL */}
                  <View style={styles.totalRow}>
                    <View>
                      <Text style={styles.totalLabel}>
                        {ajuste !== 0 ? 'Total entregado' : 'Total'}
                      </Text>
                      {ajuste !== 0 && (
                        <Text style={styles.pagadoText}>
                          Pagado: {formatearPrecio(pedido.total)}
                        </Text>
                      )}
                    </View>

                    <Text style={styles.totalValue}>
                      {formatearPrecio(ajuste !== 0 ? totalEntregado : pedido.total)}
                    </Text>
                  </View>

                  {/* CÓDIGO DE RETIRO */}
                  {pedido.codigo_retiro ? (
                    <View style={styles.retiroRow}>
                      <View style={styles.retiroTextos}>
                        <Text style={styles.retiroLabel}>
                          Código de retiro
                        </Text>

                        <Text style={styles.retiroHint}>
                          Muéstralo en la sucursal
                        </Text>
                      </View>

                      <Text style={styles.retiroCodigo}>
                        {pedido.codigo_retiro}
                      </Text>
                    </View>
                  ) : null}

                  {/* DETALLE */}
                  {estaExpandido && (
                    <View style={styles.details}>
                      <View style={styles.divider} />

                      <Text style={styles.detailsTitle}>
                        Productos
                      </Text>

                      {pedido.pedido_items &&
                      pedido.pedido_items.length > 0 ? (
                        pedido.pedido_items.map((item) => {
                          const faltante = esFaltante(item);
                          const sust = faltante ? sustResuelta(item) : null;

                          return (
                            <View
                              key={item.id}
                              style={[
                                styles.productBlock,
                                faltante && styles.productBlockFaltante,
                              ]}
                            >
                              <View style={styles.productRow}>
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
                                  {!!item.id_item_origen && (
                                    <Text style={styles.reemplazoTag}>
                                      Reemplazo aceptado
                                    </Text>
                                  )}

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
                                <Text
                                  style={[
                                    styles.productPrice,
                                    faltante && styles.productPriceTachado,
                                  ]}
                                >
                                  {formatearPrecio(
                                    Number(item.precio_unitario) *
                                      Number(item.cantidad)
                                  )}
                                </Text>
                              </View>

                              {/* DETALLE DEL FALTANTE */}
                              {faltante && (
                                <View style={styles.faltanteInfo}>
                                  <View style={styles.faltanteTag}>
                                    <Ionicons name="alert-circle" size={14} color={PRIMARY} />
                                    <Text style={styles.faltanteTagText}>
                                      No disponible
                                      {item.motivo_faltante ? ` · ${item.motivo_faltante}` : ''}
                                    </Text>
                                  </View>

                                  {!!item.sugerencia && (
                                    <View style={styles.sugerenciaBox}>
                                      <Text style={styles.sugerenciaLabel}>
                                        Nota del preparador
                                      </Text>
                                      <Text style={styles.sugerenciaTexto}>
                                        {item.sugerencia}
                                      </Text>
                                    </View>
                                  )}

                                  {/* RESULTADO DEL REEMPLAZO */}
                                  {sust?.estado === 'aceptada' && (
                                    <Text style={styles.reemplazoEstadoOk}>
                                      Aceptaste el reemplazo: {sust.productos?.nombre}
                                    </Text>
                                  )}
                                  {sust?.estado === 'rechazada' && (
                                    <Text style={styles.reemplazoEstadoNo}>
                                      Rechazaste el reemplazo sugerido
                                    </Text>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.noProducts}>
                          No hay productos asociados a este pedido.
                        </Text>
                      )}

                      {/* FOTOS DE EVIDENCIA (solo cuando el pedido ya está completado) */}
                      {pedido.estado === 'completado' && (
                        <EvidenciaGaleria
                          pedidoId={pedido.id}
                          titulo="Fotos de tu pedido"
                        />
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

  // Aviso de faltantes (resumen en la tarjeta)
  faltanteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FFF5F4',
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },

  faltanteBannerTextos: {
    flex: 1,
  },

  faltanteBannerTitulo: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
  },

  faltanteBannerSub: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },

  bannerOk: {
    backgroundColor: '#F0FFF4',
    borderColor: VERDE,
  },

  bannerAviso: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
  },

  retiroHoraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
  },

  retiroHoraText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
  },

  pagadoText: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 2,
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

  retiroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: VERDE,
    backgroundColor: '#F0FFF4',
  },

  retiroTextos: {
    flex: 1,
    paddingRight: 10,
  },

  retiroLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: VERDE,
  },

  retiroHint: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },

  retiroCodigo: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1a1a1a',
    letterSpacing: 4,
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

  productBlock: {
    marginBottom: 12,
  },

  productBlockFaltante: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFF5F4',
    borderWidth: 1,
    borderColor: '#f5c6c2',
  },

  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
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

  reemplazoTag: {
    fontSize: 11,
    fontWeight: '800',
    color: VERDE,
    marginBottom: 2,
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

  productPriceTachado: {
    color: '#aaa',
    textDecorationLine: 'line-through',
  },

  faltanteInfo: {
    marginTop: 10,
  },

  faltanteTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#fdecea',
  },

  faltanteTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
  },

  sugerenciaBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },

  sugerenciaLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#555',
    marginBottom: 3,
  },

  sugerenciaTexto: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },

  reemplazoEstadoOk: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: VERDE,
  },

  reemplazoEstadoNo: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#777',
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
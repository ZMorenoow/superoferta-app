import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../components/CustomAlert';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

export default function AyudaScreen() {
  const router = useRouter();
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [alertConfig, setAlertConfig] = useState(null);

  useEffect(() => {
    const cargarCategorias = async () => {
      const { data } = await supabase
        .from('categorias_contacto')
        .select('id, nombre')
        .order('nombre');
      if (data) setCategorias(data);
    };
    cargarCategorias();
  }, []);

  const handleEnviar = async () => {
    if (!categoriaSeleccionada || !asunto.trim() || !descripcion.trim()) {
      setAlertConfig({
        icon: 'alert-circle',
        iconColor: PRIMARY,
        title: 'Faltan datos',
        message: 'Completa la categoría, el asunto y la descripción',
        buttonText: 'Entendido',
        onPress: () => setAlertConfig(null),
      });
      return;
    }

    setEnviando(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('contacto').insert({
      id_usuario: user.id,
      id_categoria: categoriaSeleccionada,
      asunto: asunto.trim(),
      descripcion: descripcion.trim(),
      estado: 'pendiente',
    });

    setEnviando(false);

    if (error) {
      setAlertConfig({
        icon: 'close-circle',
        iconColor: PRIMARY,
        title: 'Error',
        message: 'No se pudo enviar tu mensaje. Intenta de nuevo.',
        buttonText: 'OK',
        onPress: () => setAlertConfig(null),
      });
      return;
    }

    setAlertConfig({
      icon: 'checkmark-circle',
      iconColor: '#1B6B3A',
      title: '¡Mensaje enviado!',
      message: 'Nuestro equipo revisará tu consulta pronto.',
      buttonText: 'Volver',
      onPress: () => {
        setAlertConfig(null);
        router.push('/(tabs)/perfil');
        },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/perfil')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayuda</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>¿En qué podemos ayudarte?</Text>
          <View style={styles.categoriasList}>
            {categorias.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoriaChip,
                  categoriaSeleccionada === cat.id && styles.categoriaChipActive,
                ]}
                onPress={() => setCategoriaSeleccionada(cat.id)}
              >
                <Text
                  style={[
                    styles.categoriaText,
                    categoriaSeleccionada === cat.id && styles.categoriaTextActive,
                  ]}
                >
                  {cat.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Asunto</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: No llegó mi pedido"
            placeholderTextColor="#aaa"
            value={asunto}
            onChangeText={setAsunto}
          />

          <Text style={styles.label}>Cuéntanos más</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe tu consulta con detalle..."
            placeholderTextColor="#aaa"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <TouchableOpacity style={styles.btnEnviar} onPress={handleEnviar} disabled={enviando}>
            {enviando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnEnviarText}>Enviar mensaje</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={!!alertConfig}
        icon={alertConfig?.icon}
        iconColor={alertConfig?.iconColor}
        title={alertConfig?.title}
        message={alertConfig?.message}
        buttonText={alertConfig?.buttonText}
        onPress={alertConfig?.onPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10, marginTop: 16 },
  categoriasList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoriaChip: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fafafa',
  },
  categoriaChipActive: { borderColor: PRIMARY, backgroundColor: '#fdecea' },
  categoriaText: { fontSize: 13, fontWeight: '600', color: '#555' },
  categoriaTextActive: { color: PRIMARY },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
    color: '#1a1a1a', backgroundColor: '#fafafa',
  },
  textArea: { height: 120, paddingTop: 14 },
  btnEnviar: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
  },
  btnEnviarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
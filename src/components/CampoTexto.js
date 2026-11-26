import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const PRIMARY = '#ED1D26';

export default function CampoTexto({ icono, label, secure, style, onFocus, onBlur, ...props }) {
  const [foco, setFoco] = useState(false);
  const [oculto, setOculto] = useState(!!secure);

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.box, foco && styles.boxFoco]}>
        {icono ? <Ionicons name={icono} size={19} color={foco ? PRIMARY : '#999'} /> : null}
        <TextInput
          {...props}
          style={styles.input}
          placeholderTextColor="#aaa"
          secureTextEntry={oculto}
          onFocus={(e) => { setFoco(true); onFocus?.(e); }}
          onBlur={(e) => { setFoco(false); onBlur?.(e); }}
        />
        {secure ? (
          <TouchableOpacity onPress={() => setOculto(!oculto)} hitSlop={10}>
            <Ionicons name={oculto ? 'eye-outline' : 'eye-off-outline'} size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 6 },
  box: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#e6e6e6', borderRadius: 12,
    paddingHorizontal: 14, backgroundColor: '#fafafa',
  },
  boxFoco: { borderColor: PRIMARY, backgroundColor: '#fff' },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#1a1a1a' },
});
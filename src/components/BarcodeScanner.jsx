import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PRIMARY = '#C21807';
const { width, height } = Dimensions.get('window');

const FRAME_WIDTH = 260;
const FRAME_HEIGHT = 160;
const FRAME_TOP = height / 2 - FRAME_HEIGHT / 2;
const FRAME_LEFT = width / 2 - FRAME_WIDTH / 2;

export default function BarcodeScanner({ onScanned, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [escaneado, setEscaneado] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Necesitamos permiso de cámara para escanear</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }) => {
    if (escaneado) return;
    setEscaneado(true);
    onScanned(data);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'code128', 'qr'],
        }}
        onBarcodeScanned={escaneado ? undefined : handleBarcodeScanned}
      />

      {/* Máscara: 4 rectángulos que tapan todo excepto el recuadro central */}
      <View style={[styles.mask, { top: 0, left: 0, right: 0, height: FRAME_TOP }]} pointerEvents="none" />
      <View style={[styles.mask, { top: FRAME_TOP + FRAME_HEIGHT, left: 0, right: 0, bottom: 0 }]} pointerEvents="none" />
      <View style={[styles.mask, { top: FRAME_TOP, left: 0, width: FRAME_LEFT, height: FRAME_HEIGHT }]} pointerEvents="none" />
      <View style={[styles.mask, { top: FRAME_TOP, left: FRAME_LEFT + FRAME_WIDTH, right: 0, height: FRAME_HEIGHT }]} pointerEvents="none" />
      
      {/* Marco del recuadro (borde visible) */}
      <View style={[styles.frame, { top: FRAME_TOP, left: FRAME_LEFT, width: FRAME_WIDTH, height: FRAME_HEIGHT }]} pointerEvents="none" />

      <Text style={styles.hint}>Apunta el código de barras del producto</Text>

      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeBtnText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  text: { color: '#fff', textAlign: 'center', marginTop: 40, fontSize: 15, paddingHorizontal: 20 },
  btn: { backgroundColor: PRIMARY, borderRadius: 14, padding: 14, margin: 20, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
  mask: {
    position: 'absolute',
    backgroundColor: '#fff',
  },
  frame: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: PRIMARY,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  hint: {
    position: 'absolute',
    top: FRAME_TOP + FRAME_HEIGHT + 24,
    width: '100%',
    textAlign: 'center',
    color: '#333',
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  closeBtnText: { color: '#fff', fontWeight: '800' },
});
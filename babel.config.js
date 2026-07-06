// babel.config.js  ← va en la RAÍZ del proyecto (junto a package.json)
// En Expo 54 con Reanimated v4, NO se agrega el plugin manualmente.
// babel-preset-expo lo incluye automáticamente.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // ⚠️ NO agregar 'react-native-reanimated/plugin' aquí
    // Expo 54 lo inyecta solo. Agregarlo causa crash por plugin duplicado.
  };
};
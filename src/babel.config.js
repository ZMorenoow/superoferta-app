// babel.config.js  ← va en la RAÍZ del proyecto (junto a package.json)
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated/plugin SIEMPRE debe ir al final
      'react-native-reanimated/plugin',
    ],
  };
};
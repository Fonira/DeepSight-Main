module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@/components': './src/components',
            '@/screens': './src/screens',
            '@/services': './src/services',
            '@/hooks': './src/hooks',
            '@/contexts': './src/contexts',
            '@/navigation': './src/navigation',
            '@/constants': './src/constants',
            '@/utils': './src/utils',
            '@/assets': './src/assets',
            '@/theme': './src/theme',
            '@/stores': './src/stores'
          }
        }
      ],
      // Reanimated plugin must be listed last
      'react-native-reanimated/plugin'
    ]
  };
};

module.exports={
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['.'],
        extensions: ['.ios.js','.android.js','.js','.ts','.tsx','.json'],
        alias: {
          '@': './src',
        },
      },
    ],
    'react-native-worklets-core/plugin',
    'react-native-reanimated/plugin', // This must be last
  ],
};

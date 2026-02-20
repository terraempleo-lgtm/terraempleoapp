const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite en web necesita que .wasm sea tratado como asset
config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];

module.exports = config;

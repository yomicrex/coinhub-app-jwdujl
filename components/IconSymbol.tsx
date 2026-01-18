
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { StyleProp, ViewStyle, Platform } from 'react-native';

export function IconSymbol({
  ios_icon_name,
  android_material_icon_name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  ios_icon_name: SymbolViewProps['name'];
  android_material_icon_name: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        weight={weight}
        tintColor={color}
        resizeMode="scaleAspectFit"
        name={ios_icon_name}
        style={[{ width: size, height: size }, style]}
      />
    );
  }

  return (
    <MaterialIcons
      name={android_material_icon_name}
      size={size}
      color={color}
      style={style}
    />
  );
}


import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleProp, ViewStyle } from 'react-native';

/**
 * Android-specific IconSymbol component
 * Uses Material Icons only - no iOS SF Symbols
 */
export function IconSymbol({
  ios_icon_name,
  android_material_icon_name,
  size = 24,
  color,
  style,
  weight,
}: {
  ios_icon_name: any;
  android_material_icon_name: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  weight?: any;
}) {
  return (
    <MaterialIcons
      name={android_material_icon_name}
      size={size}
      color={color}
      style={style}
    />
  );
}

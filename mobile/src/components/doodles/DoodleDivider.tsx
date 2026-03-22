import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { DOODLE_MAP, DOODLE_CATEGORIES, DoodleCategory } from './doodlePaths';
import DoodleIcon from './DoodleIcon';

interface DoodleDividerProps {
  category?: DoodleCategory;
  iconCount?: number;
  lineColor?: string;
  iconSize?: number;
  animated?: boolean;
}

/**
 * DoodleDivider Component
 * Decorative horizontal divider with doodle icons
 *
 * Layout: [line] [icon1] [icon2] [icon3] [icon4] [line]
 *
 * @param category - Icon category to use (default: random)
 * @param iconCount - Number of icons (default: 4, range: 3-5)
 * @param lineColor - Color of divider lines (default: theme divider color)
 * @param iconSize - Icon size in pixels (default: 20)
 * @param animated - Enable animations (default: false)
 */
export const DoodleDivider: React.FC<DoodleDividerProps> = ({
  category,
  iconCount = 4,
  lineColor,
  iconSize = 20,
  animated = false,
}) => {
  const { colors } = useTheme();
  const finalLineColor = lineColor || colors.border;

  // Determine which category to use
  const selectedCategory = useMemo(() => {
    if (category) return category;
    const categories = Object.keys(DOODLE_CATEGORIES) as DoodleCategory[];
    return categories[Math.floor(Math.random() * categories.length)];
  }, [category]);

  // Get icons from selected category
  const categoryIcons = useMemo(() => {
    const icons = DOODLE_CATEGORIES[selectedCategory];
    const iconNames = Object.keys(icons) as (keyof typeof icons)[];
    
    // Shuffle and select iconCount icons
    const selected: string[] = [];
    const indices = new Set<number>();
    
    while (selected.length < Math.min(iconCount, iconNames.length)) {
      const idx = Math.floor(Math.random() * iconNames.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        selected.push(iconNames[idx] as string);
      }
    }
    
    return selected;
  }, [selectedCategory, iconCount]);

  // Random rotation angles for each icon
  const rotations = useMemo(() => {
    return categoryIcons.map(() => {
      const angles = [0, 12, -12, 25, -25, 40, -40, 55, -55, 70, -70, 90, -90, 135, -135, 180];
      return angles[Math.floor(Math.random() * angles.length)];
    });
  }, [categoryIcons]);

  return (
    <View style={[styles.container]}>
      {/* Left line */}
      <View
        style={[
          styles.line,
          { backgroundColor: finalLineColor },
        ]}
      />

      {/* Icons */}
      <View style={styles.iconContainer}>
        {categoryIcons.map((iconName, index) => (
          <View key={`${selectedCategory}-${index}`} style={styles.iconWrapper}>
            <DoodleIcon
              name={iconName as any}
              size={iconSize}
              color={colors.accentPrimary}
              animated={animated}
              rotation={rotations[index]}
            />
          </View>
        ))}
      </View>

      {/* Right line */}
      <View
        style={[
          styles.line,
          { backgroundColor: finalLineColor },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
  },
  iconContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  iconWrapper: {
    marginHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DoodleDivider;

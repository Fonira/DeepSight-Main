import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Line, G, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { GlassCard } from '../ui/GlassCard';
import { Spacing, Typography } from '../../constants/theme';

export interface MindMapNode {
  id: string;
  label: string;
  type: 'main' | 'secondary' | 'tertiary';
  children?: string[];
}

export interface MindMapData {
  title: string;
  nodes: MindMapNode[];
}

interface MindMapComponentProps {
  data: MindMapData | null;
  isLoading?: boolean;
}

interface NodePosition {
  x: number;
  y: number;
  node: MindMapNode;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_PADDING = 40;
const NODE_RADIUS = {
  main: 50,
  secondary: 35,
  tertiary: 25,
};

export const MindMapComponent: React.FC<MindMapComponentProps> = ({
  data,
  isLoading = false,
}) => {
  const { colors } = useTheme();

  // Calculate node positions using a simple radial layout
  const { nodePositions, lines, canvasSize } = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) {
      return { nodePositions: [], lines: [], canvasSize: { width: 300, height: 300 } };
    }

    const positions: NodePosition[] = [];
    const connectionLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    // Find main node (center)
    const mainNode = data.nodes.find(n => n.type === 'main');
    const secondaryNodes = data.nodes.filter(n => n.type === 'secondary');
    const tertiaryNodes = data.nodes.filter(n => n.type === 'tertiary');

    const centerX = SCREEN_WIDTH / 2 - 20;
    const centerY = 200;

    // Position main node at center
    if (mainNode) {
      positions.push({ x: centerX, y: centerY, node: mainNode });
    }

    // Position secondary nodes in a circle around main
    const secondaryRadius = 130;
    secondaryNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(secondaryNodes.length, 1) - Math.PI / 2;
      const x = centerX + secondaryRadius * Math.cos(angle);
      const y = centerY + secondaryRadius * Math.sin(angle);
      positions.push({ x, y, node });

      // Connect to main
      if (mainNode) {
        connectionLines.push({ x1: centerX, y1: centerY, x2: x, y2: y });
      }
    });

    // Position tertiary nodes further out
    const tertiaryRadius = 230;
    tertiaryNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(tertiaryNodes.length, 1);
      const x = centerX + tertiaryRadius * Math.cos(angle);
      const y = centerY + tertiaryRadius * Math.sin(angle);
      positions.push({ x, y, node });

      // Connect to nearest secondary node
      if (secondaryNodes.length > 0) {
        const nearestSecondary = positions.find(
          p => p.node.type === 'secondary' && Math.abs(positions.indexOf(p) - index) <= 1
        );
        if (nearestSecondary) {
          connectionLines.push({
            x1: nearestSecondary.x,
            y1: nearestSecondary.y,
            x2: x,
            y2: y,
          });
        }
      }
    });

    // Calculate canvas size
    const maxX = Math.max(...positions.map(p => p.x)) + 60;
    const maxY = Math.max(...positions.map(p => p.y)) + 60;
    const minX = Math.min(...positions.map(p => p.x)) - 60;
    const minY = Math.min(...positions.map(p => p.y)) - 60;

    return {
      nodePositions: positions,
      lines: connectionLines,
      canvasSize: {
        width: Math.max(maxX - minX + CANVAS_PADDING * 2, SCREEN_WIDTH - 40),
        height: Math.max(maxY - minY + CANVAS_PADDING * 2, 450),
      },
    };
  }, [data]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Génération de la carte mentale...
        </Text>
      </View>
    );
  }

  // No data
  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="git-network-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Aucune carte mentale disponible
        </Text>
      </View>
    );
  }

  const getNodeColor = (type: MindMapNode['type']) => {
    switch (type) {
      case 'main':
        return colors.accentPrimary;
      case 'secondary':
        return colors.accentSecondary || colors.accentPrimary;
      case 'tertiary':
        return colors.textTertiary;
      default:
        return colors.textSecondary;
    }
  };

  const getNodeTextColor = (type: MindMapNode['type']) => {
    switch (type) {
      case 'main':
      case 'secondary':
        return '#FFFFFF';
      default:
        return colors.textPrimary;
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Title */}
        <GlassCard padding="md" borderRadius="md" style={styles.titleCard}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {data.title || 'Carte Mentale'}
          </Text>
        </GlassCard>

        {/* SVG Mind Map */}
        <View style={[styles.svgContainer, { backgroundColor: `${colors.bgSecondary}50` }]}>
          <Svg
            width={canvasSize.width}
            height={canvasSize.height}
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          >
            {/* Lines */}
            {lines.map((line, index) => (
              <Line
                key={`line-${index}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={colors.border}
                strokeWidth={2}
                strokeDasharray="5,5"
              />
            ))}

            {/* Nodes */}
            {nodePositions.map((pos, index) => {
              const radius = NODE_RADIUS[pos.node.type];
              const nodeColor = getNodeColor(pos.node.type);
              const textColor = getNodeTextColor(pos.node.type);

              // Truncate label for display
              const displayLabel = pos.node.label.length > 15
                ? pos.node.label.substring(0, 12) + '...'
                : pos.node.label;

              return (
                <G key={`node-${index}`}>
                  {/* Node background */}
                  <Circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius}
                    fill={nodeColor}
                    opacity={pos.node.type === 'main' ? 1 : 0.8}
                  />
                  {/* Node border */}
                  <Circle
                    cx={pos.x}
                    cy={pos.y}
                    r={radius}
                    fill="none"
                    stroke={nodeColor}
                    strokeWidth={2}
                  />
                  {/* Node label */}
                  <SvgText
                    x={pos.x}
                    y={pos.y}
                    fill={textColor}
                    fontSize={pos.node.type === 'main' ? 12 : 10}
                    fontWeight={pos.node.type === 'main' ? 'bold' : 'normal'}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                  >
                    {displayLabel}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>

        {/* Legend */}
        <GlassCard padding="md" borderRadius="md" style={styles.legendCard}>
          <Text style={[styles.legendTitle, { color: colors.textSecondary }]}>
            Légende
          </Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accentPrimary }]} />
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                Concept principal
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accentSecondary || colors.accentPrimary, opacity: 0.8 }]} />
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                Concepts clés
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.textTertiary }]} />
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                Sous-concepts
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Full list */}
        <GlassCard padding="md" borderRadius="md" style={styles.listCard}>
          <Text style={[styles.listTitle, { color: colors.textPrimary }]}>
            Liste des concepts
          </Text>
          {nodePositions.map((pos, index) => (
            <View key={`list-${index}`} style={styles.listItem}>
              <View
                style={[
                  styles.listDot,
                  { backgroundColor: getNodeColor(pos.node.type) },
                ]}
              />
              <Text
                style={[
                  styles.listLabel,
                  { color: colors.textPrimary },
                  pos.node.type === 'main' && styles.listLabelMain,
                ]}
              >
                {pos.node.label}
              </Text>
            </View>
          ))}
        </GlassCard>
      </ScrollView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  titleCard: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
  },
  svgContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  legendCard: {
    marginBottom: Spacing.md,
  },
  legendTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.sm,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.xs,
  },
  legendLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  listCard: {
    marginBottom: Spacing.md,
  },
  listTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  listDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  listLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  listLabelMain: {
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
});

export default MindMapComponent;

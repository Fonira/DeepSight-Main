import React from 'react';
import Svg, { Path, Circle, Rect, G, Defs, LinearGradient, Stop, Ellipse } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Colors } from '../../constants/theme';

const AnimatedG = Animated.createAnimatedComponent(G);

interface IllustrationProps {
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

// Empty history illustration - cute folder with sparkles
export const EmptyHistoryIllustration: React.FC<IllustrationProps> = ({
  size = 200,
  primaryColor = Colors.accentPrimary,
  secondaryColor = Colors.accentSecondary,
}) => {
  const sparkle1 = useSharedValue(0);
  const sparkle2 = useSharedValue(0);
  const folderBounce = useSharedValue(0);

  useEffect(() => {
    sparkle1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 800, easing: Easing.in(Easing.ease) })
      ),
      -1,
      true
    );
    sparkle2.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.in(Easing.ease) })
        ),
        -1,
        true
      )
    );
    folderBounce.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const sparkle1Style = useAnimatedStyle(() => ({
    opacity: sparkle1.value,
    transform: [{ scale: 0.5 + sparkle1.value * 0.5 }],
  }));

  const sparkle2Style = useAnimatedStyle(() => ({
    opacity: sparkle2.value,
    transform: [{ scale: 0.5 + sparkle2.value * 0.5 }],
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="folderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor={secondaryColor} />
        </LinearGradient>
      </Defs>

      {/* Background circle */}
      <Circle cx="100" cy="100" r="80" fill={`${primaryColor}15`} />

      {/* Folder */}
      <G transform="translate(50, 60)">
        {/* Folder back */}
        <Path
          d="M0 30 L0 80 Q0 90 10 90 L90 90 Q100 90 100 80 L100 30 Z"
          fill={`${primaryColor}30`}
        />
        {/* Folder tab */}
        <Path
          d="M0 30 L0 20 Q0 10 10 10 L35 10 L45 25 Q48 30 55 30 L100 30"
          fill={`${primaryColor}50`}
        />
        {/* Folder front */}
        <Path
          d="M5 35 L5 75 Q5 85 15 85 L85 85 Q95 85 95 75 L95 35 Q95 25 85 25 L50 25 L42 15 Q38 10 30 10 L15 10 Q5 10 5 20 L5 35 Z"
          fill="url(#folderGrad)"
        />
        {/* Document peek */}
        <Rect x="20" y="40" width="55" height="8" rx="2" fill="white" opacity="0.8" />
        <Rect x="20" y="52" width="40" height="8" rx="2" fill="white" opacity="0.6" />
        <Rect x="20" y="64" width="30" height="8" rx="2" fill="white" opacity="0.4" />
      </G>

      {/* Animated sparkles */}
      <Animated.View style={[{ position: 'absolute' }, sparkle1Style]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Path
            d="M160 50 L163 56 L170 58 L163 60 L160 66 L157 60 L150 58 L157 56 Z"
            fill={secondaryColor}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[{ position: 'absolute' }, sparkle2Style]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Path
            d="M40 75 L42 79 L47 80 L42 81 L40 85 L38 81 L33 80 L38 79 Z"
            fill={primaryColor}
          />
        </Svg>
      </Animated.View>
    </Svg>
  );
};

// Empty favorites illustration - heart with sparkles
export const EmptyFavoritesIllustration: React.FC<IllustrationProps> = ({
  size = 200,
  primaryColor = Colors.accentError,
  secondaryColor = Colors.accentPrimary,
}) => {
  const heartBeat = useSharedValue(1);
  const sparkle = useSharedValue(0);

  useEffect(() => {
    heartBeat.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 300, easing: Easing.in(Easing.ease) }),
        withTiming(1.08, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
    sparkle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0, { duration: 600 })
      ),
      -1,
      true
    );
  }, []);

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor="#FF6B8A" />
        </LinearGradient>
      </Defs>

      {/* Background circle */}
      <Circle cx="100" cy="100" r="80" fill={`${primaryColor}10`} />

      {/* Heart outline (dashed) */}
      <Path
        d="M100 150 C60 120 30 90 30 65 C30 40 50 30 70 30 C85 30 95 40 100 50 C105 40 115 30 130 30 C150 30 170 40 170 65 C170 90 140 120 100 150 Z"
        fill="none"
        stroke={`${primaryColor}30`}
        strokeWidth="3"
        strokeDasharray="8 4"
      />

      {/* Heart center (smaller, dotted) */}
      <Path
        d="M100 130 C75 110 55 90 55 75 C55 60 70 55 80 55 C88 55 95 60 100 68 C105 60 112 55 120 55 C130 55 145 60 145 75 C145 90 125 110 100 130 Z"
        fill={`${primaryColor}20`}
        stroke={primaryColor}
        strokeWidth="2"
        strokeDasharray="4 3"
      />

      {/* Small decorative hearts */}
      <Path
        d="M45 60 C42 56 35 54 35 48 C35 42 45 42 45 48 C45 42 55 42 55 48 C55 54 48 56 45 60 Z"
        fill={`${primaryColor}40`}
      />
      <Path
        d="M155 70 C153 67 148 66 148 62 C148 58 155 58 155 62 C155 58 162 58 162 62 C162 66 157 67 155 70 Z"
        fill={`${secondaryColor}60`}
      />

      {/* Sparkle stars */}
      <Path
        d="M160 40 L162 46 L168 48 L162 50 L160 56 L158 50 L152 48 L158 46 Z"
        fill={secondaryColor}
        opacity="0.7"
      />
      <Path
        d="M35 100 L36 104 L40 105 L36 106 L35 110 L34 106 L30 105 L34 104 Z"
        fill={primaryColor}
        opacity="0.5"
      />
    </Svg>
  );
};

// Start analysis illustration - video with play button
export const StartAnalysisIllustration: React.FC<IllustrationProps> = ({
  size = 200,
  primaryColor = Colors.accentPrimary,
  secondaryColor = Colors.accentSecondary,
}) => {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glow.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="videoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor={secondaryColor} />
        </LinearGradient>
        <LinearGradient id="playGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#F0F0F0" />
        </LinearGradient>
      </Defs>

      {/* Background glow */}
      <Circle cx="100" cy="100" r="85" fill={`${primaryColor}08`} />
      <Circle cx="100" cy="100" r="70" fill={`${primaryColor}12`} />

      {/* Video screen */}
      <Rect
        x="35"
        y="50"
        width="130"
        height="85"
        rx="12"
        fill="url(#videoGrad)"
      />
      {/* Screen reflection */}
      <Rect
        x="40"
        y="55"
        width="120"
        height="35"
        rx="8"
        fill="white"
        opacity="0.1"
      />

      {/* Play button */}
      <Circle cx="100" cy="92" r="25" fill="white" opacity="0.95" />
      <Path
        d="M92 80 L115 92 L92 104 Z"
        fill="url(#videoGrad)"
      />

      {/* Video stand */}
      <Rect x="80" y="140" width="40" height="8" rx="4" fill={`${primaryColor}40`} />
      <Rect x="95" y="135" width="10" height="12" fill={`${primaryColor}30`} />

      {/* Decorative elements */}
      <Circle cx="155" cy="45" r="8" fill={secondaryColor} opacity="0.6" />
      <Circle cx="170" cy="60" r="4" fill={primaryColor} opacity="0.4" />
      <Circle cx="35" cy="140" r="6" fill={secondaryColor} opacity="0.5" />

      {/* Sparkles */}
      <Path
        d="M45 50 L47 54 L52 55 L47 56 L45 60 L43 56 L38 55 L43 54 Z"
        fill={secondaryColor}
        opacity="0.8"
      />
      <Path
        d="M165 130 L166 133 L170 134 L166 135 L165 138 L164 135 L160 134 L164 133 Z"
        fill={primaryColor}
        opacity="0.6"
      />
    </Svg>
  );
};

// Onboarding illustrations
export const OnboardingAnalyzeIllustration: React.FC<IllustrationProps> = ({
  size = 250,
  primaryColor = Colors.accentPrimary,
}) => (
  <Svg width={size} height={size} viewBox="0 0 250 250">
    <Defs>
      <LinearGradient id="analyzeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={primaryColor} />
        <Stop offset="100%" stopColor={Colors.accentSecondary} />
      </LinearGradient>
    </Defs>

    <Circle cx="125" cy="125" r="100" fill={`${primaryColor}10`} />

    {/* Brain/AI representation */}
    <Ellipse cx="125" cy="110" rx="60" ry="50" fill={`${primaryColor}20`} stroke={primaryColor} strokeWidth="2" />

    {/* Neural network nodes */}
    {[[80, 90], [100, 80], [125, 75], [150, 80], [170, 90], [90, 120], [125, 130], [160, 120]].map(([x, y], i) => (
      <Circle key={i} cx={x} cy={y} r="8" fill="url(#analyzeGrad)" />
    ))}

    {/* Connections */}
    <Path d="M80 90 L100 80 L125 75 L150 80 L170 90" stroke={primaryColor} strokeWidth="1.5" fill="none" opacity="0.5" />
    <Path d="M90 120 L125 130 L160 120" stroke={primaryColor} strokeWidth="1.5" fill="none" opacity="0.5" />
    <Path d="M100 80 L90 120 M150 80 L160 120 M125 75 L125 130" stroke={primaryColor} strokeWidth="1" fill="none" opacity="0.3" />

    {/* Video icon below */}
    <Rect x="90" y="175" width="70" height="45" rx="6" fill={`${primaryColor}30`} stroke={primaryColor} strokeWidth="2" />
    <Path d="M115 192 L135 200 L115 208 Z" fill={primaryColor} />

    {/* Arrow connecting */}
    <Path d="M125 160 L125 175" stroke={primaryColor} strokeWidth="2" strokeDasharray="4 2" />
    <Path d="M120 170 L125 178 L130 170" fill="none" stroke={primaryColor} strokeWidth="2" />
  </Svg>
);

export const OnboardingInsightsIllustration: React.FC<IllustrationProps> = ({
  size = 250,
  primaryColor = Colors.accentPrimary,
}) => (
  <Svg width={size} height={size} viewBox="0 0 250 250">
    <Defs>
      <LinearGradient id="insightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={Colors.accentSecondary} />
        <Stop offset="100%" stopColor={primaryColor} />
      </LinearGradient>
    </Defs>

    <Circle cx="125" cy="125" r="100" fill={`${Colors.accentSecondary}10`} />

    {/* Document/Card stack */}
    <Rect x="60" y="80" width="130" height="100" rx="10" fill={`${primaryColor}15`} transform="rotate(-5, 125, 130)" />
    <Rect x="60" y="80" width="130" height="100" rx="10" fill={`${primaryColor}25`} transform="rotate(2, 125, 130)" />
    <Rect x="60" y="80" width="130" height="100" rx="10" fill="url(#insightGrad)" />

    {/* Content lines */}
    <Rect x="75" y="100" width="80" height="8" rx="4" fill="white" opacity="0.9" />
    <Rect x="75" y="115" width="100" height="6" rx="3" fill="white" opacity="0.6" />
    <Rect x="75" y="128" width="90" height="6" rx="3" fill="white" opacity="0.6" />
    <Rect x="75" y="141" width="70" height="6" rx="3" fill="white" opacity="0.6" />

    {/* Lightbulb icon */}
    <Circle cx="160" cy="160" r="20" fill={Colors.accentSecondary} />
    <Path d="M160 145 L160 155 M150 165 L160 160 L170 165 M155 175 L165 175" stroke="white" strokeWidth="2.5" strokeLinecap="round" />

    {/* Stars */}
    <Path d="M80 60 L82 66 L88 68 L82 70 L80 76 L78 70 L72 68 L78 66 Z" fill={Colors.accentSecondary} />
    <Path d="M190 90 L191 94 L195 95 L191 96 L190 100 L189 96 L185 95 L189 94 Z" fill={primaryColor} />
  </Svg>
);

export const OnboardingChatIllustration: React.FC<IllustrationProps> = ({
  size = 250,
  primaryColor = Colors.accentPrimary,
}) => (
  <Svg width={size} height={size} viewBox="0 0 250 250">
    <Circle cx="125" cy="125" r="100" fill={`${primaryColor}10`} />

    {/* Chat bubbles */}
    <G transform="translate(50, 60)">
      {/* User bubble */}
      <Path
        d="M10 20 Q10 10 20 10 L100 10 Q110 10 110 20 L110 45 Q110 55 100 55 L30 55 L15 70 L20 55 Q10 55 10 45 Z"
        fill={`${primaryColor}30`}
      />
      <Rect x="20" y="22" width="70" height="6" rx="3" fill={primaryColor} opacity="0.6" />
      <Rect x="20" y="34" width="50" height="6" rx="3" fill={primaryColor} opacity="0.4" />

      {/* AI bubble */}
      <Path
        d="M40 85 Q40 75 50 75 L130 75 Q140 75 140 85 L140 130 Q140 140 130 140 L60 140 L45 155 L50 140 Q40 140 40 130 Z"
        fill="url(#analyzeGrad)"
      />
      <Rect x="50" y="87" width="80" height="6" rx="3" fill="white" opacity="0.9" />
      <Rect x="50" y="99" width="70" height="6" rx="3" fill="white" opacity="0.7" />
      <Rect x="50" y="111" width="75" height="6" rx="3" fill="white" opacity="0.7" />
      <Rect x="50" y="123" width="45" height="6" rx="3" fill="white" opacity="0.5" />
    </G>

    {/* Typing indicator dots */}
    <Circle cx="175" cy="180" r="5" fill={Colors.accentSecondary} opacity="0.8" />
    <Circle cx="190" cy="180" r="5" fill={Colors.accentSecondary} opacity="0.5" />
    <Circle cx="205" cy="180" r="5" fill={Colors.accentSecondary} opacity="0.3" />
  </Svg>
);

export const OnboardingExportIllustration: React.FC<IllustrationProps> = ({
  size = 250,
  primaryColor = Colors.accentPrimary,
}) => (
  <Svg width={size} height={size} viewBox="0 0 250 250">
    <Circle cx="125" cy="125" r="100" fill={`${Colors.accentSuccess}10`} />

    {/* Document */}
    <Rect x="70" y="55" width="110" height="140" rx="8" fill="white" />
    <Rect x="70" y="55" width="110" height="140" rx="8" fill={`${primaryColor}10`} stroke={primaryColor} strokeWidth="2" />

    {/* Document content */}
    <Rect x="85" y="75" width="80" height="8" rx="4" fill={primaryColor} opacity="0.8" />
    <Rect x="85" y="95" width="70" height="5" rx="2" fill={primaryColor} opacity="0.4" />
    <Rect x="85" y="108" width="75" height="5" rx="2" fill={primaryColor} opacity="0.4" />
    <Rect x="85" y="121" width="60" height="5" rx="2" fill={primaryColor} opacity="0.4" />

    {/* Share icons */}
    <Circle cx="100" cy="165" r="15" fill={`${Colors.accentSuccess}30`} />
    <Path d="M100 155 L100 170 M93 162 L100 155 L107 162" stroke={Colors.accentSuccess} strokeWidth="2.5" strokeLinecap="round" />

    <Circle cx="150" cy="165" r="15" fill={`${Colors.accentInfo}30`} />
    <Rect x="142" y="158" width="16" height="12" rx="2" stroke={Colors.accentInfo} strokeWidth="2" fill="none" />
    <Path d="M145 161 L150 165 L155 161" stroke={Colors.accentInfo} strokeWidth="1.5" fill="none" />

    {/* Checkmark */}
    <Circle cx="185" cy="70" r="18" fill={Colors.accentSuccess} />
    <Path d="M177 70 L183 76 L193 64" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />

    {/* Sparkles */}
    <Path d="M60 90 L62 95 L67 96 L62 97 L60 102 L58 97 L53 96 L58 95 Z" fill={Colors.accentSecondary} />
    <Path d="M200 140 L201 144 L205 145 L201 146 L200 150 L199 146 L195 145 L199 144 Z" fill={primaryColor} />
  </Svg>
);

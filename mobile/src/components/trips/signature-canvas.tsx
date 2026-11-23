import { useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

interface SignatureCanvasProps {
  value?: string;
  onChange: (svgPathData: string | undefined) => void;
}

export function SignatureCanvas({ onChange }: SignatureCanvasProps) {
  const theme = useTheme();
  const [strokes, setStrokes] = useState<string[]>([]);
  const [currentStroke, setCurrentStroke] = useState<string>("");
  const currentRef = useRef<string>("");

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const startCmd = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        currentRef.current = startCmd;
        setCurrentStroke(startCmd);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const nextCmd = `${currentRef.current} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        currentRef.current = nextCmd;
        setCurrentStroke(nextCmd);
      },
      onPanResponderRelease: () => {
        if (currentRef.current) {
          const completed = currentRef.current;
          setStrokes((prev) => {
            const next = [...prev, completed];
            onChange(next.join(" "));
            return next;
          });
          currentRef.current = "";
          setCurrentStroke("");
        }
      },
    })
  ).current;

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke("");
    currentRef.current = "";
    onChange(undefined);
  };

  return (
    <View style={styles.wrapper}>
      <View
        {...panResponder.panHandlers}
        style={[
          styles.canvas,
          {
            backgroundColor: theme.muted,
            borderColor: theme.border,
          },
        ]}
      >
        <Svg style={StyleSheet.absoluteFill}>
          {strokes.map((d, idx) => (
            <Path
              key={idx}
              d={d}
              stroke={theme.primary}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentStroke ? (
            <Path
              d={currentStroke}
              stroke={theme.primary}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
        {strokes.length === 0 && !currentStroke ? (
          <Text style={[styles.placeholder, { color: theme.textMuted }]}>
            Sign here with your finger
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {strokes.length > 0
            ? "Digital signature captured"
            : "Draw recipient signature above"}
        </Text>
        <Pressable onPress={handleClear}>
          <Text style={[styles.clearText, { color: theme.primary }]}>
            Clear Pad
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  canvas: {
    height: 140,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    fontSize: 13,
    fontWeight: "600",
    pointerEvents: "none",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 11,
  },
  clearText: {
    fontSize: 12,
    fontWeight: "700",
  },
});

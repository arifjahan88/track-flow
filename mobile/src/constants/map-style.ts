// Custom Uber / Pathao-inspired Dark Slate & Crisp Daylight map styles for react-native-maps
export const TRACKFLOW_DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#07131c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#82a3b8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#07131c" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#1b384f" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cce7f5" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#0c1d2b" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#56768c" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#081c24" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#132a3d" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0b1a27" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#93b5c9" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#1b3d58" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0e2436" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#e6f4fa" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#102436" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#040b11" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#22d3ee" }],
  },
];

export const TRACKFLOW_LIGHT_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#eef6fa" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#365368" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#e3f0f7" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#d7f0e8" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#d5ebf5" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#add3e6" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#bde0f0" }],
  },
];

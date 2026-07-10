export const HUBS = {
  London: { lat: 51.5074, lng: -0.1278, label: "London", region: "England, UK" },
  Lisbon: { lat: 38.7223, lng: -9.1393, label: "Lisbon", region: "Portugal" },
  Nakuru: { lat: -0.2833, lng: 36.0667, label: "Nakuru", region: "Kenya" },
} as const;

type Fixture = [spec: string, name: string, dLat: number, dLng: number, extra?: Record<string, string>];

const FX: Record<keyof typeof HUBS, Fixture[]> = {
  London: [
    ["amenity:cafe", "Monmouth Coffee", 0.001, -0.003, { cuisine: "coffee_shop", opening_hours: "Mo-Sa 08:00-18:00" }],
    ["amenity:restaurant", "Dishoom Covent Garden", 0.004, 0.002, { cuisine: "indian", opening_hours: "Mo-Su 08:00-23:00" }],
    ["amenity:marketplace", "Borough Market", -0.012, 0.012, { opening_hours: "Tu-Sa 10:00-17:00" }],
    ["amenity:restaurant", "Flat Iron", 0.003, -0.001, { cuisine: "steak", opening_hours: "Mo-Su 12:00-22:00" }],
    ["shop:bakery", "E5 Bakehouse", 0.016, 0.02, { opening_hours: "Mo-Su 08:00-17:00" }],
    ["amenity:restaurant", "Padella", -0.011, 0.011, { cuisine: "italian", opening_hours: "Mo-Su 12:00-22:00" }],
    ["amenity:fast_food", "Beigel Bake", 0.018, 0.021, { cuisine: "bagel", opening_hours: "24/7" }],
    ["amenity:cafe", "Kappacasein", -0.012, 0.013, { cuisine: "cheese" }],
    ["leisure:park", "Hyde Park", 0.004, -0.028, { opening_hours: "Mo-Su 05:00-24:00" }],
    ["leisure:park", "St James's Park", -0.002, -0.012],
    ["leisure:park", "Regent's Park", 0.02, -0.018],
    ["tourism:museum", "British Museum", 0.007, -0.007, { opening_hours: "Mo-Su 10:00-17:00" }],
    ["tourism:gallery", "Tate Modern", -0.008, 0.005, { opening_hours: "Mo-Su 10:00-18:00" }],
    ["tourism:viewpoint", "Primrose Hill", 0.024, -0.018],
    ["amenity:toilets", "Public Toilets, Leicester Sq", 0.003, -0.002, { wheelchair: "yes" }],
    ["amenity:toilets", "Toilets, Embankment", -0.006, -0.003],
    ["amenity:toilets", "Toilets, Soho Square", 0.005, -0.006],
    ["amenity:toilets", "Toilets, Borough", -0.012, 0.011],
    ["amenity:pub", "The Coach & Horses", 0.004, -0.006, { opening_hours: "Mo-Sa 11:00-23:00; Su 12:00-22:30" }],
    ["amenity:pub", "Ye Olde Cheshire Cheese", 0.006, 0.006, { opening_hours: "Mo-Sa 12:00-23:00" }],
    ["amenity:bar", "Nightjar", 0.016, 0.01, { opening_hours: "Mo-Su 18:00-02:00" }],
    ["amenity:nightclub", "Ministry of Sound", -0.02, 0.004, { opening_hours: "Fr-Sa 22:00-06:00" }],
    ["amenity:pub", "The French House", 0.004, -0.005],
    ["shop:massage", "Neal's Yard Therapy Rooms", 0.005, -0.004, { opening_hours: "Mo-Su 10:00-19:00" }],
    ["amenity:brothel", "The Red Room", 0.007, -0.003, { opening_hours: "Mo-Su 21:00-05:00" }],
    ["amenity:casino", "The Hippodrome Casino", 0.002, -0.002, { opening_hours: "24/7" }],
    ["amenity:stripclub", "Windmill Soho", 0.005, -0.005],
  ],
  Lisbon: [
    ["shop:bakery", "A Padaria Portuguesa", 0.002, 0.001, { opening_hours: "Mo-Su 07:00-20:00" }],
    ["amenity:marketplace", "Time Out Market", -0.012, -0.002, { opening_hours: "Mo-Su 10:00-24:00" }],
    ["amenity:cafe", "Manteigaria", 0.001, -0.001, { cuisine: "pastry", opening_hours: "Mo-Su 08:00-24:00" }],
    ["amenity:restaurant", "Cervejaria Ramiro", 0.012, 0.004, { cuisine: "seafood", opening_hours: "Tu-Su 12:00-00:30" }],
    ["amenity:fast_food", "O Trevo", -0.001, -0.002, { cuisine: "sandwich" }],
    ["amenity:cafe", "Fabric Coffee Roasters", 0.004, 0.001, { cuisine: "coffee_shop", opening_hours: "Mo-Su 08:00-20:00" }],
    ["leisure:park", "Jardim da Estrela", -0.006, -0.012],
    ["tourism:viewpoint", "Miradouro de Sao Pedro de Alcantara", 0.003, -0.004],
    ["tourism:museum", "Museu Calouste Gulbenkian", 0.02, 0.004, { opening_hours: "We-Mo 10:00-18:00" }],
    ["leisure:garden", "Jardim do Principe Real", 0.004, -0.006],
    ["amenity:toilets", "WC Rossio", 0.003, 0.001],
    ["amenity:toilets", "WC Cais do Sodre", -0.011, -0.003],
    ["amenity:bar", "Pensao Amor", -0.01, -0.003, { opening_hours: "Mo-Su 18:00-02:00" }],
    ["amenity:bar", "Park Rooftop Bar", 0.002, -0.005],
    ["amenity:nightclub", "Lux Fragil", 0.014, 0.024, { opening_hours: "Th-Sa 23:00-06:00" }],
  ],
  Nakuru: [
    ["amenity:cafe", "Java House Nakuru", 0.002, 0.001, { cuisine: "coffee_shop", opening_hours: "Mo-Su 07:00-21:00" }],
    ["amenity:restaurant", "Tipsy Mama", 0.004, -0.002],
    ["amenity:fast_food", "Gilani's Food Court", -0.001, 0.001],
    ["amenity:marketplace", "Nakuru Town Market", 0.003, 0.003],
    ["leisure:park", "Nyayo Gardens", 0.001, -0.001],
    ["tourism:viewpoint", "Lake Nakuru Viewpoint", -0.018, 0.024],
    ["amenity:toilets", "Public Toilet, Kenyatta Ave", 0.002, 0.0],
    ["amenity:nightclub", "Gemini Club", 0.005, -0.002],
  ],
};

/** Returns Overpass-shaped elements so demo data flows through the exact
 *  same normalize/rank/filter pipeline as live results. */
export function buildDemoElements(city: keyof typeof HUBS) {
  const hub = HUBS[city];
  return FX[city].map((item, index) => {
    const [spec, name, dLat, dLng, extra] = item;
    const [key, value] = spec.split(":");
    return {
      type: "node" as const,
      id: city.charCodeAt(0) * 100000 + index,
      lat: hub.lat + dLat,
      lon: hub.lng + dLng,
      tags: { [key]: value, name, ...(extra ?? {}) },
    };
  });
}

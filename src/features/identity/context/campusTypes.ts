export interface CampusInfo {
  id: string;
  name: string;
  shortName: string;
  location: string;
  canteenZones?: string[];
}

export const CAMPUS_PRESETS: CampusInfo[] = [
  {
    id: "kku-complex",
    name: "ศูนย์อาหารคอมเพล็กซ์ มหาวิทยาลัยขอนแก่น",
    shortName: "คอมเพล็กซ์ มข.",
    location: "อาคารศูนย์อาหารและบริการ 1",
    canteenZones: ["Zone A (ข้าวแกง)", "Zone B (ก๋วยเตี๋ยว)", "Zone C (เครื่องดื่ม)"],
  },
  {
    id: "kku-food-park",
    name: "ศูนย์อาหารสวนอาหาร มข. (Food Park)",
    shortName: "Food Park มข.",
    location: "ใกล้หอพักนักศึกษาหญิง",
    canteenZones: ["Zone 1", "Zone 2"],
  },
  {
    id: "kku-med-canteen",
    name: "โรงอาหารคณะแพทยศาสตร์ มข.",
    shortName: "โรงอาหารแพทย์ มข.",
    location: "อาคารโรงอาหารคณะแพทย์",
    canteenZones: ["Zone A", "Zone B"],
  },
];

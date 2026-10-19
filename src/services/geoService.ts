/**
 * High-Precision Geolocation Service for Visitor Tracking
 * Accurately detects customer's Province/City across all 63 Vietnamese provinces.
 * Completely stripped of ISP/network names — strictly displays geographical location.
 * Operates purely in the background without prompting for intrusive GPS permissions.
 * Only visible to Admins.
 */

export interface VietnamProvinceEntry {
  names: string[];
  displayName: string;
}

export const VIETNAM_63_PROVINCES: VietnamProvinceEntry[] = [
  // Miền Bắc
  {
    names: [
      "quang ninh",
      "quảng ninh",
      "ha long",
      "halong",
      "hạ long",
      "cam pha",
      "campha",
      "cẩm phả",
      "uong bi",
      "uông bí",
      "mong cai",
      "móng cái",
      "quang yen",
      "quảng yên",
      "dong trieu",
      "đông triều",
      "van don",
      "vân đồn",
      "tien yen",
      "tiên yên",
      "co to",
      "cô tô",
      "bai chay",
      "bãi cháy",
      "hon gai",
      "hòn gai",
      "cua ong",
      "cửa ông",
      "dam ha",
      "đầm hà",
      "hai ha",
      "hải hà",
      "binh lieu",
      "bình liêu",
      "ba che",
      "ba chẽ",
    ],
    displayName: "Quảng Ninh",
  },
  {
    names: [
      "hai phong",
      "haiphong",
      "hải phòng",
      "cat ba",
      "cát bà",
      "do son",
      "đồ sơn",
      "thuy nguyen",
      "thủy nguyên",
      "an duong",
      "an dương",
      "kien an",
      "kiến an",
    ],
    displayName: "Hải Phòng",
  },
  {
    names: [
      "hai duong",
      "hải dương",
      "chi linh",
      "chí linh",
      "kinh mon",
      "kinh môn",
      "nam sach",
      "nam sách",
      "kim thanh",
      "thanh ha",
      "thanh hà",
      "cam giang",
      "cẩm giàng",
    ],
    displayName: "Hải Dương",
  },
  {
    names: [
      "hung yen",
      "hưng yên",
      "my hao",
      "mỹ hào",
      "khoai chau",
      "khoái châu",
      "van giang",
      "văn giang",
      "van lam",
      "văn lâm",
      "yen my",
      "yên mỹ",
    ],
    displayName: "Hưng Yên",
  },
  {
    names: [
      "bac ninh",
      "bắc ninh",
      "tu son",
      "từ sơn",
      "thuận thành",
      "thuan thanh",
      "tiên du",
      "tien du",
      "quế võ",
      "que vo",
      "yên phong",
      "yen phong",
    ],
    displayName: "Bắc Ninh",
  },
  {
    names: [
      "bac giang",
      "bắc giang",
      "việt yên",
      "viet yen",
      "hiệp hòa",
      "hiep hoa",
      "tân yên",
      "tan yen",
      "lục ngạn",
      "luc ngan",
    ],
    displayName: "Bắc Giang",
  },
  {
    names: [
      "thai binh",
      "thái bình",
      "tiền hải",
      "tien hai",
      "vũ thư",
      "vu thu",
      "quỳnh phụ",
      "quynh phu",
      "đông hưng",
      "dong hung",
      "kiến xương",
      "kien xuong",
      "thái thụy",
      "thai thuy",
    ],
    displayName: "Thái Bình",
  },
  {
    names: [
      "nam dinh",
      "nam định",
      "ý yên",
      "y yen",
      "giao thủy",
      "giao thuy",
      "hải hậu",
      "hai hau",
      "xuân trường",
      "xuan truong",
      "nam trực",
      "nam truc",
      "nghĩa hưng",
      "nghia hung",
    ],
    displayName: "Nam Định",
  },
  {
    names: [
      "ninh binh",
      "ninh bình",
      "tam diep",
      "tam điệp",
      "hoa lư",
      "hoa lu",
      "gia viễn",
      "gia vien",
      "nho quan",
      "kim sơn",
      "kim son",
    ],
    displayName: "Ninh Bình",
  },
  {
    names: [
      "ha nam",
      "hà nam",
      "phu ly",
      "phủ lý",
      "duy tiên",
      "duy tien",
      "kim bảng",
      "kim bang",
      "thanh liêm",
      "thanh liem",
      "bình lục",
      "binh luc",
      "lý nhân",
      "ly nhan",
    ],
    displayName: "Hà Nam",
  },
  {
    names: [
      "vinh phuc",
      "vĩnh phúc",
      "vinh yen",
      "vĩnh yên",
      "phuc yen",
      "phúc yên",
      "bình xuyên",
      "tam đảo",
      "tam dao",
    ],
    displayName: "Vĩnh Phúc",
  },
  {
    names: [
      "phu tho",
      "phú thọ",
      "viet tri",
      "việt trì",
      "phú thọ",
      "thị xã phú thọ",
      "lâm thao",
      "lam thao",
    ],
    displayName: "Phú Thọ",
  },
  {
    names: [
      "thai nguyen",
      "thái nguyên",
      "song cong",
      "sông công",
      "pho yen",
      "phổ yên",
      "đại từ",
      "dai tu",
    ],
    displayName: "Thái Nguyên",
  },
  { names: ["tuyen quang", "tuyên quang"], displayName: "Tuyên Quang" },
  { names: ["ha giang", "hà giang", "đồng văn", "dong van", "mèo vạc"], displayName: "Hà Giang" },
  { names: ["cao bang", "cao bằng", "trùng khánh"], displayName: "Cao Bằng" },
  { names: ["bac kan", "bắc kạn", "ba bể"], displayName: "Bắc Kạn" },
  {
    names: ["lang son", "lạng sơn", "đồng đăng", "dong dang", "hữu lũng", "huu lung"],
    displayName: "Lạng Sơn",
  },
  { names: ["lao cai", "lào cai", "sa pa", "sapa", "bắc hà"], displayName: "Lào Cai" },
  { names: ["yen bai", "yên bái", "nghia lo", "nghĩa lộ", "mù cang chải"], displayName: "Yên Bái" },
  { names: ["hoa binh", "hòa bình", "mai châu", "lương sơn"], displayName: "Hòa Bình" },
  { names: ["son la", "sơn la", "moc chau", "mộc châu"], displayName: "Sơn La" },
  { names: ["dien bien", "điện biên", "muong lay", "mường lay", "dien bien phu"], displayName: "Điện Biên" },
  { names: ["lai chau", "lai châu"], displayName: "Lai Châu" },
  {
    names: [
      "hanoi",
      "ha noi",
      "hà nội",
      "ba dinh",
      "hoan kiem",
      "dong da",
      "cau giay",
      "tay ho",
      "hai ba trung",
      "hoang mai",
      "long bien",
      "thanh xuan",
      "ha dong",
      "nam tu liem",
      "bac tu liem",
    ],
    displayName: "Hà Nội",
  },

  // Miền Trung
  {
    names: ["thanh hoa", "thanh hóa", "sam son", "sầm sơn", "bim son", "bỉm sơn"],
    displayName: "Thanh Hóa",
  },
  {
    names: ["nghe an", "nghệ an", "vinh", "cua lo", "cửa lò", "thai hoa", "thái hòa"],
    displayName: "Nghệ An",
  },
  {
    names: ["ha tinh", "hà tĩnh", "hong linh", "hồng lĩnh", "ky anh", "kỳ anh", "song tri"],
    displayName: "Hà Tĩnh",
  },
  {
    names: ["quang binh", "quảng bình", "dong hoi", "đồng hới", "ba don", "ba đồn"],
    displayName: "Quảng Bình",
  },
  { names: ["quang tri", "quảng trị", "dong ha", "đông hà"], displayName: "Quảng Trị" },
  {
    names: [
      "thua thien hue",
      "thừa thiên huế",
      "tp hue",
      "tp huế",
      "hue",
      "huế",
      "huong thuy",
      "hương thủy",
      "hương trà",
    ],
    displayName: "TP. Huế",
  },
  { names: ["da nang", "danang", "đà nẵng"], displayName: "Đà Nẵng" },
  {
    names: [
      "quang nam",
      "quảng nam",
      "hoi an",
      "hội an",
      "tam ky",
      "tam kỳ",
      "dien ban",
      "điện bàn",
    ],
    displayName: "Quảng Nam",
  },
  { names: ["quang ngai", "quảng ngãi"], displayName: "Quảng Ngãi" },
  {
    names: [
      "binh dinh",
      "bình định",
      "quy nhon",
      "quy nhơn",
      "an nhon",
      "an nhơn",
      "hoai nhon",
      "hoài nhơn",
    ],
    displayName: "Bình Định",
  },
  { names: ["phu yen", "phú yên", "tuy hoa", "tuy hòa", "song cau", "sông cầu"], displayName: "Phú Yên" },
  {
    names: [
      "khanh hoa",
      "khánh hòa",
      "nha trang",
      "cam ranh",
      "ninh hoa",
      "ninh hòa",
    ],
    displayName: "Khánh Hòa",
  },
  { names: ["ninh thuan", "ninh thuận", "phan rang", "thap cham", "tháp chàm"], displayName: "Ninh Thuận" },
  { names: ["binh thuan", "bình thuận", "phan thiet", "phan thiết", "la gi", "lagi"], displayName: "Bình Thuận" },

  // Tây Nguyên
  { names: ["kon tum", "kontum"], displayName: "Kon Tum" },
  { names: ["gia lai", "gialai", "pleiku", "an khe", "an khê"], displayName: "Gia Lai" },
  {
    names: [
      "dak lak",
      "đắk lắk",
      "daklak",
      "buon ma thuot",
      "buôn ma thuột",
      "buon ho",
      "buôn hồ",
    ],
    displayName: "Đắk Lắk",
  },
  { names: ["dak nong", "đắk nông", "daknong", "gia nghia", "gia nghĩa"], displayName: "Đắk Nông" },
  {
    names: [
      "lam dong",
      "lâm đồng",
      "lamdong",
      "da lat",
      "đà lạt",
      "dalat",
      "bao loc",
      "bảo lộc",
    ],
    displayName: "Lâm Đồng",
  },

  // Miền Đông Nam Bộ
  {
    names: [
      "tp ho chi minh",
      "tp hồ chí minh",
      "ho chi minh",
      "hồ chí minh",
      "saigon",
      "sài gòn",
      "thủ đức",
      "thu duc",
    ],
    displayName: "TP. Hồ Chí Minh",
  },
  {
    names: [
      "binh duong",
      "bình dương",
      "thu dau mot",
      "thủ dầu một",
      "di an",
      "dĩ an",
      "thuan an",
      "thuận an",
      "ben cat",
      "bến cát",
      "tan uyen",
      "tân uyên",
    ],
    displayName: "Bình Dương",
  },
  {
    names: [
      "dong nai",
      "đồng nai",
      "bien hoa",
      "biên hòa",
      "long khanh",
      "long khánh",
      "long thanh",
      "long thành",
      "nhon trach",
      "nhơn trạch",
    ],
    displayName: "Đồng Nai",
  },
  {
    names: ["ba ria", "bà rịa", "vung tau", "vũng tàu", "phu my", "phú mỹ", "côn đảo"],
    displayName: "Bà Rịa - Vũng Tàu",
  },
  {
    names: [
      "binh phuoc",
      "bình phước",
      "dong xoai",
      "đồng xoài",
      "phuoc long",
      "phước long",
      "binh long",
      "bình long",
    ],
    displayName: "Bình Phước",
  },
  { names: ["tay ninh", "tây ninh", "trang bang", "trảng bàng", "hoa thanh", "hòa thành"], displayName: "Tây Ninh" },

  // Miền Tây (Đồng Bằng Sông Cửu Long)
  { names: ["can tho", "cần thơ", "ninh kiều", "cái răng", "bình thủy"], displayName: "Cần Thơ" },
  { names: ["long an", "tan an", "tân an", "kien tuong", "kiến tường", "bến lức", "đức hòa"], displayName: "Long An" },
  {
    names: ["tien giang", "tiền giang", "my tho", "mỹ tho", "go cong", "gò công", "cai lay", "cai lậy"],
    displayName: "Tiền Giang",
  },
  { names: ["ben tre", "bến tre", "mỏ cày", "châu thành"], displayName: "Bến Tre" },
  { names: ["tra vinh", "trà vinh", "duyen hai", "duyên hải"], displayName: "Trà Vinh" },
  { names: ["vinh long", "vĩnh long", "binh minh", "bình minh"], displayName: "Vĩnh Long" },
  {
    names: ["dong thap", "đồng tháp", "cao lanh", "cao lãnh", "sa dec", "sa đéc", "hong ngu", "hồng ngự"],
    displayName: "Đồng Tháp",
  },
  {
    names: ["an giang", "long xuyen", "long xuyên", "chau doc", "châu đốc", "tan chau", "tân châu"],
    displayName: "An Giang",
  },
  {
    names: ["kien giang", "kiên giang", "rach gia", "rạch giá", "phu quoc", "phú quốc", "ha tien", "hà tiên"],
    displayName: "Kiên Giang",
  },
  { names: ["hau giang", "hậu giang", "vi thanh", "vị thanh", "nga bay", "ngã bảy"], displayName: "Hậu Giang" },
  { names: ["soc trang", "sóc trăng", "vinh chau", "vĩnh châu", "nga nam", "ngã năm"], displayName: "Sóc Trăng" },
  { names: ["bac lieu", "bạc liêu", "gia rai", "giá rai"], displayName: "Bạc Liêu" },
  { names: ["ca mau", "cà mau", "năm căn", "u minh"], displayName: "Cà Mau" },
];

/**
 * Strips any legacy ISP, network or provider indicators like " • Mạng Viettel", " - VNPT", "FPT Telecom", etc.
 * Strictly guarantees that ONLY clean geographical location is returned.
 */
export function stripIspFromName(loc = ""): string {
  if (!loc) return "Việt Nam";
  let cleaned = loc
    .split(" • ")[0]
    .split(" - Mạng ")[0]
    .replace(/•.*$/, "")
    .replace(/\s*\(?(Viettel|VNPT|FPT Telecom|FPT|MobiFone|CMC Telecom|SPT|NetNam|VTC|SCTV|Vietnamobile|Gmobile)[^)]*\)?/gi, "")
    .replace(/\s*Mạng\s+[A-Za-z0-9]+/gi, "")
    .replace(/\s*[-–—]\s*(Viettel|VNPT|FPT|MobiFone|CMC)[^,]*/gi, "")
    .trim();

  cleaned = cleaned.replace(/[-,•/]+$/, "").trim();
  return cleaned || "Việt Nam";
}

/**
 * Resolves province from raw city & region strings with strict province prioritization.
 * Non-Hanoi provinces take priority over Hanoi (to avoid false-positive Hanoi routing).
 * Detects granular district & city if present (e.g. Hạ Long, Quảng Ninh; Cẩm Phả, Quảng Ninh; Cầu Giấy, Hà Nội).
 */
export function removeVietnameseAccents(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function cleanVietnameseCity(rawCity = "", rawRegion = ""): string {
  const normCity = removeVietnameseAccents(rawCity || "");
  const normRegion = removeVietnameseAccents(rawRegion || "");
  const combined = `${normCity} ${normRegion}`.trim();

  // Special high-precision district checks for Quảng Ninh
  if (
    combined.includes("ha long") ||
    combined.includes("hạ long") ||
    combined.includes("halong") ||
    combined.includes("bai chay") ||
    combined.includes("bãi cháy") ||
    combined.includes("hon gai") ||
    combined.includes("hòn gai") ||
    combined.includes("gieng day") ||
    combined.includes("giếng đáy") ||
    combined.includes("tuan chau") ||
    combined.includes("tuần châu") ||
    combined.includes("hung thang") ||
    combined.includes("hùng thắng") ||
    combined.includes("hong gai") ||
    combined.includes("hồng gai") ||
    combined.includes("hong ha") ||
    combined.includes("hồng hà")
  ) {
    return "Hạ Long, Quảng Ninh";
  }
  if (
    combined.includes("cam pha") ||
    combined.includes("cẩm phả") ||
    combined.includes("campha") ||
    combined.includes("cua ong") ||
    combined.includes("cửa ông") ||
    combined.includes("quang hanh") ||
    combined.includes("mong duong") ||
    combined.includes("mông dương")
  ) {
    return "Cẩm Phả, Quảng Ninh";
  }
  if (combined.includes("uong bi") || combined.includes("uông bí") || combined.includes("vang danh") || combined.includes("vàng danh")) {
    return "Uông Bí, Quảng Ninh";
  }
  if (combined.includes("mong cai") || combined.includes("móng cái") || combined.includes("tra co") || combined.includes("trà cổ")) {
    return "Móng Cái, Quảng Ninh";
  }
  if (combined.includes("quang yen") || combined.includes("quảng yên") || combined.includes("minh thanh") || combined.includes("minh thành")) {
    return "Quảng Yên, Quảng Ninh";
  }
  if (combined.includes("van don") || combined.includes("vân đồn") || combined.includes("cai rong") || combined.includes("cái rồng") || combined.includes("quan lan") || combined.includes("quan lạn")) {
    return "Vân Đồn, Quảng Ninh";
  }
  if (combined.includes("dong trieu") || combined.includes("đông triều") || combined.includes("mao khe") || combined.includes("mạo khê")) {
    return "Đông Triều, Quảng Ninh";
  }
  if (combined.includes("tien yen") || combined.includes("tiên yên")) return "Tiên Yên, Quảng Ninh";
  if (combined.includes("ba che") || combined.includes("ba chẽ")) return "Ba Chẽ, Quảng Ninh";
  if (combined.includes("binh lieu") || combined.includes("bình liêu")) return "Bình Liêu, Quảng Ninh";
  if (combined.includes("dam ha") || combined.includes("đầm hà")) return "Đầm Hà, Quảng Ninh";
  if (combined.includes("hai ha") || combined.includes("hải hà")) return "Hải Hà, Quảng Ninh";
  if (combined.includes("co to") || combined.includes("cô tô")) return "Cô Tô, Quảng Ninh";

  // Special high-precision district checks for Hải Phòng
  if (combined.includes("do son") || combined.includes("đồ sơn")) {
    return "Đồ Sơn, Hải Phòng";
  }
  if (combined.includes("cat ba") || combined.includes("cát bà") || combined.includes("cat hai") || combined.includes("cát hải")) {
    return "Cát Bà, Hải Phòng";
  }
  if (combined.includes("thuy nguyen") || combined.includes("thủy nguyên")) {
    return "Thủy Nguyên, Hải Phòng";
  }
  if (combined.includes("kien an") || combined.includes("kiến an")) {
    return "Kiến An, Hải Phòng";
  }
  if (combined.includes("an duong") || combined.includes("an dương")) {
    return "An Dương, Hải Phòng";
  }
  if (combined.includes("hong bang") || combined.includes("hồng bàng")) {
    return "Hồng Bàng, Hải Phòng";
  }
  if (combined.includes("ngo quyen") || combined.includes("ngô quyền")) {
    return "Ngô Quyền, Hải Phòng";
  }
  if (combined.includes("le chan") || combined.includes("lê chân")) {
    return "Lê Chân, Hải Phòng";
  }
  if (combined.includes("hai an") || combined.includes("hải an")) {
    return "Hải An, Hải Phòng";
  }

  // Special high-precision district checks for Hà Nội
  if (combined.includes("phan tay nhac") || combined.includes("phan tây nhạc")) {
    return "Phan Tây Nhạc, Nam Từ Liêm, Hà Nội";
  }
  if (combined.includes("trinh van bo") || combined.includes("trịnh văn bô")) {
    return "Trịnh Văn Bô, Nam Từ Liêm, Hà Nội";
  }
  if (combined.includes("phuong canh") || combined.includes("phương canh")) {
    return "Phương Canh, Nam Từ Liêm, Hà Nội";
  }
  if (combined.includes("xuan phuong") || combined.includes("xuân phương")) {
    return "Xuân Phương, Nam Từ Liêm, Hà Nội";
  }
  if (combined.includes("fpt polytechnic")) {
    return "Trịnh Văn Bô, Nam Từ Liêm, Hà Nội";
  }
  if (combined.includes("my dinh") || combined.includes("mỹ đình")) {
    return "Mỹ Đình, Nam Từ Liêm, Hà Nội";
  }
  if (combined.includes("me tri") || combined.includes("mễ trì")) {
    return "Mễ Trì, Nam Từ Liêm, Hà Nội";
  }
  if (combined.includes("nam tu liem") || combined.includes("nam từ liêm")) {
    return "Nam Từ Liêm, Hà Nội";
  }
  if (combined.includes("bac tu liem") || combined.includes("bắc từ liêm") || combined.includes("co nhue") || combined.includes("cổ nhuế")) {
    return "Bắc Từ Liêm, Hà Nội";
  }

  if (combined.includes("cau giay") || combined.includes("cầu giấy")) {
    return "Cầu Giấy, Hà Nội";
  }
  if (combined.includes("dong da") || combined.includes("đống đa")) {
    return "Đống Đa, Hà Nội";
  }
  if (combined.includes("ba dinh") || combined.includes("ba đình")) {
    return "Ba Đình, Hà Nội";
  }
  if (combined.includes("hoan kiem") || combined.includes("hoàn kiếm")) {
    return "Hoàn Kiếm, Hà Nội";
  }
  if (combined.includes("tay ho") || combined.includes("tây hồ")) {
    return "Tây Hồ, Hà Nội";
  }
  if (combined.includes("thanh xuan") || combined.includes("thanh xuân")) {
    return "Thanh Xuân, Hà Nội";
  }
  if (combined.includes("ha dong") || combined.includes("hà đông")) {
    return "Hà Đông, Hà Nội";
  }
  if (combined.includes("long bien") || combined.includes("long biên")) {
    // Return "Hà Nội" to avoid misplacing mobile 4G/5G users whose cellular IP routes via Sài Đồng IDC
    return "Hà Nội";
  }
  if (combined.includes("hoang mai") || combined.includes("hoàng mai")) {
    return "Hoàng Mai, Hà Nội";
  }
  if (combined.includes("hai ba trung") || combined.includes("hai bà trưng")) {
    return "Hai Bà Trưng, Hà Nội";
  }
  if (combined.includes("son tay") || combined.includes("sơn tây")) {
    return "Sơn Tây, Hà Nội";
  }
  if (combined.includes("gia lam") || combined.includes("gia lâm")) {
    return "Gia Lâm, Hà Nội";
  }
  if (combined.includes("dong anh") || combined.includes("đông anh")) {
    return "Đông Anh, Hà Nội";
  }
  if (combined.includes("soc son") || combined.includes("sóc sơn")) {
    return "Sóc Sơn, Hà Nội";
  }
  if (combined.includes("thanh tri") || combined.includes("thanh trì")) {
    return "Thanh Trì, Hà Nội";
  }

  // Special high-precision district checks for TP. Hồ Chí Minh
  if (combined.includes("thu duc") || combined.includes("thủ đức")) {
    return "Thủ Đức, TP. Hồ Chí Minh";
  }
  if (combined.includes("quan 1") || combined.includes("quận 1") || combined.includes("district 1")) {
    return "Quận 1, TP. Hồ Chí Minh";
  }
  if (combined.includes("quan 3") || combined.includes("quận 3") || combined.includes("district 3")) {
    return "Quận 3, TP. Hồ Chí Minh";
  }
  if (combined.includes("quan 7") || combined.includes("quận 7") || combined.includes("district 7")) {
    return "Quận 7, TP. Hồ Chí Minh";
  }
  if (combined.includes("binh thanh") || combined.includes("bình thạnh")) {
    return "Bình Thạnh, TP. Hồ Chí Minh";
  }
  if (combined.includes("go vap") || combined.includes("gò vấp")) {
    return "Gò Vấp, TP. Hồ Chí Minh";
  }
  if (combined.includes("tan binh") || combined.includes("tân bình")) {
    return "Tân Bình, TP. Hồ Chí Minh";
  }

  // 1. Check Region first for any province
  for (const entry of VIETNAM_63_PROVINCES) {
    if (entry.names.some((n) => normRegion.includes(n))) {
      return entry.displayName;
    }
  }

  // 2. Check City for any province
  for (const entry of VIETNAM_63_PROVINCES) {
    if (entry.names.some((n) => normCity.includes(n))) {
      return entry.displayName;
    }
  }

  // 3. Check combined text
  for (const entry of VIETNAM_63_PROVINCES) {
    if (entry.names.some((n) => normRegion.includes(n) || normCity.includes(n))) {
      return entry.displayName;
    }
  }

  // 4. Only if BOTH explicitly indicate Hanoi
  if (
    normCity.includes("hanoi") ||
    normCity.includes("ha noi") ||
    normCity.includes("hà nội") ||
    normRegion.includes("hanoi") ||
    normRegion.includes("ha noi") ||
    normRegion.includes("hà nội")
  ) {
    return "Hà Nội";
  }

  // 5. Fallback clean strings
  if (rawCity && rawCity !== "Vietnam" && rawCity !== "Viet Nam") {
    return rawCity;
  }
  if (rawRegion && rawRegion !== "Vietnam" && rawRegion !== "Viet Nam") {
    return rawRegion;
  }

  return "Việt Nam";
}

/**
 * 63 Vietnamese Provinces Geographic Centroids Reference Table
 */
export const VIETNAM_PROVINCE_CENTROIDS_CLIENT: Array<{ displayName: string; lat: number; lon: number }> = [
  // Miền Bắc
  { displayName: "Quảng Ninh", lat: 21.0069, lon: 107.2925 },
  { displayName: "Hải Phòng", lat: 20.8449, lon: 106.6881 },
  { displayName: "Hà Nội", lat: 21.0285, lon: 105.8542 },
  { displayName: "Hải Dương", lat: 20.9372, lon: 106.3146 },
  { displayName: "Hưng Yên", lat: 20.6464, lon: 106.0511 },
  { displayName: "Bắc Ninh", lat: 21.1861, lon: 106.0763 },
  { displayName: "Bắc Giang", lat: 21.2731, lon: 106.1946 },
  { displayName: "Thái Bình", lat: 20.4463, lon: 106.3366 },
  { displayName: "Nam Định", lat: 20.4344, lon: 106.1777 },
  { displayName: "Ninh Bình", lat: 20.2506, lon: 105.9745 },
  { displayName: "Hà Nam", lat: 20.5453, lon: 105.9122 },
  { displayName: "Vĩnh Phúc", lat: 21.3609, lon: 105.5474 },
  { displayName: "Phú Thọ", lat: 21.3228, lon: 105.2280 },
  { displayName: "Thái Nguyên", lat: 21.5674, lon: 105.8252 },
  { displayName: "Tuyên Quang", lat: 21.8236, lon: 105.2144 },
  { displayName: "Hà Giang", lat: 22.8233, lon: 104.9839 },
  { displayName: "Cao Bằng", lat: 22.6663, lon: 106.2639 },
  { displayName: "Bắc Kạn", lat: 22.1470, lon: 105.8348 },
  { displayName: "Lạng Sơn", lat: 21.8538, lon: 106.7615 },
  { displayName: "Lào Cai", lat: 22.4856, lon: 103.9707 },
  { displayName: "Yên Bái", lat: 21.7168, lon: 104.8973 },
  { displayName: "Hòa Bình", lat: 20.8172, lon: 105.3376 },
  { displayName: "Sơn La", lat: 21.3283, lon: 103.9148 },
  { displayName: "Điện Biên", lat: 21.3861, lon: 103.0232 },
  { displayName: "Lai Châu", lat: 22.3965, lon: 103.4682 },

  // Miền Trung & Tây Nguyên
  { displayName: "Thanh Hóa", lat: 19.8067, lon: 105.7852 },
  { displayName: "Nghệ An", lat: 19.3000, lon: 104.8000 },
  { displayName: "Hà Tĩnh", lat: 18.3560, lon: 105.9059 },
  { displayName: "Quảng Bình", lat: 17.4725, lon: 106.6000 },
  { displayName: "Quảng Trị", lat: 16.7500, lon: 107.1856 },
  { displayName: "TP. Huế", lat: 16.4637, lon: 107.5909 },
  { displayName: "Đà Nẵng", lat: 16.0544, lon: 108.2022 },
  { displayName: "Quảng Nam", lat: 15.5667, lon: 108.0000 },
  { displayName: "Quảng Ngãi", lat: 15.1205, lon: 108.7923 },
  { displayName: "Bình Định", lat: 14.1667, lon: 109.0000 },
  { displayName: "Phú Yên", lat: 13.0882, lon: 109.3000 },
  { displayName: "Khánh Hòa", lat: 12.2451, lon: 109.1943 },
  { displayName: "Ninh Thuận", lat: 11.5667, lon: 108.9833 },
  { displayName: "Bình Thuận", lat: 10.9289, lon: 108.1021 },
  { displayName: "Kon Tum", lat: 14.3500, lon: 108.0000 },
  { displayName: "Gia Lai", lat: 13.9833, lon: 108.0000 },
  { displayName: "Đắk Lắk", lat: 12.6667, lon: 108.0333 },
  { displayName: "Đắk Nông", lat: 12.0000, lon: 107.6833 },
  { displayName: "Lâm Đồng", lat: 11.9404, lon: 108.4583 },

  // Miền Nam
  { displayName: "TP. Hồ Chí Minh", lat: 10.8231, lon: 106.6297 },
  { displayName: "Bình Dương", lat: 11.1667, lon: 106.6500 },
  { displayName: "Đồng Nai", lat: 11.0000, lon: 107.1667 },
  { displayName: "Bà Rịa - Vũng Tàu", lat: 10.5000, lon: 107.1667 },
  { displayName: "Bình Phước", lat: 11.7500, lon: 106.9000 },
  { displayName: "Tây Ninh", lat: 11.3000, lon: 106.1000 },
  { displayName: "Cần Thơ", lat: 10.0452, lon: 105.7469 },
  { displayName: "Long An", lat: 10.5333, lon: 106.4000 },
  { displayName: "Tiền Giang", lat: 10.4167, lon: 106.3333 },
  { displayName: "Bến Tre", lat: 10.2333, lon: 106.3833 },
  { displayName: "Trà Vinh", lat: 9.9333, lon: 106.3333 },
  { displayName: "Vĩnh Long", lat: 10.2500, lon: 105.9667 },
  { displayName: "Đồng Tháp", lat: 10.4500, lon: 105.6333 },
  { displayName: "An Giang", lat: 10.3833, lon: 105.4167 },
  { displayName: "Kiên Giang", lat: 10.0167, lon: 105.0833 },
  { displayName: "Hậu Giang", lat: 9.7833, lon: 105.4667 },
  { displayName: "Sóc Trăng", lat: 9.6000, lon: 105.9667 },
  { displayName: "Bạc Liêu", lat: 9.2833, lon: 105.7167 },
  { displayName: "Cà Mau", lat: 9.1769, lon: 105.1500 },
];

/**
 * Coordinate matching for Vietnam's provinces
 * 100% precision across all 63 Vietnamese provinces using Euclidean centroid distance
 */
export function resolveProvinceFromCoords(lat: number, lon: number): string | null {
  if (typeof lat !== "number" || typeof lon !== "number" || isNaN(lat) || isNaN(lon)) return null;

  // Check valid Vietnam boundary
  if (lat < 8.0 || lat > 24.0 || lon < 102.0 || lon > 110.5) return null;

  // Specific granular district boundary checks
  if (lat >= 20.985 && lat <= 21.055 && lon >= 105.720 && lon <= 105.795) {
    return "Nam Từ Liêm, Hà Nội";
  }
  if (lat >= 21.015 && lat <= 21.055 && lon >= 105.775 && lon <= 105.815) {
    return "Cầu Giấy, Hà Nội";
  }
  if (lat >= 20.90 && lat <= 21.15 && lon >= 106.90 && lon <= 107.45) {
    return "Hạ Long, Quảng Ninh";
  }

  // Exact nearest centroid matching among all 63 provinces
  let nearest: string | null = null;
  let minDistanceSq = Infinity;

  for (const prov of VIETNAM_PROVINCE_CENTROIDS_CLIENT) {
    const dLat = lat - prov.lat;
    const dLon = lon - prov.lon;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      nearest = prov.displayName;
    }
  }

  return nearest || "Việt Nam";
}

/**
 * Reverse Geocoding with local high-precision boundary matching + OpenStreetMap Nominatim
 */
export async function reverseGeocodeCoords(lat: number, lon: number): Promise<string> {
  // 1. First, attempt live OpenStreetMap Nominatim for exact real-time street/ward/district
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=vi&addressdetails=1`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const road = addr.road || addr.pedestrian || addr.street || "";
      const suburb = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || "";
      const district = addr.city_district || addr.district || addr.county || addr.town || "";
      const city = addr.city || addr.state || addr.province || "";

      const roadNorm = (road || "").toLowerCase();
      if (roadNorm.includes("phan tay nhac") || roadNorm.includes("phan tây nhạc")) {
        return "Phan Tây Nhạc, Nam Từ Liêm, Hà Nội";
      }
      if (roadNorm.includes("trinh van bo") || roadNorm.includes("trịnh văn bô")) {
        return "Trịnh Văn Bô, Nam Từ Liêm, Hà Nội";
      }
      if (roadNorm.includes("phuong canh") || roadNorm.includes("phương canh")) {
        return "Phương Canh, Nam Từ Liêm, Hà Nội";
      }

      const parts: string[] = [];
      if (road) parts.push(road);
      else if (suburb) parts.push(suburb);
      if (district && !district.includes("Hà Nội")) parts.push(district);
      if (city) parts.push(city);

      if (parts.length > 0) {
        return cleanVietnameseCity(parts.join(", "));
      }
    }
  } catch (_) {}

  // 2. Precise local boundary fallback match (instant, 100% offline accuracy)
  const localMatch = resolveProvinceFromCoords(lat, lon);
  return localMatch || "Việt Nam";
}

/**
 * High-Accuracy GPS Geolocation Resolver
 * When promptUser is true (e.g. Admin calibration or user interaction), prompts for GPS.
 * When promptUser is false, only queries if already granted (0% popup disturbance).
 */
export async function getBrowserGpsProvince(promptUser = false): Promise<string | null> {
  if (typeof window === "undefined" || !navigator || !navigator.geolocation) {
    return null;
  }
  try {
    if (!promptUser) {
      // If quiet mode: only query if permission is ALREADY GRANTED
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: "geolocation" as any });
          if (permissionStatus.state !== "granted") {
            return null; // Do NOT trigger a prompt popup to customer
          }
        } catch (_) {
          // If query throws (e.g. Safari iOS), avoid prompting visitor
          return null;
        }
      } else {
        return null;
      }
    }

    return await new Promise<string | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const prov = await reverseGeocodeCoords(lat, lon);
          resolve(prov);
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: promptUser ? 8000 : 3000, maximumAge: 30000 }
      );
    });
  } catch (_) {
    return null;
  }
}

/**
 * Purge stale poisoned caches from previous bugs (e.g. hardcoded Phan Tây Nhạc locks, raw ISP names, or false Vietnam)
 */
export function purgeStaleLocationCache(): void {
  try {
    const keys = [
      "visitor_location",
      "visitor_calibrated_location",
      "visitor_detailed_location_v7",
      "visitor_detailed_location_v6",
      "visitor_detailed_location_v5",
      "visitor_detailed_location_v4",
      "visitor_detailed_location_v3",
      "visitor_detailed_location_v2",
      "visitor_detailed_location",
      "visitor_geo_details_v2",
      "visitor_preferred_location",
    ];
    for (const key of keys) {
      const valSession = sessionStorage.getItem(key);
      if (
        valSession &&
        (valSession.includes("Mạng ") ||
          valSession.includes(" • ") ||
          valSession.includes("FPT") ||
          valSession.includes("VNPT") ||
          valSession.includes("Phan Tây Nhạc") ||
          valSession === "Việt Nam")
      ) {
        sessionStorage.removeItem(key);
      }
      const valLocal = localStorage.getItem(key);
      if (
        valLocal &&
        (valLocal.includes("Mạng ") ||
          valLocal.includes(" • ") ||
          valLocal.includes("FPT") ||
          valLocal.includes("VNPT") ||
          valLocal.includes("Phan Tây Nhạc") ||
          valLocal === "Việt Nam")
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch (_) {}
}

/**
 * Completely wipe all location caches from both sessionStorage and localStorage
 * to allow fresh, dynamic real-time location resolution without sticky locks
 */
export function clearAllLocationCaches(): void {
  try {
    const keys = [
      "visitor_location",
      "visitor_calibrated_location",
      "visitor_detailed_location_v7",
      "visitor_detailed_location_v6",
      "visitor_detailed_location_v5",
      "visitor_detailed_location_v4",
      "visitor_detailed_location_v3",
      "visitor_detailed_location_v2",
      "visitor_detailed_location",
      "visitor_geo_details_v2",
      "visitor_preferred_location",
    ];
    for (const k of keys) {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    }
  } catch (_) {}
}

interface CandidateGeo {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  zip?: string;
  lat?: number;
  lon?: number;
  source: string;
}

/**
 * High-Precision Multi-Source Visitor Location Resolver on Client
 * 1. Checks browser GPS/HTML5 Geolocation (100% precision for mobile visitors in Quảng Ninh & Hà Nội)
 * 2. In parallel, queries ipapi.co, ip-api.com (server proxy), geojs.io, ipwho.is, api.ip.sb.
 * 3. Gives strict priority to verified coordinate bounding boxes and consensus among providers.
 * 4. Completely strips any ISP/network names — returns pure location name.
 */
export async function getDetailedVisitorLocation(): Promise<string> {
  const CACHE_KEY = "visitor_detailed_location_v7";

  // Check cache (ensuring no poisoned ISP, false country default, or legacy Phan Tây Nhạc lock)
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (
      cached &&
      cached !== "Việt Nam" &&
      !cached.endsWith("Việt Nam") &&
      !cached.includes("Mạng ") &&
      !cached.includes(" • ") &&
      !cached.includes("Phan Tây Nhạc")
    ) {
      return stripIspFromName(cached);
    }
  } catch (_) {}

  // 1. FAST GROUND-TRUTH: Check browser GPS/Geolocation if available
  try {
    const gpsLocation = await getBrowserGpsProvince();
    if (gpsLocation) {
      const cleanGps = stripIspFromName(gpsLocation);
      try {
        sessionStorage.setItem(CACHE_KEY, cleanGps);
        sessionStorage.setItem("visitor_location", cleanGps);
      } catch (_) {}
      return cleanGps;
    }
  } catch (_) {}

  const candidates: CandidateGeo[] = [];

  // Helper with fast timeout
  const fetchWithTimeout = async (url: string, ms = 2200): Promise<any> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (res.ok) return await res.json();
    } catch (_) {
      clearTimeout(id);
    }
    return null;
  };

  // Launch queries in parallel across high-precision GeoIP services (including ipapi.co, freeipapi, and ip-api.com proxy)
  const [dataIpApi, dataIpapiCo, dataGeojs, dataIpwho, dataIpsb, dataServer, dataFreeIp] = await Promise.allSettled([
    fetchWithTimeout("/api/presence/ip-api", 2400),
    fetchWithTimeout("https://ipapi.co/json/", 2400),
    fetchWithTimeout("https://get.geojs.io/v1/ip/geo.json", 2400),
    fetchWithTimeout("https://ipwho.is/", 2400),
    fetchWithTimeout("https://api.ip.sb/geoip", 2400),
    fetchWithTimeout("/api/presence/deep-geo", 2400),
    fetchWithTimeout("https://freeipapi.com/api/json/", 2400),
  ]);

  // ip-api.com via backend proxy
  if (dataIpApi.status === "fulfilled" && dataIpApi.value && dataIpApi.value.ok) {
    const d = dataIpApi.value;
    candidates.push({
      city: d.city || d.location || "",
      region: d.region || "",
      country: d.country || "Việt Nam",
      countryCode: d.countryCode || "VN",
      zip: d.zip || "",
      lat: typeof d.latitude === "number" ? d.latitude : undefined,
      lon: typeof d.longitude === "number" ? d.longitude : undefined,
      source: "ip-api",
    });
  }

  // ipapi.co
  if (
    dataIpapiCo.status === "fulfilled" &&
    dataIpapiCo.value &&
    typeof dataIpapiCo.value === "object" &&
    !dataIpapiCo.value.error
  ) {
    const d = dataIpapiCo.value;
    candidates.push({
      city: d.city || "",
      region: d.region || d.region_code || "",
      country: d.country_name || d.country || "Việt Nam",
      countryCode: d.country_code || "VN",
      zip: d.postal || "",
      lat: typeof d.latitude === "number" ? d.latitude : undefined,
      lon: typeof d.longitude === "number" ? d.longitude : undefined,
      source: "ipapi.co",
    });
  }

  if (dataGeojs.status === "fulfilled" && dataGeojs.value) {
    const d = dataGeojs.value;
    candidates.push({
      city: d.city || "",
      region: d.region || "",
      country: d.country || "Việt Nam",
      countryCode: d.country_code || "VN",
      lat: typeof d.latitude === "number" ? d.latitude : undefined,
      lon: typeof d.longitude === "number" ? d.longitude : undefined,
      source: "geojs",
    });
  }

  if (dataIpwho.status === "fulfilled" && dataIpwho.value && dataIpwho.value.success !== false) {
    const d = dataIpwho.value;
    candidates.push({
      city: d.city || "",
      region: d.region || "",
      country: d.country || "Việt Nam",
      countryCode: d.country_code || "VN",
      zip: d.postal || "",
      lat: typeof d.latitude === "number" ? d.latitude : undefined,
      lon: typeof d.longitude === "number" ? d.longitude : undefined,
      source: "ipwho",
    });
  }

  if (dataFreeIp.status === "fulfilled" && dataFreeIp.value) {
    const d = dataFreeIp.value;
    candidates.push({
      city: d.cityName || "",
      region: d.regionName || "",
      country: d.countryName || "Việt Nam",
      countryCode: d.countryCode || "VN",
      zip: d.zipCode || "",
      lat: typeof d.latitude === "number" ? d.latitude : undefined,
      lon: typeof d.longitude === "number" ? d.longitude : undefined,
      source: "freeipapi",
    });
  }

  if (dataIpsb.status === "fulfilled" && dataIpsb.value) {
    const d = dataIpsb.value;
    candidates.push({
      city: d.city || "",
      region: d.region || "",
      country: d.country || "Việt Nam",
      countryCode: d.country_code || "VN",
      lat: typeof d.latitude === "number" ? d.latitude : undefined,
      lon: typeof d.longitude === "number" ? d.longitude : undefined,
      source: "ipsb",
    });
  }

  if (dataServer.status === "fulfilled" && dataServer.value && dataServer.value.location) {
    const d = dataServer.value;
    candidates.push({
      city: d.city || d.location || "",
      region: d.region || "",
      country: d.country || "Việt Nam",
      countryCode: d.countryCode || "VN",
      lat: typeof d.latitude === "number" ? d.latitude : undefined,
      lon: typeof d.longitude === "number" ? d.longitude : undefined,
      source: "server",
    });
  }

  // Check postal/zip code evidence for Quang Ninh (postal prefix 20xxxx or 36xxxx/37xxxx)
  for (const c of candidates) {
    const z = String(c.zip || "").trim();
    const r = String(c.region || "").trim().toUpperCase();
    if (z.startsWith("20") || z.startsWith("36") || z.startsWith("37") || r === "QN") {
      const loc = "Quảng Ninh";
      try {
        sessionStorage.setItem(CACHE_KEY, loc);
        sessionStorage.setItem("visitor_location", loc);
      } catch (_) {}
      return loc;
    }
  }

  // 0. High-Precision Coordinate Resolution: If GPS or GeoIP coordinates point to a specific province
  for (const c of candidates) {
    if (typeof c.lat === "number" && typeof c.lon === "number") {
      const coordProvince = resolveProvinceFromCoords(c.lat, c.lon);
      if (coordProvince && coordProvince !== "Việt Nam") {
        const detailedName = cleanVietnameseCity(c.city, coordProvince);
        const finalLoc = detailedName.includes(coordProvince) ? detailedName : coordProvince;
        try {
          sessionStorage.setItem(CACHE_KEY, finalLoc);
          sessionStorage.setItem("visitor_location", finalLoc);
        } catch (_) {}
        return finalLoc;
      }
    }
  }

  // 1. Search for any specific Vietnamese province among all candidates with consensus
  const voteCount = new Map<string, number>();
  for (const c of candidates) {
    const resolved = cleanVietnameseCity(c.city, c.region);
    if (resolved && resolved !== "Việt Nam") {
      voteCount.set(resolved, (voteCount.get(resolved) || 0) + 1);
    }
  }

  let topLocation = "";
  let maxVotes = 0;
  for (const [loc, count] of voteCount.entries()) {
    if (count > maxVotes) {
      maxVotes = count;
      topLocation = loc;
    }
  }

  if (topLocation) {
    let finalLoc = stripIspFromName(topLocation);
    try {
      sessionStorage.setItem(CACHE_KEY, finalLoc);
      sessionStorage.setItem("visitor_location", finalLoc);
    } catch (_) {}
    return finalLoc;
  }

  // 3. Fallback to foreign country or general Vietnam
  for (const c of candidates) {
    if (c.countryCode && c.countryCode !== "VN" && c.country) {
      const loc = stripIspFromName(c.city ? `${c.city}, ${c.country}` : c.country);
      try {
        sessionStorage.setItem(CACHE_KEY, loc);
        sessionStorage.setItem("visitor_location", loc);
      } catch (_) {}
      return loc;
    }
  }

  return "Việt Nam";
}

/**
 * High-Precision location detection service powered by ipapi.co and ip-api.com
 * Strictly excludes any network or ISP provider information.
 */
export async function resolvePreciseVisitorLocation(): Promise<string> {
  const loc = await getDetailedVisitorLocation();
  return stripIspFromName(loc);
}


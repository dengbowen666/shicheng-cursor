import type { CityEntry, POI } from '../types'

// ============ 预置城市（全国主要旅游城市，坐标为 GCJ-02 城市中心） ============
export const PRESET_CITIES: CityEntry[] = [
  { name: '北京', province: '北京市', center: { lat: 39.9042, lng: 116.4074 }, adcode: '110000' },
  { name: '上海', province: '上海市', center: { lat: 31.2304, lng: 121.4737 }, adcode: '310000' },
  { name: '广州', province: '广东省', center: { lat: 23.1291, lng: 113.2644 }, adcode: '440100' },
  { name: '深圳', province: '广东省', center: { lat: 22.5431, lng: 114.0579 }, adcode: '440300' },
  { name: '成都', province: '四川省', center: { lat: 30.5728, lng: 104.0668 }, adcode: '510100' },
  { name: '杭州', province: '浙江省', center: { lat: 30.2741, lng: 120.1551 }, adcode: '330100' },
  { name: '西安', province: '陕西省', center: { lat: 34.3416, lng: 108.9398 }, adcode: '610100' },
  { name: '重庆', province: '重庆市', center: { lat: 29.5630, lng: 106.5516 }, adcode: '500000' },
  { name: '厦门', province: '福建省', center: { lat: 24.4798, lng: 118.0894 }, adcode: '350200' },
  { name: '昆明', province: '云南省', center: { lat: 25.0389, lng: 102.7183 }, adcode: '530100' },
  { name: '大理', province: '云南省', center: { lat: 25.6065, lng: 100.2676 }, adcode: '532901' },
  { name: '丽江', province: '云南省', center: { lat: 26.8721, lng: 100.2299 }, adcode: '530702' },
  { name: '三亚', province: '海南省', center: { lat: 18.2528, lng: 109.5119 }, adcode: '460200' },
  { name: '青岛', province: '山东省', center: { lat: 36.0671, lng: 120.3826 }, adcode: '370200' },
  { name: '长沙', province: '湖南省', center: { lat: 28.2282, lng: 112.9388 }, adcode: '430100' },
  { name: '武汉', province: '湖北省', center: { lat: 30.5928, lng: 114.3055 }, adcode: '420100' },
  { name: '南京', province: '江苏省', center: { lat: 32.0603, lng: 118.7969 }, adcode: '320100' },
  { name: '苏州', province: '江苏省', center: { lat: 31.2989, lng: 120.5853 }, adcode: '320500' },
  { name: '桂林', province: '广西壮族自治区', center: { lat: 25.2736, lng: 110.2900 }, adcode: '450300' },
  { name: '哈尔滨', province: '黑龙江省', center: { lat: 45.8038, lng: 126.5349 }, adcode: '230100' },
  { name: '拉萨', province: '西藏自治区', center: { lat: 29.6520, lng: 91.1721 }, adcode: '540100' },
  { name: '乌鲁木齐', province: '新疆维吾尔自治区', center: { lat: 43.8256, lng: 87.6168 }, adcode: '650100' },
  { name: '张家界', province: '湖南省', center: { lat: 29.1274, lng: 110.4792 }, adcode: '430800' },
  { name: '黄山', province: '安徽省', center: { lat: 29.7147, lng: 118.1675 }, adcode: '341000' },
  { name: '洛阳', province: '河南省', center: { lat: 34.6197, lng: 112.4540 }, adcode: '410300' },
  { name: '敦煌', province: '甘肃省', center: { lat: 40.1421, lng: 94.6616 }, adcode: '620900' },
  // —— 省会补全，确保每省至少一城可选 ——
  { name: '石家庄', province: '河北省', center: { lat: 38.0428, lng: 114.5149 }, adcode: '130100' },
  { name: '太原', province: '山西省', center: { lat: 37.8706, lng: 112.5489 }, adcode: '140100' },
  { name: '呼和浩特', province: '内蒙古自治区', center: { lat: 40.8424, lng: 111.7490 }, adcode: '150100' },
  { name: '沈阳', province: '辽宁省', center: { lat: 41.8057, lng: 123.4315 }, adcode: '210100' },
  { name: '长春', province: '吉林省', center: { lat: 43.8171, lng: 125.3235 }, adcode: '220100' },
  { name: '合肥', province: '安徽省', center: { lat: 31.8206, lng: 117.2272 }, adcode: '340100' },
  { name: '福州', province: '福建省', center: { lat: 26.0745, lng: 119.2965 }, adcode: '350100' },
  { name: '南昌', province: '江西省', center: { lat: 28.6820, lng: 115.8579 }, adcode: '360100' },
  { name: '济南', province: '山东省', center: { lat: 36.6512, lng: 117.1201 }, adcode: '370100' },
  { name: '郑州', province: '河南省', center: { lat: 34.7466, lng: 113.6254 }, adcode: '410100' },
  { name: '南宁', province: '广西壮族自治区', center: { lat: 22.8170, lng: 108.3665 }, adcode: '450100' },
  { name: '海口', province: '海南省', center: { lat: 20.0440, lng: 110.1999 }, adcode: '460100' },
  { name: '贵阳', province: '贵州省', center: { lat: 26.6470, lng: 106.6302 }, adcode: '520100' },
  { name: '兰州', province: '甘肃省', center: { lat: 36.0611, lng: 103.8343 }, adcode: '620100' },
  { name: '西宁', province: '青海省', center: { lat: 36.6171, lng: 101.7782 }, adcode: '630100' },
  { name: '银川', province: '宁夏回族自治区', center: { lat: 38.4872, lng: 106.2309 }, adcode: '640100' },
  { name: '天津', province: '天津市', center: { lat: 39.0842, lng: 117.2009 }, adcode: '120000' },
  { name: '台北', province: '台湾省', center: { lat: 25.0330, lng: 121.5654 }, adcode: '710000' },
  { name: '香港', province: '香港特别行政区', center: { lat: 22.3193, lng: 114.1694 }, adcode: '810000' },
  { name: '澳门', province: '澳门特别行政区', center: { lat: 22.1987, lng: 113.5439 }, adcode: '820000' },
]

// ============ 省份名规范化映射（点击地图省份 → 找城市） ============
export const PROVINCE_SHORT: Record<string, string> = {
  '北京市': '北京', '天津市': '天津', '上海市': '上海', '重庆市': '重庆',
  '河北省': '河北', '山西省': '山西', '内蒙古自治区': '内蒙古', '辽宁省': '辽宁',
  '吉林省': '吉林', '黑龙江省': '黑龙江', '江苏省': '江苏', '浙江省': '浙江',
  '安徽省': '安徽', '福建省': '福建', '江西省': '江西', '山东省': '山东',
  '河南省': '河南', '湖北省': '湖北', '湖南省': '湖南', '广东省': '广东',
  '广西壮族自治区': '广西', '海南省': '海南', '四川省': '四川', '贵州省': '贵州',
  '云南省': '云南', '西藏自治区': '西藏', '陕西省': '陕西', '甘肃省': '甘肃',
  '青海省': '青海', '宁夏回族自治区': '宁夏', '新疆维吾尔自治区': '新疆',
  '台湾省': '台湾', '香港特别行政区': '香港', '澳门特别行政区': '澳门',
}

export function citiesByProvince(provinceFull: string): CityEntry[] {
  const short = PROVINCE_SHORT[provinceFull] || provinceFull.replace(/省|市|自治区|特别行政区/g, '')
  return PRESET_CITIES.filter(c => {
    const cp = PROVINCE_SHORT[c.province] || c.province.replace(/省|市|自治区|特别行政区/g, '')
    return cp === short || c.province === provinceFull
  })
}

// ============ 城市热门景区（来自腾讯地图真实采集，运行时合并 cities-poi.json） ============
export type CityPOIMap = Record<string, POI[]>

import type { City } from '../types'

/**
 * 全国可入城清单：各省会 + 热门旅游地级市 / 州府。
 * 坐标为 GCJ-02 城市中心；下钻省图时会整省展开，不只省会一两座。
 */
export const PRESET_CITIES: City[] = [
  // —— 直辖市 / 特别行政区 ——
  { id: '北京', name: '北京', province: '北京市', center: { lat: 39.9042, lng: 116.4074 }, adcode: '110000' },
  { id: '天津', name: '天津', province: '天津市', center: { lat: 39.0842, lng: 117.2009 }, adcode: '120000' },
  { id: '上海', name: '上海', province: '上海市', center: { lat: 31.2304, lng: 121.4737 }, adcode: '310000' },
  { id: '重庆', name: '重庆', province: '重庆市', center: { lat: 29.5630, lng: 106.5516 }, adcode: '500000' },
  { id: '香港', name: '香港', province: '香港特别行政区', center: { lat: 22.3193, lng: 114.1694 }, adcode: '810000' },
  { id: '澳门', name: '澳门', province: '澳门特别行政区', center: { lat: 22.1987, lng: 113.5439 }, adcode: '820000' },

  // —— 河北 ——
  { id: '石家庄', name: '石家庄', province: '河北省', center: { lat: 38.0428, lng: 114.5149 }, adcode: '130100' },
  { id: '承德', name: '承德', province: '河北省', center: { lat: 40.9519, lng: 117.9624 }, adcode: '130800' },
  { id: '秦皇岛', name: '秦皇岛', province: '河北省', center: { lat: 39.8882, lng: 119.5202 }, adcode: '130300' },
  { id: '张家口', name: '张家口', province: '河北省', center: { lat: 40.8110, lng: 114.8841 }, adcode: '130700' },
  { id: '保定', name: '保定', province: '河北省', center: { lat: 38.8671, lng: 115.4823 }, adcode: '130600' },
  { id: '唐山', name: '唐山', province: '河北省', center: { lat: 39.6309, lng: 118.1802 }, adcode: '130200' },
  { id: '邯郸', name: '邯郸', province: '河北省', center: { lat: 36.6256, lng: 114.5391 }, adcode: '130400' },

  // —— 山西 ——
  { id: '太原', name: '太原', province: '山西省', center: { lat: 37.8706, lng: 112.5489 }, adcode: '140100' },
  { id: '大同', name: '大同', province: '山西省', center: { lat: 40.0768, lng: 113.3001 }, adcode: '140200' },
  { id: '平遥', name: '平遥', province: '山西省', center: { lat: 37.1955, lng: 112.1760 }, adcode: '140728' },
  { id: '忻州', name: '忻州', province: '山西省', center: { lat: 38.4177, lng: 112.7338 }, adcode: '140900' },
  { id: '晋中', name: '晋中', province: '山西省', center: { lat: 37.6965, lng: 112.7527 }, adcode: '140700' },
  { id: '运城', name: '运城', province: '山西省', center: { lat: 35.0264, lng: 111.0030 }, adcode: '140800' },

  // —— 内蒙古 ——
  { id: '呼和浩特', name: '呼和浩特', province: '内蒙古自治区', center: { lat: 40.8424, lng: 111.7490 }, adcode: '150100' },
  { id: '包头', name: '包头', province: '内蒙古自治区', center: { lat: 40.6562, lng: 109.8403 }, adcode: '150200' },
  { id: '呼伦贝尔', name: '呼伦贝尔', province: '内蒙古自治区', center: { lat: 49.2153, lng: 119.7656 }, adcode: '150700' },
  { id: '鄂尔多斯', name: '鄂尔多斯', province: '内蒙古自治区', center: { lat: 39.6086, lng: 109.7810 }, adcode: '150600' },
  { id: '赤峰', name: '赤峰', province: '内蒙古自治区', center: { lat: 42.2578, lng: 118.8878 }, adcode: '150400' },
  { id: '满洲里', name: '满洲里', province: '内蒙古自治区', center: { lat: 49.5978, lng: 117.3785 }, adcode: '150781' },

  // —— 辽宁 ——
  { id: '沈阳', name: '沈阳', province: '辽宁省', center: { lat: 41.8057, lng: 123.4315 }, adcode: '210100' },
  { id: '大连', name: '大连', province: '辽宁省', center: { lat: 38.9140, lng: 121.6147 }, adcode: '210200' },
  { id: '丹东', name: '丹东', province: '辽宁省', center: { lat: 40.0005, lng: 124.3544 }, adcode: '210600' },
  { id: '鞍山', name: '鞍山', province: '辽宁省', center: { lat: 41.1086, lng: 122.9946 }, adcode: '210300' },
  { id: '锦州', name: '锦州', province: '辽宁省', center: { lat: 41.1193, lng: 121.1357 }, adcode: '210700' },

  // —— 吉林 ——
  { id: '长春', name: '长春', province: '吉林省', center: { lat: 43.8171, lng: 125.3235 }, adcode: '220100' },
  { id: '吉林市', name: '吉林市', province: '吉林省', center: { lat: 43.8378, lng: 126.5497 }, adcode: '220200' },
  { id: '延吉', name: '延吉', province: '吉林省', center: { lat: 42.9068, lng: 129.4707 }, adcode: '222401' },
  { id: '长白山', name: '长白山', province: '吉林省', center: { lat: 42.0069, lng: 128.0580 }, adcode: '222426' },
  { id: '通化', name: '通化', province: '吉林省', center: { lat: 41.7212, lng: 125.9365 }, adcode: '220500' },

  // —— 黑龙江 ——
  { id: '哈尔滨', name: '哈尔滨', province: '黑龙江省', center: { lat: 45.8038, lng: 126.5349 }, adcode: '230100' },
  { id: '牡丹江', name: '牡丹江', province: '黑龙江省', center: { lat: 44.5516, lng: 129.6332 }, adcode: '231000' },
  { id: '齐齐哈尔', name: '齐齐哈尔', province: '黑龙江省', center: { lat: 47.3543, lng: 123.9182 }, adcode: '230200' },
  { id: '大庆', name: '大庆', province: '黑龙江省', center: { lat: 46.5877, lng: 125.1031 }, adcode: '230600' },
  { id: '黑河', name: '黑河', province: '黑龙江省', center: { lat: 50.2450, lng: 127.5286 }, adcode: '231100' },
  { id: '漠河', name: '漠河', province: '黑龙江省', center: { lat: 52.9721, lng: 122.5386 }, adcode: '232701' },

  // —— 江苏 ——
  { id: '南京', name: '南京', province: '江苏省', center: { lat: 32.0603, lng: 118.7969 }, adcode: '320100' },
  { id: '苏州', name: '苏州', province: '江苏省', center: { lat: 31.2989, lng: 120.5853 }, adcode: '320500' },
  { id: '无锡', name: '无锡', province: '江苏省', center: { lat: 31.4912, lng: 120.3119 }, adcode: '320200' },
  { id: '扬州', name: '扬州', province: '江苏省', center: { lat: 32.3932, lng: 119.4210 }, adcode: '321000' },
  { id: '周庄', name: '周庄', province: '江苏省', center: { lat: 31.1176, lng: 120.8447 }, adcode: '320583' },
  { id: '常州', name: '常州', province: '江苏省', center: { lat: 31.8107, lng: 119.9741 }, adcode: '320400' },
  { id: '南通', name: '南通', province: '江苏省', center: { lat: 32.0162, lng: 120.8943 }, adcode: '320600' },
  { id: '镇江', name: '镇江', province: '江苏省', center: { lat: 32.2044, lng: 119.4520 }, adcode: '321100' },
  { id: '徐州', name: '徐州', province: '江苏省', center: { lat: 34.2618, lng: 117.1848 }, adcode: '320300' },

  // —— 浙江 ——
  { id: '杭州', name: '杭州', province: '浙江省', center: { lat: 30.2741, lng: 120.1551 }, adcode: '330100' },
  { id: '宁波', name: '宁波', province: '浙江省', center: { lat: 29.8683, lng: 121.5440 }, adcode: '330200' },
  { id: '温州', name: '温州', province: '浙江省', center: { lat: 27.9938, lng: 120.6994 }, adcode: '330300' },
  { id: '绍兴', name: '绍兴', province: '浙江省', center: { lat: 30.0023, lng: 120.5810 }, adcode: '330600' },
  { id: '嘉兴', name: '嘉兴', province: '浙江省', center: { lat: 30.7508, lng: 120.7555 }, adcode: '330400' },
  { id: '乌镇', name: '乌镇', province: '浙江省', center: { lat: 30.7427, lng: 120.4878 }, adcode: '330483' },
  { id: '舟山', name: '舟山', province: '浙江省', center: { lat: 30.0160, lng: 122.1069 }, adcode: '330900' },
  { id: '金华', name: '金华', province: '浙江省', center: { lat: 29.0791, lng: 119.6474 }, adcode: '330700' },
  { id: '台州', name: '台州', province: '浙江省', center: { lat: 28.6561, lng: 121.4208 }, adcode: '331000' },
  { id: '丽水', name: '丽水', province: '浙江省', center: { lat: 28.4514, lng: 119.9229 }, adcode: '331100' },

  // —— 安徽 ——
  { id: '合肥', name: '合肥', province: '安徽省', center: { lat: 31.8206, lng: 117.2272 }, adcode: '340100' },
  { id: '黄山', name: '黄山', province: '安徽省', center: { lat: 29.7147, lng: 118.1675 }, adcode: '341000' },
  { id: '芜湖', name: '芜湖', province: '安徽省', center: { lat: 31.3526, lng: 118.3763 }, adcode: '340200' },
  { id: '宣城', name: '宣城', province: '安徽省', center: { lat: 30.9457, lng: 118.7588 }, adcode: '341800' },
  { id: '安庆', name: '安庆', province: '安徽省', center: { lat: 30.5255, lng: 117.0536 }, adcode: '340800' },
  { id: '宏村', name: '宏村', province: '安徽省', center: { lat: 30.0045, lng: 117.9896 }, adcode: '341023' },

  // —— 福建 ——
  { id: '福州', name: '福州', province: '福建省', center: { lat: 26.0745, lng: 119.2965 }, adcode: '350100' },
  { id: '厦门', name: '厦门', province: '福建省', center: { lat: 24.4798, lng: 118.0894 }, adcode: '350200' },
  { id: '泉州', name: '泉州', province: '福建省', center: { lat: 24.8741, lng: 118.6757 }, adcode: '350500' },
  { id: '武夷山', name: '武夷山', province: '福建省', center: { lat: 27.7516, lng: 118.0327 }, adcode: '350782' },
  { id: '漳州', name: '漳州', province: '福建省', center: { lat: 24.5109, lng: 117.6618 }, adcode: '350600' },
  { id: '龙岩', name: '龙岩', province: '福建省', center: { lat: 25.0916, lng: 117.0172 }, adcode: '350800' },
  { id: '莆田', name: '莆田', province: '福建省', center: { lat: 25.4541, lng: 119.0078 }, adcode: '350300' },

  // —— 江西 ——
  { id: '南昌', name: '南昌', province: '江西省', center: { lat: 28.6820, lng: 115.8579 }, adcode: '360100' },
  { id: '景德镇', name: '景德镇', province: '江西省', center: { lat: 29.2926, lng: 117.2147 }, adcode: '360200' },
  { id: '庐山', name: '庐山', province: '江西省', center: { lat: 29.5542, lng: 115.9800 }, adcode: '360483' },
  { id: '婺源', name: '婺源', province: '江西省', center: { lat: 29.2540, lng: 117.8622 }, adcode: '361130' },
  { id: '赣州', name: '赣州', province: '江西省', center: { lat: 25.8453, lng: 114.9403 }, adcode: '360700' },
  { id: '井冈山', name: '井冈山', province: '江西省', center: { lat: 26.5730, lng: 114.1667 }, adcode: '360881' },

  // —— 山东 ——
  { id: '济南', name: '济南', province: '山东省', center: { lat: 36.6512, lng: 117.1201 }, adcode: '370100' },
  { id: '青岛', name: '青岛', province: '山东省', center: { lat: 36.0671, lng: 120.3826 }, adcode: '370200' },
  { id: '烟台', name: '烟台', province: '山东省', center: { lat: 37.4638, lng: 121.4479 }, adcode: '370600' },
  { id: '威海', name: '威海', province: '山东省', center: { lat: 37.5128, lng: 122.1204 }, adcode: '371000' },
  { id: '泰安', name: '泰安', province: '山东省', center: { lat: 36.1941, lng: 117.0884 }, adcode: '370900' },
  { id: '曲阜', name: '曲阜', province: '山东省', center: { lat: 35.5819, lng: 116.9865 }, adcode: '370881' },
  { id: '淄博', name: '淄博', province: '山东省', center: { lat: 36.8131, lng: 118.0549 }, adcode: '370300' },
  { id: '临沂', name: '临沂', province: '山东省', center: { lat: 35.1041, lng: 118.3564 }, adcode: '371300' },

  // —— 河南 ——
  { id: '郑州', name: '郑州', province: '河南省', center: { lat: 34.7466, lng: 113.6254 }, adcode: '410100' },
  { id: '洛阳', name: '洛阳', province: '河南省', center: { lat: 34.6197, lng: 112.4540 }, adcode: '410300' },
  { id: '开封', name: '开封', province: '河南省', center: { lat: 34.7971, lng: 114.3074 }, adcode: '410200' },
  { id: '安阳', name: '安阳', province: '河南省', center: { lat: 36.1034, lng: 114.3924 }, adcode: '410500' },
  { id: '南阳', name: '南阳', province: '河南省', center: { lat: 32.9991, lng: 112.5409 }, adcode: '411300' },
  { id: '焦作', name: '焦作', province: '河南省', center: { lat: 35.2156, lng: 113.2418 }, adcode: '410800' },

  // —— 湖北 ——
  { id: '武汉', name: '武汉', province: '湖北省', center: { lat: 30.5928, lng: 114.3055 }, adcode: '420100' },
  { id: '宜昌', name: '宜昌', province: '湖北省', center: { lat: 30.7026, lng: 111.2865 }, adcode: '420500' },
  { id: '襄阳', name: '襄阳', province: '湖北省', center: { lat: 32.0424, lng: 112.1441 }, adcode: '420600' },
  { id: '恩施', name: '恩施', province: '湖北省', center: { lat: 30.2831, lng: 109.4869 }, adcode: '422800' },
  { id: '十堰', name: '十堰', province: '湖北省', center: { lat: 32.6290, lng: 110.7980 }, adcode: '420300' },
  { id: '神农架', name: '神农架', province: '湖北省', center: { lat: 31.7444, lng: 110.6715 }, adcode: '429021' },

  // —— 湖南 ——
  { id: '长沙', name: '长沙', province: '湖南省', center: { lat: 28.2282, lng: 112.9388 }, adcode: '430100' },
  { id: '张家界', name: '张家界', province: '湖南省', center: { lat: 29.1274, lng: 110.4792 }, adcode: '430800' },
  { id: '凤凰', name: '凤凰', province: '湖南省', center: { lat: 27.9483, lng: 109.5982 }, adcode: '433123' },
  { id: '岳阳', name: '岳阳', province: '湖南省', center: { lat: 29.3572, lng: 113.1327 }, adcode: '430600' },
  { id: '衡阳', name: '衡阳', province: '湖南省', center: { lat: 26.8969, lng: 112.6077 }, adcode: '430400' },
  { id: '郴州', name: '郴州', province: '湖南省', center: { lat: 25.7706, lng: 113.0150 }, adcode: '431000' },
  { id: '湘西', name: '湘西', province: '湖南省', center: { lat: 28.3143, lng: 109.7397 }, adcode: '433100' },

  // —— 广东 ——
  { id: '广州', name: '广州', province: '广东省', center: { lat: 23.1291, lng: 113.2644 }, adcode: '440100' },
  { id: '深圳', name: '深圳', province: '广东省', center: { lat: 22.5431, lng: 114.0579 }, adcode: '440300' },
  { id: '珠海', name: '珠海', province: '广东省', center: { lat: 22.2710, lng: 113.5767 }, adcode: '440400' },
  { id: '潮州', name: '潮州', province: '广东省', center: { lat: 23.6618, lng: 116.6226 }, adcode: '445100' },
  { id: '汕头', name: '汕头', province: '广东省', center: { lat: 23.3541, lng: 116.6820 }, adcode: '440500' },
  { id: '佛山', name: '佛山', province: '广东省', center: { lat: 23.0215, lng: 113.1214 }, adcode: '440600' },
  { id: '惠州', name: '惠州', province: '广东省', center: { lat: 23.1115, lng: 114.4152 }, adcode: '441300' },
  { id: '韶关', name: '韶关', province: '广东省', center: { lat: 24.8104, lng: 113.5972 }, adcode: '440200' },
  { id: '湛江', name: '湛江', province: '广东省', center: { lat: 21.2707, lng: 110.3575 }, adcode: '440800' },
  { id: '中山', name: '中山', province: '广东省', center: { lat: 22.5170, lng: 113.3926 }, adcode: '442000' },

  // —— 广西 ——
  { id: '南宁', name: '南宁', province: '广西壮族自治区', center: { lat: 22.8170, lng: 108.3665 }, adcode: '450100' },
  { id: '桂林', name: '桂林', province: '广西壮族自治区', center: { lat: 25.2736, lng: 110.2900 }, adcode: '450300' },
  { id: '阳朔', name: '阳朔', province: '广西壮族自治区', center: { lat: 24.7785, lng: 110.4966 }, adcode: '450321' },
  { id: '北海', name: '北海', province: '广西壮族自治区', center: { lat: 21.4733, lng: 109.1193 }, adcode: '450500' },
  { id: '柳州', name: '柳州', province: '广西壮族自治区', center: { lat: 24.3146, lng: 109.4117 }, adcode: '450200' },
  { id: '梧州', name: '梧州', province: '广西壮族自治区', center: { lat: 23.4748, lng: 111.2791 }, adcode: '450400' },
  { id: '百色', name: '百色', province: '广西壮族自治区', center: { lat: 23.9023, lng: 106.6182 }, adcode: '451000' },

  // —— 海南 ——
  { id: '海口', name: '海口', province: '海南省', center: { lat: 20.0440, lng: 110.1999 }, adcode: '460100' },
  { id: '三亚', name: '三亚', province: '海南省', center: { lat: 18.2528, lng: 109.5119 }, adcode: '460200' },
  { id: '万宁', name: '万宁', province: '海南省', center: { lat: 18.7953, lng: 110.3926 }, adcode: '469006' },
  { id: '琼海', name: '琼海', province: '海南省', center: { lat: 19.2584, lng: 110.4746 }, adcode: '469002' },
  { id: '儋州', name: '儋州', province: '海南省', center: { lat: 19.5211, lng: 109.5767 }, adcode: '460400' },

  // —— 四川 ——
  { id: '成都', name: '成都', province: '四川省', center: { lat: 30.5728, lng: 104.0668 }, adcode: '510100' },
  { id: '九寨沟', name: '九寨沟', province: '四川省', center: { lat: 33.2620, lng: 104.2436 }, adcode: '513225' },
  { id: '黄龙', name: '黄龙', province: '四川省', center: { lat: 32.7569, lng: 103.8220 }, adcode: '513224' },
  { id: '乐山', name: '乐山', province: '四川省', center: { lat: 29.5522, lng: 103.7656 }, adcode: '511100' },
  { id: '峨眉山', name: '峨眉山', province: '四川省', center: { lat: 29.6012, lng: 103.4845 }, adcode: '511181' },
  { id: '都江堰', name: '都江堰', province: '四川省', center: { lat: 30.9888, lng: 103.6464 }, adcode: '510181' },
  { id: '稻城', name: '稻城', province: '四川省', center: { lat: 29.0379, lng: 100.2967 }, adcode: '513337' },
  { id: '西昌', name: '西昌', province: '四川省', center: { lat: 27.8945, lng: 102.2587 }, adcode: '513401' },
  { id: '宜宾', name: '宜宾', province: '四川省', center: { lat: 28.7602, lng: 104.6432 }, adcode: '511500' },
  { id: '绵阳', name: '绵阳', province: '四川省', center: { lat: 31.4678, lng: 104.7417 }, adcode: '510700' },
  { id: '阿坝', name: '阿坝', province: '四川省', center: { lat: 32.9024, lng: 101.7077 }, adcode: '513200' },
  { id: '甘孜', name: '甘孜', province: '四川省', center: { lat: 31.6228, lng: 99.9928 }, adcode: '513300' },

  // —— 贵州 ——
  { id: '贵阳', name: '贵阳', province: '贵州省', center: { lat: 26.6470, lng: 106.6302 }, adcode: '520100' },
  { id: '黄果树', name: '黄果树', province: '贵州省', center: { lat: 25.9901, lng: 105.6700 }, adcode: '520221' },
  { id: '镇远', name: '镇远', province: '贵州省', center: { lat: 27.0494, lng: 108.4297 }, adcode: '522625' },
  { id: '荔波', name: '荔波', province: '贵州省', center: { lat: 25.4122, lng: 107.8838 }, adcode: '522722' },
  { id: '遵义', name: '遵义', province: '贵州省', center: { lat: 27.7257, lng: 106.9274 }, adcode: '520300' },
  { id: '凯里', name: '凯里', province: '贵州省', center: { lat: 26.5669, lng: 107.9813 }, adcode: '522601' },
  { id: '兴义', name: '兴义', province: '贵州省', center: { lat: 25.0919, lng: 104.8955 }, adcode: '522301' },

  // —— 云南（重点补齐） ——
  { id: '昆明', name: '昆明', province: '云南省', center: { lat: 25.0389, lng: 102.7183 }, adcode: '530100' },
  { id: '大理', name: '大理', province: '云南省', center: { lat: 25.6065, lng: 100.2676 }, adcode: '532901' },
  { id: '丽江', name: '丽江', province: '云南省', center: { lat: 26.8721, lng: 100.2299 }, adcode: '530702' },
  { id: '香格里拉', name: '香格里拉', province: '云南省', center: { lat: 27.8259, lng: 99.7065 }, adcode: '533401' },
  { id: '西双版纳', name: '西双版纳', province: '云南省', center: { lat: 22.0017, lng: 100.7978 }, adcode: '532800' },
  { id: '腾冲', name: '腾冲', province: '云南省', center: { lat: 25.0176, lng: 98.4909 }, adcode: '530581' },
  { id: '瑞丽', name: '瑞丽', province: '云南省', center: { lat: 24.0107, lng: 97.8555 }, adcode: '530501' },
  { id: '玉溪', name: '玉溪', province: '云南省', center: { lat: 24.3521, lng: 102.5439 }, adcode: '530400' },
  { id: '曲靖', name: '曲靖', province: '云南省', center: { lat: 25.5016, lng: 103.7978 }, adcode: '530300' },
  { id: '保山', name: '保山', province: '云南省', center: { lat: 25.1118, lng: 99.1671 }, adcode: '530500' },
  { id: '楚雄', name: '楚雄', province: '云南省', center: { lat: 25.0457, lng: 101.5460 }, adcode: '532300' },
  { id: '建水', name: '建水', province: '云南省', center: { lat: 23.6347, lng: 102.8265 }, adcode: '532524' },
  { id: '普洱', name: '普洱', province: '云南省', center: { lat: 22.7773, lng: 100.9723 }, adcode: '530800' },
  { id: '红河', name: '红河', province: '云南省', center: { lat: 23.3631, lng: 103.3748 }, adcode: '532500' },
  { id: '昭通', name: '昭通', province: '云南省', center: { lat: 27.3382, lng: 103.7173 }, adcode: '530600' },
  { id: '临沧', name: '临沧', province: '云南省', center: { lat: 23.8866, lng: 100.0869 }, adcode: '530900' },
  { id: '怒江', name: '怒江', province: '云南省', center: { lat: 25.8509, lng: 98.8543 }, adcode: '533300' },
  { id: '德宏', name: '德宏', province: '云南省', center: { lat: 24.4367, lng: 98.5784 }, adcode: '533100' },

  // —— 西藏 ——
  { id: '拉萨', name: '拉萨', province: '西藏自治区', center: { lat: 29.6520, lng: 91.1721 }, adcode: '540100' },
  { id: '日喀则', name: '日喀则', province: '西藏自治区', center: { lat: 29.2670, lng: 88.8806 }, adcode: '540200' },
  { id: '林芝', name: '林芝', province: '西藏自治区', center: { lat: 29.6540, lng: 94.3614 }, adcode: '540400' },
  { id: '山南', name: '山南', province: '西藏自治区', center: { lat: 29.2360, lng: 91.7665 }, adcode: '540500' },
  { id: '那曲', name: '那曲', province: '西藏自治区', center: { lat: 31.4762, lng: 92.0512 }, adcode: '540600' },
  { id: '阿里', name: '阿里', province: '西藏自治区', center: { lat: 32.5011, lng: 80.1055 }, adcode: '542500' },

  // —— 陕西 ——
  { id: '西安', name: '西安', province: '陕西省', center: { lat: 34.3416, lng: 108.9398 }, adcode: '610100' },
  { id: '延安', name: '延安', province: '陕西省', center: { lat: 36.5853, lng: 109.4898 }, adcode: '610600' },
  { id: '宝鸡', name: '宝鸡', province: '陕西省', center: { lat: 34.3630, lng: 107.2379 }, adcode: '610300' },
  { id: '汉中', name: '汉中', province: '陕西省', center: { lat: 33.0777, lng: 107.0286 }, adcode: '610700' },
  { id: '榆林', name: '榆林', province: '陕西省', center: { lat: 38.2902, lng: 109.7341 }, adcode: '610800' },
  { id: '华山', name: '华山', province: '陕西省', center: { lat: 34.4826, lng: 110.0911 }, adcode: '610582' },

  // —— 甘肃 ——
  { id: '兰州', name: '兰州', province: '甘肃省', center: { lat: 36.0611, lng: 103.8343 }, adcode: '620100' },
  { id: '敦煌', name: '敦煌', province: '甘肃省', center: { lat: 40.1421, lng: 94.6616 }, adcode: '620900' },
  { id: '天水', name: '天水', province: '甘肃省', center: { lat: 34.5809, lng: 105.7249 }, adcode: '620500' },
  { id: '嘉峪关', name: '嘉峪关', province: '甘肃省', center: { lat: 39.7865, lng: 98.2773 }, adcode: '620200' },
  { id: '张掖', name: '张掖', province: '甘肃省', center: { lat: 38.9259, lng: 100.4498 }, adcode: '620700' },
  { id: '甘南', name: '甘南', province: '甘肃省', center: { lat: 34.9833, lng: 102.9110 }, adcode: '623000' },

  // —— 青海 ——
  { id: '西宁', name: '西宁', province: '青海省', center: { lat: 36.6171, lng: 101.7782 }, adcode: '630100' },
  { id: '青海湖', name: '青海湖', province: '青海省', center: { lat: 36.9000, lng: 100.1500 }, adcode: '632521' },
  { id: '格尔木', name: '格尔木', province: '青海省', center: { lat: 36.4016, lng: 94.9058 }, adcode: '632801' },
  { id: '玉树', name: '玉树', province: '青海省', center: { lat: 33.0040, lng: 97.0137 }, adcode: '632700' },
  { id: '海北', name: '海北', province: '青海省', center: { lat: 36.9544, lng: 100.9010 }, adcode: '632200' },

  // —— 宁夏 ——
  { id: '银川', name: '银川', province: '宁夏回族自治区', center: { lat: 38.4872, lng: 106.2309 }, adcode: '640100' },
  { id: '中卫', name: '中卫', province: '宁夏回族自治区', center: { lat: 37.5149, lng: 105.1968 }, adcode: '640500' },
  { id: '固原', name: '固原', province: '宁夏回族自治区', center: { lat: 36.0046, lng: 106.2852 }, adcode: '640400' },
  { id: '石嘴山', name: '石嘴山', province: '宁夏回族自治区', center: { lat: 39.0133, lng: 106.3762 }, adcode: '640200' },

  // —— 新疆 ——
  { id: '乌鲁木齐', name: '乌鲁木齐', province: '新疆维吾尔自治区', center: { lat: 43.8256, lng: 87.6168 }, adcode: '650100' },
  { id: '喀什', name: '喀什', province: '新疆维吾尔自治区', center: { lat: 39.4677, lng: 75.9938 }, adcode: '653100' },
  { id: '伊犁', name: '伊犁', province: '新疆维吾尔自治区', center: { lat: 43.9168, lng: 81.3241 }, adcode: '654000' },
  { id: '吐鲁番', name: '吐鲁番', province: '新疆维吾尔自治区', center: { lat: 42.9476, lng: 89.1841 }, adcode: '650400' },
  { id: '阿勒泰', name: '阿勒泰', province: '新疆维吾尔自治区', center: { lat: 47.8484, lng: 88.1396 }, adcode: '654300' },
  { id: '和田', name: '和田', province: '新疆维吾尔自治区', center: { lat: 37.1107, lng: 79.9253 }, adcode: '653200' },
  { id: '库尔勒', name: '库尔勒', province: '新疆维吾尔自治区', center: { lat: 41.7631, lng: 86.1459 }, adcode: '652801' },
  { id: '克拉玛依', name: '克拉玛依', province: '新疆维吾尔自治区', center: { lat: 45.5957, lng: 84.8739 }, adcode: '650200' },

  // —— 台湾 ——
  { id: '台北', name: '台北', province: '台湾省', center: { lat: 25.0330, lng: 121.5654 }, adcode: '710000' },
  { id: '高雄', name: '高雄', province: '台湾省', center: { lat: 22.6273, lng: 120.3014 }, adcode: '710200' },
  { id: '台中', name: '台中', province: '台湾省', center: { lat: 24.1477, lng: 120.6736 }, adcode: '710400' },
  { id: '花莲', name: '花莲', province: '台湾省', center: { lat: 23.9911, lng: 121.6112 }, adcode: '711400' },
  { id: '台南', name: '台南', province: '台湾省', center: { lat: 22.9997, lng: 120.2270 }, adcode: '710500' },
]

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

export function citiesByProvince(provinceFull: string): City[] {
  const short = PROVINCE_SHORT[provinceFull] || provinceFull.replace(/省|市|自治区|特别行政区/g, '')
  return PRESET_CITIES.filter(c => {
    const cp = PROVINCE_SHORT[c.province] || c.province.replace(/省|市|自治区|特别行政区/g, '')
    return cp === short || c.province === provinceFull
  })
}

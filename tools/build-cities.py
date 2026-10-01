"""
八字排盘的出生地名单（M19-4）：生成 src/data/cities.json。/bazi/ 的页面只在用户点进「出生地」时才下载它。

每个城市：简体名、繁体名（台湾用语）、所属（省或国家）、经度、IANA 时区。经度给真太阳时用，时区给浏览器用 Intl 算出生
那一刻的 UTC 偏移（含历史夏令时，M19-5）。只换算，不上传。

数据来源：Natural Earth 1:10m Populated Places v5.1.2（公有领域，https://www.naturalearthdata.com/），只取经度。
它的中文名（NAME_ZH、NAME_ZHT）和时区（TIMEZONE）都不可靠：有错名（广西百色写成「白城」、内蒙古武川写成「吴川」），
青海的地方记在甘肃名下，时区有空的、有过时的别名、有错的（智利圣地亚哥记成圣保罗的时区）。所以中文名、所属、时区都由
本项目在下面写定，Natural Earth 只用来查经度；繁体名先用 opencc-js 1.4.2 的 s2twp 转换，再逐条按台湾用语校对。

筛选规则：
- 中国大陆：地级以上（直辖市、地级市，自治州、地区、盟取首府），按省列在 CHINA 里，共 337 个。Natural Earth 里
  有这个城市（中文名去掉市、区、县、镇后相同，且省份一致）才收；首府在 Natural Earth 里叫别的名字的（荆门有两条、
  晋中记作榆次、台州记作椒江……）在 ALIAS 里按英文名指定。Natural Earth 没有的不收，脚本列出来备查，不自己补经纬度。
  时区一律 Asia/Shanghai（新疆、西藏的出生登记也用北京时间）。
- 台湾：Natural Earth 里的 25 个城镇全收（Asia/Taipei）；香港、澳门各一（Asia/Hong_Kong、Asia/Macau）。
- 海外：华人常住的主要城市，按国家列在 OVERSEAS 里：各国首都，北美、澳新、英国的主要都会与大学城，东南亚华人
  聚居的城市（马来西亚、印尼、泰国、菲律宾、越南等）。时区按城市写定；必须在 Natural Earth 里找得到，找不到就报错。
- 显示：「成都 · 四川」「温哥华 · 加拿大」；名字和所属相同的（北京、香港、新加坡）只写名字。同一种写法不能出现两次。

在测试服务器上跑（不在本机）：
  ssh $STAGE 'cd ~/liuyao && docker run --rm --user $(id -u):$(id -g) -v ~/liuyao:/app -w /app python:3.12-slim \
    python tools/build-cities.py'
然后把 src/data/cities.json 拷回本机提交。
"""
import hashlib
import json
import re
import urllib.request

SOURCE = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_populated_places.geojson",
    "9b8e3de09048ef00dfc70357dbb9fa324493f214b5e0ae4daf1aa79a8d10116b",
)

# 省（简|繁）、Natural Earth 的 ADM1NAME、地级以上城市（简|繁，繁体与简体相同的只写一个）
CHINA = [
    ("北京", "Beijing", "北京"),
    ("天津", "Tianjin", "天津"),
    ("上海", "Shanghai", "上海"),
    ("重庆|重慶", "Chongqing", "重庆|重慶"),
    ("河北", "Hebei", "石家庄|石家莊 唐山 秦皇岛|秦皇島 邯郸|邯鄲 邢台|邢臺 保定 张家口|張家口 承德 沧州|滄州 廊坊 衡水"),
    ("山西", "Shanxi", "太原 大同 阳泉|陽泉 长治|長治 晋城|晉城 朔州 晋中|晉中 运城|運城 忻州 临汾|臨汾 吕梁|呂梁"),
    ("内蒙古|內蒙古", "Nei Mongol", "呼和浩特 包头|包頭 乌海|烏海 赤峰 通辽|通遼 鄂尔多斯|鄂爾多斯 呼伦贝尔|呼倫貝爾 巴彦淖尔|巴彥淖爾 乌兰察布|烏蘭察布 乌兰浩特|烏蘭浩特 锡林浩特|錫林浩特 阿拉善"),
    ("辽宁|遼寧", "Liaoning", "沈阳|瀋陽 大连|大連 鞍山 抚顺|撫順 本溪 丹东|丹東 锦州|錦州 营口|營口 阜新 辽阳|遼陽 盘锦|盤錦 铁岭|鐵嶺 朝阳|朝陽 葫芦岛|葫蘆島"),
    ("吉林", "Jilin", "长春|長春 吉林 四平 辽源|遼源 通化 白山 松原 白城 延吉"),
    ("黑龙江|黑龍江", "Heilongjiang", "哈尔滨|哈爾濱 齐齐哈尔|齊齊哈爾 鸡西|雞西 鹤岗|鶴崗 双鸭山|雙鴨山 大庆|大慶 伊春 佳木斯 七台河|七臺河 牡丹江 黑河 绥化|綏化 加格达奇|加格達奇"),
    ("江苏|江蘇", "Jiangsu", "南京 无锡|無錫 徐州 常州 苏州|蘇州 南通 连云港|連雲港 淮安 盐城|鹽城 扬州|揚州 镇江|鎮江 泰州 宿迁|宿遷"),
    ("浙江", "Zhejiang", "杭州 宁波|寧波 温州|溫州 嘉兴|嘉興 湖州 绍兴|紹興 金华|金華 衢州 舟山 台州 丽水|麗水"),
    ("安徽", "Anhui", "合肥 芜湖|蕪湖 蚌埠 淮南 马鞍山|馬鞍山 淮北 铜陵|銅陵 安庆|安慶 黄山|黃山 滁州 阜阳|阜陽 宿州 六安 亳州 池州 宣城"),
    ("福建", "Fujian", "福州 厦门|廈門 莆田 三明 泉州 漳州 南平 龙岩|龍巖 宁德|寧德"),
    ("江西", "Jiangxi", "南昌 景德镇|景德鎮 萍乡|萍鄉 九江 新余|新餘 鹰潭|鷹潭 赣州|贛州 吉安 宜春 抚州|撫州 上饶|上饒"),
    ("山东|山東", "Shandong", "济南|濟南 青岛|青島 淄博 枣庄|棗莊 东营|東營 烟台|煙臺 潍坊|濰坊 济宁|濟寧 泰安 威海 日照 临沂|臨沂 德州 聊城 滨州|濱州 菏泽|菏澤"),
    ("河南", "Henan", "郑州|鄭州 开封|開封 洛阳|洛陽 平顶山|平頂山 安阳|安陽 鹤壁|鶴壁 新乡|新鄉 焦作 濮阳|濮陽 许昌|許昌 漯河 三门峡|三門峽 南阳|南陽 商丘 信阳|信陽 周口 驻马店|駐馬店"),
    ("湖北", "Hubei", "武汉|武漢 黄石|黃石 十堰 宜昌 襄阳|襄陽 鄂州 荆门|荊門 孝感 荆州|荊州 黄冈|黃岡 咸宁|咸寧 随州|隨州 恩施"),
    ("湖南", "Hunan", "长沙|長沙 株洲 湘潭 衡阳|衡陽 邵阳|邵陽 岳阳|岳陽 常德 张家界|張家界 益阳|益陽 郴州 永州 怀化|懷化 娄底|婁底 吉首"),
    ("广东|廣東", "Guangdong", "广州|廣州 韶关|韶關 深圳 珠海 汕头|汕頭 佛山 江门|江門 湛江 茂名 肇庆|肇慶 惠州 梅州 汕尾 河源 阳江|陽江 清远|清遠 东莞|東莞 中山 潮州 揭阳|揭陽 云浮|雲浮"),
    ("广西|廣西", "Guangxi", "南宁|南寧 柳州 桂林 梧州 北海 防城港 钦州|欽州 贵港|貴港 玉林 百色 贺州|賀州 河池 来宾|來賓 崇左"),
    ("海南", "Hainan", "海口 三亚|三亞 三沙 儋州"),
    ("四川", "Sichuan", "成都 自贡|自貢 攀枝花 泸州|瀘州 德阳|德陽 绵阳|綿陽 广元|廣元 遂宁|遂寧 内江|內江 乐山|樂山 南充 眉山 宜宾|宜賓 广安|廣安 达州|達州 雅安 巴中 资阳|資陽 马尔康|馬爾康 康定 西昌"),
    ("贵州|貴州", "Guizhou", "贵阳|貴陽 六盘水|六盤水 遵义|遵義 安顺|安順 毕节|畢節 铜仁|銅仁 兴义|興義 凯里|凱里 都匀|都勻"),
    ("云南|雲南", "Yunnan", "昆明 曲靖 玉溪 保山 昭通 丽江|麗江 普洱 临沧|臨滄 楚雄 蒙自 文山 景洪 大理 芒市 泸水|瀘水 香格里拉"),
    ("西藏", "Xizang", "拉萨|拉薩 日喀则|日喀則 昌都 林芝 山南 那曲 阿里"),
    ("陕西|陝西", "Shaanxi", "西安 铜川|銅川 宝鸡|寶雞 咸阳|咸陽 渭南 延安 汉中|漢中 榆林 安康 商洛"),
    ("甘肃|甘肅", "Gansu", "兰州|蘭州 嘉峪关|嘉峪關 金昌 白银|白銀 天水 武威 张掖|張掖 平凉|平涼 酒泉 庆阳|慶陽 定西 陇南|隴南 临夏|臨夏 合作"),
    # Natural Earth 把青海的地方记在甘肃名下
    ("青海", "Qinghai/Gansu", "西宁|西寧 海东|海東 海晏 同仁 共和 玛沁|瑪沁 玉树|玉樹 德令哈"),
    ("宁夏|寧夏", "Ningxia Hui", "银川|銀川 石嘴山 吴忠|吳忠 固原 中卫|中衛"),
    ("新疆", "Xinjiang Uygur", "乌鲁木齐|烏魯木齊 克拉玛依|克拉瑪依 吐鲁番|吐魯番 哈密 阿克苏|阿克蘇 喀什 和田 塔城 阿勒泰 昌吉 博乐|博樂 库尔勒|庫爾勒 阿图什|阿圖什 伊宁|伊寧"),
]

# 首府在 Natural Earth 里的英文名（中文名对不上或有两条的）：简体名 → NAME[/ADM1NAME]
ALIAS = {
    "荆门": "Jingmen",  # 另有一条错拼的 Jianmen
    "晋中": "Yuci",  # 榆次区
    "乌兰察布": "Jining/Nei Mongol",  # 集宁区（山东济宁也叫 Jining）
    "呼伦贝尔": "Hailar",  # 海拉尔区
    "阿拉善": "Alxa Zuoqi",  # 阿拉善左旗
    "台州": "Jiaojing",  # 椒江区
    "宁德": "Ninde",  # 蕉城区
    "抚州": "Linchuan",  # 临川区
    "百色": "Bose",  # 中文名错成「白城」
    "普洱": "Simao",  # 思茅区
    "哈密": "Hami",  # 伊州区
    "玉树": "Jyekundo",  # 结古街道
    "阿里": "Gar",  # 噶尔县
}

# 台湾、香港、澳门：NAME → 简|繁
TAIWAN = {
    "Taipei": "台北|臺北", "New Taipei": "新北", "Keelung": "基隆", "Taoyuan": "桃园|桃園", "Zhongli": "中坜|中壢",
    "Pingzhen": "平镇|平鎮", "Bade": "八德", "Yangmei": "杨梅|楊梅", "Hsinchu": "新竹", "Zhubei": "竹北", "Miaoli": "苗栗",
    "Taichung": "台中|臺中", "Changhua": "彰化", "Nantou": "南投", "Douliou": "斗六", "Chiayi": "嘉义|嘉義", "Taibao": "太保",
    "Puzi": "朴子", "Tainan": "台南|臺南", "Kaohsiung": "高雄", "Pingtung": "屏东|屏東", "Yilan": "宜兰|宜蘭",
    "Hualien": "花莲|花蓮", "Taitung": "台东|臺東", "Magong": "马公|馬公",
}
REGIONS = [
    # (ADM0_A3, 所属 简|繁, 时区, {NAME: 简|繁})
    ("TWN", "台湾|臺灣", "Asia/Taipei", TAIWAN),
    ("HKG", "香港", "Asia/Hong_Kong", {"Hong Kong": "香港"}),
    ("MAC", "澳门|澳門", "Asia/Macau", {"Macau": "澳门|澳門"}),
]

# 海外：国家（简|繁）、默认时区、城市「NAME[/ADM1NAME]=简|繁[@时区]」。ADM1NAME 只在同国有同名城市时写
OVERSEAS = [
    ("USA", "美国|美國", "America/New_York", "New York=纽约|紐約; Boston=波士顿|波士頓; Philadelphia=费城|費城; Washington, D.C.=华盛顿|華盛頓; Baltimore=巴尔的摩|巴爾的摩; Pittsburgh=匹兹堡|匹茲堡; Atlanta=亚特兰大|亞特蘭大; Miami=迈阿密|邁阿密; Orlando=奥兰多|奧蘭多; Raleigh=罗利|羅里; Columbus/Ohio=哥伦布|哥倫布; Detroit=底特律@America/Detroit; Chicago=芝加哥@America/Chicago; Houston=休斯敦|休士頓@America/Chicago; Dallas=达拉斯|達拉斯@America/Chicago; Austin=奥斯汀|奧斯汀@America/Chicago; Minneapolis=明尼阿波利斯|明尼亞波利斯@America/Chicago; St. Louis=圣路易斯|聖路易@America/Chicago; Denver=丹佛@America/Denver; Salt Lake City=盐湖城|鹽湖城@America/Denver; Phoenix=凤凰城|鳳凰城@America/Phoenix; Las Vegas/Nevada=拉斯维加斯|拉斯維加斯@America/Los_Angeles; Los Angeles=洛杉矶|洛杉磯@America/Los_Angeles; Irvine=尔湾|爾灣@America/Los_Angeles; San Diego=圣迭戈|聖地牙哥@America/Los_Angeles; San Francisco=旧金山|舊金山@America/Los_Angeles; Oakland=奥克兰|奧克蘭@America/Los_Angeles; San Jose=圣何塞|聖荷西@America/Los_Angeles; Sacramento=萨克拉门托|沙加緬度@America/Los_Angeles; Portland/Oregon=波特兰|波特蘭@America/Los_Angeles; Seattle=西雅图|西雅圖@America/Los_Angeles; Honolulu=檀香山@Pacific/Honolulu"),
    ("CAN", "加拿大", "America/Toronto", "Toronto=多伦多|多倫多; Ottawa=渥太华|渥太華; Montréal=蒙特利尔|蒙特婁; Québec=魁北克城; Hamilton/Ontario=汉密尔顿|漢彌爾頓; Kitchener=基奇纳|基奇納; Halifax=哈利法克斯@America/Halifax; Winnipeg=温尼伯|溫尼伯@America/Winnipeg; Regina=里贾纳|里賈納@America/Regina; Saskatoon=萨斯卡通|薩斯卡通@America/Regina; Calgary=卡尔加里|卡加利@America/Edmonton; Edmonton=埃德蒙顿|艾德蒙頓@America/Edmonton; Vancouver=温哥华|溫哥華@America/Vancouver; Victoria/British Columbia=维多利亚|維多利亞@America/Vancouver"),
    ("AUS", "澳大利亚|澳洲", "Australia/Sydney", "Sydney=悉尼|雪梨; Canberra=堪培拉|坎培拉; Melbourne=墨尔本|墨爾本@Australia/Melbourne; Brisbane=布里斯班|布里斯本@Australia/Brisbane; Gold Coast=黄金海岸|黃金海岸@Australia/Brisbane; Adelaide=阿德莱德|阿得雷德@Australia/Adelaide; Perth=珀斯|伯斯@Australia/Perth; Hobart=霍巴特|荷巴特@Australia/Hobart; Darwin=达尔文|達爾文@Australia/Darwin"),
    ("NZL", "新西兰|紐西蘭", "Pacific/Auckland", "Auckland=奥克兰|奧克蘭; Wellington=惠灵顿|威靈頓; Christchurch=基督城; Hamilton=汉密尔顿|漢彌爾頓; Dunedin=但尼丁"),
    ("GBR", "英国|英國", "Europe/London", "London=伦敦|倫敦; Manchester=曼彻斯特|曼徹斯特; Birmingham=伯明翰|伯明罕; Liverpool=利物浦; Leeds=利兹|里茲; Sheffield=谢菲尔德|雪菲爾; Newcastle=纽卡斯尔|新堡; Nottingham=诺丁汉|諾丁漢; Bristol=布里斯托尔|布里斯托; Cambridge=剑桥|劍橋; Oxford=牛津; Edinburgh=爱丁堡|愛丁堡; Glasgow=格拉斯哥; Cardiff=加的夫|卡地夫; Belfast=贝尔法斯特|貝爾法斯特"),
    ("IRL", "爱尔兰|愛爾蘭", "Europe/Dublin", "Dublin=都柏林"),
    ("FRA", "法国|法國", "Europe/Paris", "Paris=巴黎; Lyon=里昂; Marseille=马赛|馬賽; Toulouse=图卢兹|土魯斯; Nice=尼斯"),
    ("DEU", "德国|德國", "Europe/Berlin", "Berlin=柏林; Hamburg=汉堡|漢堡; Munich=慕尼黑; Frankfurt=法兰克福|法蘭克福; Cologne=科隆; Düsseldorf=杜塞尔多夫|杜塞道夫; Stuttgart=斯图加特|斯圖加特"),
    ("NLD", "荷兰|荷蘭", "Europe/Amsterdam", "Amsterdam=阿姆斯特丹; Rotterdam=鹿特丹; The Hague=海牙"),
    ("BEL", "比利时|比利時", "Europe/Brussels", "Brussels=布鲁塞尔|布魯塞爾; Antwerpen=安特卫普|安特衛普"),
    ("CHE", "瑞士", "Europe/Zurich", "Zürich=苏黎世|蘇黎世; Geneva=日内瓦|日內瓦; Bern=伯尔尼|伯恩"),
    ("AUT", "奥地利|奧地利", "Europe/Vienna", "Vienna=维也纳|維也納"),
    ("ITA", "意大利|義大利", "Europe/Rome", "Rome=罗马|羅馬; Milan=米兰|米蘭; Florence=佛罗伦萨|佛羅倫斯; Turin=都灵|杜林; Naples=那不勒斯|拿坡里; Venice=威尼斯"),
    ("ESP", "西班牙", "Europe/Madrid", "Madrid=马德里|馬德里; Barcelona=巴塞罗那|巴塞隆納; Valencia=瓦伦西亚|瓦倫西亞"),
    ("PRT", "葡萄牙", "Europe/Lisbon", "Lisbon=里斯本; Porto=波尔图|波多"),
    ("SWE", "瑞典", "Europe/Stockholm", "Stockholm=斯德哥尔摩|斯德哥爾摩"),
    ("NOR", "挪威", "Europe/Oslo", "Oslo=奥斯陆|奧斯陸"),
    ("DNK", "丹麦|丹麥", "Europe/Copenhagen", "København=哥本哈根"),
    ("FIN", "芬兰|芬蘭", "Europe/Helsinki", "Helsinki=赫尔辛基|赫爾辛基"),
    ("RUS", "俄罗斯|俄羅斯", "Europe/Moscow", "Moscow=莫斯科; St. Petersburg=圣彼得堡|聖彼得堡; Novosibirsk=新西伯利亚|新西伯利亞@Asia/Novosibirsk; Khabarovsk=哈巴罗夫斯克|伯力@Asia/Vladivostok; Vladivostok=海参崴|海參崴@Asia/Vladivostok"),
    ("MNG", "蒙古", "Asia/Ulaanbaatar", "Ulaanbaatar=乌兰巴托|烏蘭巴托"),
    ("JPN", "日本", "Asia/Tokyo", "Tokyo=东京|東京; Yokohama=横滨|橫濱; Ōsaka=大阪; Kyoto=京都; Kōbe=神户|神戶; Nagoya=名古屋; Fukuoka=福冈|福岡; Sapporo=札幌; Sendai=仙台; Hiroshima=广岛|廣島; Naha=那霸"),
    ("KOR", "韩国|韓國", "Asia/Seoul", "Seoul=首尔|首爾; Incheon=仁川; Busan=釜山; Daegu=大邱; Jeju=济州|濟州"),
    ("SGP", "新加坡", "Asia/Singapore", "Singapore=新加坡"),
    ("MYS", "马来西亚|馬來西亞", "Asia/Kuala_Lumpur", "Kuala Lumpur=吉隆坡; Kelang=巴生; Seremban=芙蓉; Malacca=马六甲|馬六甲; Johor Bahru=新山; Ipoh=怡保; Taiping=太平; George Town=槟城|檳城; Alor Setar=亚罗士打|亞羅士打; Kuantan=关丹|關丹; Kuching=古晋|古晉@Asia/Kuching; Sibu=诗巫|詩巫@Asia/Kuching; Miri=美里@Asia/Kuching; Kota Kinabalu=亚庇|亞庇@Asia/Kuching; Sandakan=山打根@Asia/Kuching"),
    ("IDN", "印尼", "Asia/Jakarta", "Jakarta=雅加达|雅加達; Bandung=万隆|萬隆; Semarang=三宝垄|三寶瓏; Surabaya=泗水; Medan=棉兰|棉蘭; Palembang=巨港; Pekanbaru=北干巴鲁|北干巴魯; Pontianak=坤甸@Asia/Pontianak; Singkawang=山口洋@Asia/Pontianak; Makassar=望加锡|望加錫@Asia/Makassar; Denpasar=登巴萨|登巴薩@Asia/Makassar"),
    ("THA", "泰国|泰國", "Asia/Bangkok", "Bangkok=曼谷; Chiang Mai=清迈|清邁; Hat Yai=合艾; Phuket=普吉"),
    ("PHL", "菲律宾|菲律賓", "Asia/Manila", "Manila=马尼拉|馬尼拉; Cebu=宿务|宿霧; Davao=达沃|納卯"),
    # 北越用 Asia/Bangkok（tzdata zone1970.tab「north Vietnam」）：Asia/Ho_Chi_Minh 是南方，1960–1975 年是 UTC+8，北方是 UTC+7
    ("VNM", "越南", "Asia/Ho_Chi_Minh", "Ho Chi Minh City=胡志明市; Hanoi=河内|河內@Asia/Bangkok; Haiphong=海防@Asia/Bangkok; Da Nang=岘港|峴港"),
    ("KHM", "柬埔寨", "Asia/Phnom_Penh", "Phnom Penh=金边|金邊"),
    ("LAO", "老挝|寮國", "Asia/Vientiane", "Vientiane=万象|永珍"),
    ("MMR", "缅甸|緬甸", "Asia/Yangon", "Yangon=仰光; Mandalay=曼德勒"),
    ("BRN", "文莱|汶萊", "Asia/Brunei", "Bandar Seri Begawan=斯里巴加湾|斯里巴卡旺"),
    ("ARE", "阿联酋|阿聯", "Asia/Dubai", "Dubai=迪拜|杜拜; Abu Dhabi=阿布扎比|阿布達比"),
    ("ZAF", "南非", "Africa/Johannesburg", "Johannesburg=约翰内斯堡|約翰尼斯堡; Pretoria=比勒陀利亚|普利托利亞; Durban=德班; Cape Town=开普敦|開普敦"),
    ("MUS", "毛里求斯|模里西斯", "Indian/Mauritius", "Port Louis=路易港"),
    ("BRA", "巴西", "America/Sao_Paulo", "São Paulo=圣保罗|聖保羅; Rio de Janeiro=里约热内卢|里約熱內盧"),
    ("ARG", "阿根廷", "America/Argentina/Buenos_Aires", "Buenos Aires=布宜诺斯艾利斯|布宜諾斯艾利斯"),
    ("PER", "秘鲁|秘魯", "America/Lima", "Lima=利马|利馬"),
    ("CHL", "智利", "America/Santiago", "Santiago=圣地亚哥|聖地牙哥"),
    ("MEX", "墨西哥", "America/Mexico_City", "Mexico City=墨西哥城; Mexicali=墨西卡利@America/Tijuana; Tijuana=蒂华纳|提華納@America/Tijuana"),
    ("PAN", "巴拿马|巴拿馬", "America/Panama", "Panama City=巴拿马城|巴拿馬城"),
    ("PYF", "法属波利尼西亚|法屬玻里尼西亞", "Pacific/Tahiti", "Papeete=帕皮提"),
]


def pair(s: str) -> tuple[str, str]:
    hans, _, hant = s.partition("|")
    return hans, hant or hans


def main() -> None:
    url, sha = SOURCE
    raw = urllib.request.urlopen(url).read()
    if hashlib.sha256(raw).hexdigest() != sha:
        raise SystemExit(f"sha256 对不上：{url}")
    places = [f["properties"] for f in json.loads(raw)["features"]]
    spaces = lambda s: re.sub(r"\s+", " ", s or "").strip()

    regions: list[list[str]] = []
    zones: list[str] = []
    cities: list[list] = []
    problems: list[str] = []

    def add(name: str, region: str, lon: float, tz: str) -> None:
        if list(pair(region)) not in regions:
            regions.append(list(pair(region)))
        if tz not in zones:
            zones.append(tz)
        cities.append([*pair(name), regions.index(list(pair(region))), round(lon, 2), zones.index(tz)])

    def find(a3: str, name: str, adm: str = "") -> list[dict]:
        return [p for p in places if p["ADM0_A3"] == a3 and spaces(p["NAME"]) == name and (not adm or p["ADM1NAME"] == adm)]

    missing = []
    china = [p for p in places if p["ADM0_A3"] == "CHN"]
    for prov, adm1, names in CHINA:
        hans, hant = pair(prov)
        for item in names.split():
            city = pair(item)[0]
            if city in ALIAS:
                name, _, adm = ALIAS[city].partition("/")
                hit = find("CHN", name, adm)
            else:
                stem = lambda p: re.sub("(市|区|县|镇|街道)$", "", p["NAME_ZH"] or "")
                hit = [p for p in china if stem(p) == city and p["ADM1NAME"] in adm1.split("/")]
            if len(hit) > 1:
                problems.append(f"{city}：Natural Earth 里有 {len(hit)} 条，在 ALIAS 里指定")
            elif not hit:
                missing.append(city)
            else:
                add(item, f"{hans}|{hant}", hit[0]["LONGITUDE"], "Asia/Shanghai")

    for a3, region, tz, table in REGIONS:
        for name, cn in table.items():
            hit = find(a3, name)
            if len(hit) != 1:
                problems.append(f"{a3} {name}：Natural Earth 里有 {len(hit)} 条")
                continue
            add(cn, region, hit[0]["LONGITUDE"], tz)

    for a3, country, tz, items in OVERSEAS:
        for item in items.split("; "):
            key, _, rest = item.partition("=")
            cn, _, own = rest.partition("@")
            name, _, adm = key.partition("/")
            hit = find(a3, name, adm)
            if len(hit) != 1:
                problems.append(f"{a3} {key}：Natural Earth 里有 {len(hit)} 条")
                continue
            add(cn, country, hit[0]["LONGITUDE"], own or tz)

    # 显示的写法（名字 · 所属）不能重复
    for k in (0, 1):
        seen: dict[str, int] = {}
        for c in cities:
            label = c[k] if c[k] == regions[c[2]][k] else f"{c[k]} · {regions[c[2]][k]}"
            seen[label] = seen.get(label, 0) + 1
        problems += [f"重复：{label}" for label, n in seen.items() if n > 1]
    if problems:
        raise SystemExit("\n".join(problems))

    with open("src/data/cities.json", "w", encoding="utf-8") as f:
        json.dump({"regions": regions, "zones": zones, "cities": cities}, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(len(cities), "cities;", len(missing), "个地级城市 Natural Earth 没有，不收：", " ".join(missing))


if __name__ == "__main__":
    main()

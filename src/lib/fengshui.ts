// 八宅基础：生年按立春分界；原理据《八宅明镜》上卷三元男女命卦起例，说明文字另写。
// 只列卦、方向与东西四卦分组，不据此预测居住者的遭遇。
export const DIRECTIONS = [
	{ name:'北', hant:'北', gua:'坎', number:1, degree:0, group:'东' },
	{ name:'东北', hant:'東北', gua:'艮', number:8, degree:45, group:'西' },
	{ name:'东', hant:'東', gua:'震', number:3, degree:90, group:'东' },
	{ name:'东南', hant:'東南', gua:'巽', number:4, degree:135, group:'东' },
	{ name:'南', hant:'南', gua:'离', number:9, degree:180, group:'东' },
	{ name:'西南', hant:'西南', gua:'坤', number:2, degree:225, group:'西' },
	{ name:'西', hant:'西', gua:'兑', number:7, degree:270, group:'西' },
	{ name:'西北', hant:'西北', gua:'乾', number:6, degree:315, group:'西' },
] as const;

export function minggua(year: number, gender: '男'|'女') {
	if (!Number.isInteger(year) || year < 1 || year > 9999 || !['男','女'].includes(gender)) throw new RangeError('birth');
	const root = (n: number) => (n - 1) % 9 + 1;
	const sum = root(year);
	const raw = root(gender === '男' ? 11 - sum : sum + 4);
	const number = raw === 5 ? (gender === '男' ? 2 : 8) : raw;
	return { ...DIRECTIONS.find(x => x.number === number)!, raw, sum };
}

/** 磁北为0、顺时针；360与0同向，八方边界按顺时针一侧归组。 */
export function bearing(degree: number) {
	if (!Number.isFinite(degree) || degree < 0 || degree > 360) throw new RangeError('bearing');
	return degree % 360;
}

export function house(degree: number) {
	const facing = Math.floor((bearing(degree) + 22.5) / 45) % 8;
	return { facing:DIRECTIONS[facing]!, sitting:DIRECTIONS[(facing+4)%8]! };
}

/** 旋转后外框包住整张本地图；九宫按这个矩形均分，不识别房间或户型凹凸。 */
export function rotatedSize(width: number, height: number, degree: number) {
	if (![width,height,degree].every(Number.isFinite) || width <= 0 || height <= 0 || width > 20000 || height > 20000 || width * height > 20_000_000) throw new RangeError('image');
	const a = degree * Math.PI / 180;
	return { width:Math.abs(width*Math.cos(a))+Math.abs(height*Math.sin(a)), height:Math.abs(width*Math.sin(a))+Math.abs(height*Math.cos(a)) };
}

/** 先查格式签名，再交给浏览器解码；不接受可能引用外部资源的 SVG。 */
export function imageType(bytes: Uint8Array) {
	if ([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return 'png';
	if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'jpeg';
	if ([82,73,70,70].every((v,i)=>bytes[i]===v) && [87,69,66,80].every((v,i)=>bytes[i+8]===v)) return 'webp';
	return null;
}

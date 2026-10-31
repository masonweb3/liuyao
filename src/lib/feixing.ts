// 沈氏下卦：据卷四挨星掌诀自行实现，不使用古书断语；年、月九星取 tyme4ts 干支历。
import { SixtyCycleYear, SolarTime } from 'tyme4ts';
import { bearing, DIRECTIONS, house } from './fengshui';

export const MOUNTAINS = ['子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥','壬'] as const;
// 宫位用洛书原编号；图面在页面上统一北在上。
export const GRID = [6,1,8,7,5,3,2,9,4];
const ORDER = [5,6,7,8,9,1,2,3,4];
const YANG = new Set<string>(['艮','寅','甲','巽','巳','丙','坤','申','庚','乾','亥','壬']);

export function flight(centre: number, forward = true): Record<number,number> {
	if (!Number.isInteger(centre) || centre < 1 || centre > 9) throw new RangeError('star');
	return Object.fromEntries(ORDER.map((palace,i)=>[palace,((centre-1+i*(forward?1:-1))%9+9)%9+1]));
}

function forward(star: number, original: number) {
	// 五没有本卦，按原山向的阴阳；其余找入中星本宫的同元龙。
	if (star === 5) return YANG.has(MOUNTAINS[original]!);
	const middle = DIRECTIONS.find(x=>x.number===star)!.degree / 15;
	const yuan = (original+1)%3; // 地、天、人；各宫中间一山是天元。
	return YANG.has(MOUNTAINS[(middle+yuan-1+24)%24]!);
}

export function period(year: number) {
	if (!Number.isInteger(year) || year < 1 || year > 9999) throw new RangeError('year');
	return SixtyCycleYear.fromYear(year).getTwenty().getIndex()+1;
}

export function houseStars(year: number, degrees: number) {
	const angle = bearing(degrees);
	const facingIndex = Math.round(angle/15)%24;
	const difference = Math.abs(angle-facingIndex*15);
	const offset = Math.min(difference,360-difference);
	// shortcut: 只排每山中间九度的下卦，临界线与兼向拒绝；替星经独立核盘后再开放。
	if (offset >= 4.5) throw new RangeError('edge');
	const sittingIndex = (facingIndex+12)%24;
	const p = period(year);
	const base = flight(p);
	const directions = house(angle);
	const mountainCentre = base[directions.sitting.number]!;
	const facingCentre = base[directions.facing.number]!;
	const mountainForward = forward(mountainCentre,sittingIndex);
	const facingForward = forward(facingCentre,facingIndex);
	return { period:p, angle, sitting:MOUNTAINS[sittingIndex]!, facing:MOUNTAINS[facingIndex]!, mountainForward, facingForward, base, mountain:flight(mountainCentre,mountainForward), face:flight(facingCentre,facingForward) };
}

export function yearStars(year: number) {
	period(year); // 同一公历年份边界校验；年星从这一干支年的立春起算。
	const y = SixtyCycleYear.fromYear(year);
	const centre = y.getNineStar().getIndex()+1;
	return { year, name:y.getName(), centre, grid:flight(centre) };
}

/** 输入为北京时间，分钟或秒；按精确节气时刻切换年、月，不拿农历月替代节令月。 */
export function calendarStars(value: string) {
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
	if (!m) throw new RangeError('date');
	try {
		const at = SolarTime.fromYmdHms(Number(m[1]),Number(m[2]),Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]??0));
		const month = at.getSixtyCycleHour().getSixtyCycleDay().getSixtyCycleMonth();
		const year = month.getSixtyCycleYear();
		const annual = yearStars(year.getYear());
		const centre = month.getNineStar().getIndex()+1;
		return { annual, month:month.getName(), monthCentre:centre, monthGrid:flight(centre) };
	} catch { throw new RangeError('date'); }
}
